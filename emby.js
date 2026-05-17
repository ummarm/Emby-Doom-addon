"use strict";

const { Readable } = require("stream");
const { getStreamsFast } = require("./addon");

const REJECT_WORDS = [
  "cam", "hdcam", "ts", "telesync", "tc", "telecine",
  "xbet", "hqcam", "predvd", "dvdscr", "scr"
];

const INDIAN_LANGUAGE_WORDS = [
  "hindi", "urdu", "dual", "multi", "multi audio",
  "telugu", "telegu", "tamil", "malayalam", "kannada", "kandana",
  "punjabi", "bengali", "marathi"
];

const PROVIDER_PRIORITY = [
  "4KHH DR",
  "4KHH Y",
  "4KHH M",
  "HDHU DR",
  "HDHU M",
  "HDHU Y",
  "HM",
  "MBL",
  "MB",
  "MD",
  "SF"
];

const HOP_BY_HOP_HEADERS = new Set([
  "connection",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailer",
  "transfer-encoding",
  "upgrade"
]);

const PASS_THROUGH_HEADERS = [
  "accept-ranges",
  "cache-control",
  "content-disposition",
  "content-length",
  "content-range",
  "content-type",
  "etag",
  "last-modified"
];

const UPSTREAM_OPEN_TIMEOUT_MS = Number(process.env.UPSTREAM_OPEN_TIMEOUT_MS || 7000);
const SEEK_PROBE_TIMEOUT_MS = Number(process.env.SEEK_PROBE_TIMEOUT_MS || 6000);
const EMBY_RESOLVE_TIMEOUT_MS = Number(process.env.EMBY_RESOLVE_TIMEOUT_MS || 22000);
const EMBY_PROVIDER_TIMEOUT_MS = Number(process.env.EMBY_PROVIDER_TIMEOUT_MS || 12000);
const EMBY_MIN_CANDIDATES = Number(process.env.EMBY_MIN_CANDIDATES || 12);
const EMBY_VALIDATE_CANDIDATES = Number(process.env.EMBY_VALIDATE_CANDIDATES || 20);
const EMBY_VALIDATE_CONCURRENCY = Number(process.env.EMBY_VALIDATE_CONCURRENCY || 8);
const STREAM_CACHE_TTL_MS = Number(process.env.STREAM_CACHE_TTL_MS || 30 * 60 * 1000);
const EMBY_PROVIDER_IDS = String(process.env.EMBY_PROVIDER_IDS || "hdhub4u,hdhub4u_yoruix,moviebox,streamflix,hindmoviez,moviesdrive")
  .split(",")
  .map((provider) => provider.trim())
  .filter(Boolean);
const streamCache = new Map();

function streamText(stream) {
  return [
    stream.name,
    stream.title,
    stream.description,
    stream.url
  ].filter(Boolean).join(" ").toLowerCase();
}

function qualityScore(text, profile) {
  let score = 0;

  if (text.includes("2160") || text.includes("4k") || text.includes("uhd")) score += 400;
  if (text.includes("1080")) score += 300;
  if (text.includes("720")) score += 180;
  if (text.includes("480")) score += 90;

  if (profile === "4k") {
    if (text.includes("2160") || text.includes("4k") || text.includes("uhd")) score += 1000;
    else if (text.includes("1080")) score += 200;
  } else {
    if (text.includes("1080")) score += 1000;
    else if (text.includes("720")) score += 250;
    else if (text.includes("480")) score += 120;
  }

  if (text.includes("web-dl") || text.includes("webdl")) score += 80;
  if (text.includes("bluray") || text.includes("blu-ray")) score += 70;
  if (text.includes("hevc") || text.includes("x265")) score += 35;
  if (text.includes("x264")) score += 20;
  if (INDIAN_LANGUAGE_WORDS.some((word) => text.includes(word))) score += 120;

  PROVIDER_PRIORITY.forEach((provider, index) => {
    if (text.includes(provider.toLowerCase())) {
      score += Math.max(0, 100 - index * 10);
    }
  });

  return score;
}

function parseSizeToBytes(value) {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) {
    return value;
  }

  const match = String(value || "").match(/([\d.]+)\s*(tb|gb|mb|kb|bytes|byte|b)\b/i);
  if (!match) {
    return 0;
  }

  const amount = Number(match[1]);
  if (!Number.isFinite(amount) || amount <= 0) {
    return 0;
  }

  const unit = match[2].toLowerCase();
  const multipliers = {
    tb: 1024 ** 4,
    gb: 1024 ** 3,
    mb: 1024 ** 2,
    kb: 1024,
    bytes: 1,
    byte: 1,
    b: 1
  };
  return Math.round(amount * multipliers[unit]);
}

function streamSizeBytes(stream) {
  return parseSizeToBytes(stream && stream.behaviorHints && stream.behaviorHints.videoSize)
    || parseSizeToBytes(stream && stream.title)
    || parseSizeToBytes(stream && stream.description)
    || parseSizeToBytes(stream && stream.name);
}

function hostnameOf(stream) {
  try {
    return new URL(stream.url).hostname.toLowerCase();
  } catch {
    return "";
  }
}

function hasProxyHeaders(stream) {
  return Boolean(stream && stream.behaviorHints && stream.behaviorHints.proxyHeaders);
}

function embyScore(stream, profile) {
  const text = streamText(stream);
  let score = qualityScore(text, profile);
  const host = hostnameOf(stream);
  const size = streamSizeBytes(stream);
  const gb = size / (1024 ** 3);

  if (hasProxyHeaders(stream)) score += 140;
  if (text.includes("web-dl") || text.includes("webdl")) score += 160;
  if (text.includes("mp4") || /\.mp4(?:[?#].*)?$/i.test(stream.url)) score += 180;
  if (text.includes("x264") || text.includes("h264")) score += 80;
  if (text.includes("ddp") || text.includes("aac")) score += 45;

  if (host.includes("r2.dev")) score += 120;
  if (host.includes("wasabisys.com")) score += 100;
  if (host.includes("diskcdn.buzz")) score += 80;
  if (host.includes("moviebox")) score += 80;
  if (host.includes("workers.dev")) score -= 60;
  if (host.includes("odyssey.surf")) score -= 140;

  if (text.includes("remux")) score -= 220;
  if (text.includes("truehd")) score -= 160;
  if (text.includes("atmos")) score -= 80;
  if (text.includes("dv ") || text.includes("dolby vision") || text.includes("hdr10")) score -= 80;

  if (size > 0) {
    if (profile === "4k") {
      if (gb <= 25) score += 80;
      if (gb > 45) score -= 240;
      if (gb > 70) score -= 400;
    } else {
      if (gb <= 8) score += 160;
      if (gb > 12) score -= 180;
      if (gb > 20) score -= 350;
      if (gb > 30) score -= 500;
    }
  }

  return score;
}

function pickStream(streams, profile, slot) {
  const candidates = rankStreams(streams, profile);

  if (candidates.length === 0) {
    return null;
  }

  const index = Math.min(Math.max(slot - 1, 0), candidates.length - 1);
  return candidates[index];
}

function rankStreams(streams, profile) {
  return streams
    .filter((stream) => stream && stream.url && !REJECT_WORDS.some((word) => streamText(stream).includes(word)))
    .map((stream) => ({ stream, score: embyScore(stream, profile) }))
    .sort((a, b) => b.score - a.score)
    .map((candidate) => candidate.stream);
}

function requestHeadersForStream(stream, incomingRequest) {
  const proxyHeaders = stream.behaviorHints
    && stream.behaviorHints.proxyHeaders
    && stream.behaviorHints.proxyHeaders.request;
  const headers = Object.assign({}, proxyHeaders || {});

  if (incomingRequest.headers.range && !headers.Range && !headers.range) {
    headers.Range = incomingRequest.headers.range;
  }
  if (!headers["User-Agent"] && !headers["user-agent"]) {
    headers["User-Agent"] = incomingRequest.headers["user-agent"] || "Emby-Doom-addon";
  }
  if (!headers.Accept && !headers.accept) {
    headers.Accept = "*/*";
  }

  return headers;
}

function cacheKeyForRequest(streamRequest, profile, slot) {
  return `${streamRequest.type}:${streamRequest.id}:${profile}:${slot}`;
}

function getCachedStream(cacheKey) {
  const cached = streamCache.get(cacheKey);
  if (!cached) {
    return null;
  }
  if (Date.now() > cached.expiresAt) {
    streamCache.delete(cacheKey);
    return null;
  }
  return cached.stream;
}

function setCachedStream(cacheKey, stream) {
  streamCache.set(cacheKey, {
    stream,
    expiresAt: Date.now() + STREAM_CACHE_TTL_MS
  });
}

function probeHeadersForStream(stream) {
  const headers = requestHeadersForStream(stream, { headers: {} });
  if (!headers.Range && !headers.range) {
    headers.Range = "bytes=0-4095";
  }
  return headers;
}

async function readProbeSample(response) {
  if (!response.body || typeof response.body.getReader !== "function") {
    return "";
  }

  const reader = response.body.getReader();
  try {
    const chunk = await reader.read();
    if (!chunk.value) {
      return "";
    }
    return Buffer.from(chunk.value).slice(0, 256).toString("utf8").trim().toLowerCase();
  } finally {
    await reader.cancel().catch(() => {});
  }
}

function looksLikeBadProbeBody(text, contentType) {
  const normalizedType = String(contentType || "").toLowerCase();
  const sample = String(text || "").toLowerCase();
  return normalizedType.includes("text/html")
    || normalizedType.includes("application/json")
    || normalizedType.includes("text/plain")
    || sample.startsWith("<!doctype")
    || sample.startsWith("<html")
    || sample.startsWith("{")
    || sample.includes("access denied")
    || sample.includes("not found")
    || sample.includes("link expired")
    || sample.includes("cloudflare");
}

async function probeSeekableStream(stream) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), SEEK_PROBE_TIMEOUT_MS);

  try {
    const response = await fetch(stream.url, {
      method: "GET",
      headers: probeHeadersForStream(stream),
      redirect: "follow",
      signal: controller.signal
    });

    if (!response.ok) {
      return { ok: false, reason: `HTTP ${response.status}` };
    }

    const contentType = response.headers.get("content-type") || "";
    const sample = await readProbeSample(response);
    if (looksLikeBadProbeBody(sample, contentType)) {
      return { ok: false, reason: `bad body ${contentType || "unknown"}` };
    }

    const contentRange = response.headers.get("content-range") || "";
    const acceptRanges = response.headers.get("accept-ranges") || "";
    const seekable = response.status === 206
      || /^bytes\s+/i.test(contentRange)
      || /bytes/i.test(acceptRanges);

    if (!seekable) {
      return { ok: false, reason: "no byte range support" };
    }

    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      reason: error.name === "AbortError"
        ? `probe timed out after ${SEEK_PROBE_TIMEOUT_MS}ms`
        : (error.message || String(error))
    };
  } finally {
    clearTimeout(timeout);
  }
}

async function validateRankedStreams(rankedStreams, desiredIndex) {
  const probeTargets = rankedStreams.slice(0, Math.max(EMBY_VALIDATE_CANDIDATES, desiredIndex + 1));
  const validated = [];
  const errors = [];

  for (let start = 0; start < probeTargets.length && validated.length <= desiredIndex; start += EMBY_VALIDATE_CONCURRENCY) {
    const batch = probeTargets.slice(start, start + EMBY_VALIDATE_CONCURRENCY);
    const results = await Promise.all(batch.map(async (stream, offset) => ({
      index: start + offset,
      stream,
      probe: await probeSeekableStream(stream)
    })));

    for (const result of results.sort((a, b) => a.index - b.index)) {
      const current = result.stream;
      const probe = result.probe;
      if (probe.ok) {
        validated.push(current);
        console.log(`[Emby] Seekable ${current.name}`);
      } else {
        errors.push(`${current.name}: ${probe.reason}`);
        console.log(`[Emby] Not seekable ${current.name}: ${probe.reason}`);
      }
    }
  }

  return { validated, errors };
}

function inferContentType(stream, upstreamResponse) {
  const upstreamType = upstreamResponse.headers.get("content-type");
  if (upstreamType) {
    return upstreamType;
  }

  const text = streamText(stream);
  const url = String(stream.url || "").toLowerCase();
  if (text.includes(".mp4") || url.includes(".mp4")) return "video/mp4";
  if (text.includes(".mkv") || url.includes(".mkv")) return "video/x-matroska";
  if (text.includes(".webm") || url.includes(".webm")) return "video/webm";
  if (text.includes(".m3u8") || url.includes(".m3u8")) return "application/vnd.apple.mpegurl";
  return "application/octet-stream";
}

function inferFilename(stream) {
  const filename = stream.behaviorHints && stream.behaviorHints.filename;
  if (filename) {
    return filename;
  }

  const firstLine = String(stream.title || stream.description || "").split("\n")[0].trim();
  if (/\.(mkv|mp4|webm|m3u8)\b/i.test(firstLine)) {
    return firstLine.replace(/"/g, "");
  }
  return null;
}

function writeProxyHeaders(response, upstreamResponse, stream) {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "X-Emby-Doom-Proxied": "1",
    "Accept-Ranges": "bytes",
    "Content-Type": inferContentType(stream, upstreamResponse)
  };

  for (const name of PASS_THROUGH_HEADERS) {
    if (name === "content-type") {
      continue;
    }
    const value = upstreamResponse.headers.get(name);
    if (value && !HOP_BY_HOP_HEADERS.has(name)) {
      headers[name] = value;
    }
  }

  const filename = inferFilename(stream);
  if (filename && !headers["content-disposition"]) {
    headers["Content-Disposition"] = `inline; filename="${filename}"`;
  }

  response.writeHead(upstreamResponse.status, headers);
}

async function proxySelectedStream(request, response, stream) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), UPSTREAM_OPEN_TIMEOUT_MS);
  request.on("close", () => controller.abort());

  let upstreamResponse;
  try {
    upstreamResponse = await fetch(stream.url, {
      method: request.method === "HEAD" ? "HEAD" : "GET",
      headers: requestHeadersForStream(stream, request),
      redirect: "follow",
      signal: controller.signal
    });
  } finally {
    clearTimeout(timeout);
  }

  if (!upstreamResponse.ok) {
    throw new Error(`Provider returned HTTP ${upstreamResponse.status}`);
  }

  writeProxyHeaders(response, upstreamResponse, stream);

  if (request.method === "HEAD" || !upstreamResponse.body) {
    response.end();
    return;
  }

  Readable.fromWeb(upstreamResponse.body).pipe(response);
}

async function proxyFirstWorkingStream(request, response, rankedStreams) {
  const errors = [];

  for (const stream of rankedStreams) {
    try {
      console.log(`[Emby] Trying ${stream.name}`);
      await proxySelectedStream(request, response, stream);
      return true;
    } catch (error) {
      const message = error.name === "AbortError"
        ? `Timed out opening provider after ${UPSTREAM_OPEN_TIMEOUT_MS}ms`
        : (error.message || String(error));
      errors.push(`${stream.name}: ${message}`);
      console.log(`[Emby] Skipped ${stream.name}: ${message}`);
      if (response.headersSent) {
        return true;
      }
    }
  }

  response.writeHead(502, {
    "Access-Control-Allow-Origin": "*",
    "Content-Type": "text/plain; charset=utf-8"
  });
  response.end(`No provider stream opened in time.\n${errors.slice(0, 8).join("\n")}`);
  return false;
}

async function handleEmbyPlayback(request, response, streamRequest) {
  const profile = String(streamRequest.searchParams.get("profile") || "1080p").toLowerCase();
  const slot = Number.parseInt(streamRequest.searchParams.get("slot") || "1", 10) || 1;
  const mode = String(streamRequest.searchParams.get("mode") || "proxy").toLowerCase();
  const cacheKey = cacheKeyForRequest(streamRequest, profile, slot);
  const cachedStream = getCachedStream(cacheKey);

  if (cachedStream) {
    console.log(`[Emby] Cache hit ${streamRequest.type} ${streamRequest.id} profile=${profile} slot=${slot} -> ${cachedStream.name}`);
    if (mode === "redirect") {
      response.writeHead(302, {
        Location: cachedStream.url,
        "Access-Control-Allow-Origin": "*"
      });
      response.end();
      return;
    }
    try {
      await proxySelectedStream(request, response, cachedStream);
      return;
    } catch (error) {
      streamCache.delete(cacheKey);
      console.log(`[Emby] Cached stream failed: ${error.message || error}`);
      if (response.headersSent) {
        return;
      }
    }
  }

  const streams = await getStreamsFast(streamRequest.type, streamRequest.id, {
    minStreams: Math.max(EMBY_MIN_CANDIDATES, slot),
    overallTimeoutMs: EMBY_RESOLVE_TIMEOUT_MS,
    providerTimeoutMs: EMBY_PROVIDER_TIMEOUT_MS,
    providerIds: EMBY_PROVIDER_IDS
  });
  const rankedStreams = rankStreams(streams, profile);
  const validation = await validateRankedStreams(rankedStreams, Math.max(0, slot - 1));
  const selectedIndex = Math.min(Math.max(slot - 1, 0), validation.validated.length - 1);
  const selected = validation.validated[selectedIndex];

  if (!selected) {
    response.writeHead(404, {
      "Access-Control-Allow-Origin": "*",
      "Content-Type": "text/plain; charset=utf-8"
    });
    response.end(`No seekable streams found for ${streamRequest.type} ${streamRequest.id}\n${validation.errors.slice(0, 12).join("\n")}`);
    return;
  }

  setCachedStream(cacheKey, selected);
  console.log(`[Emby] ${streamRequest.type} ${streamRequest.id} profile=${profile} slot=${slot} -> ${selected.name}`);

  if (mode === "redirect") {
    response.writeHead(302, {
      Location: selected.url,
      "Access-Control-Allow-Origin": "*"
    });
    response.end();
    return;
  }

  await proxyFirstWorkingStream(request, response, validation.validated.slice(selectedIndex));
}

async function handleEmbyDebug(response, streamRequest) {
  const slot = Number.parseInt(streamRequest.searchParams.get("slot") || "1", 10) || 1;
  const startedAt = Date.now();
  const profile = String(streamRequest.searchParams.get("profile") || "1080p").toLowerCase();
  const shouldProbe = ["1", "true", "yes"].includes(String(streamRequest.searchParams.get("probe") || "").toLowerCase());
  const streams = await getStreamsFast(streamRequest.type, streamRequest.id, {
    minStreams: Math.max(EMBY_MIN_CANDIDATES, slot),
    overallTimeoutMs: EMBY_RESOLVE_TIMEOUT_MS,
    providerTimeoutMs: EMBY_PROVIDER_TIMEOUT_MS,
    providerIds: EMBY_PROVIDER_IDS
  });
  const rankedStreams = rankStreams(streams, profile);
  const probeResults = shouldProbe
    ? await Promise.all(rankedStreams.slice(0, 12).map(async (stream) => ({
        name: stream.name,
        urlHost: hostnameOf(stream),
        probe: await probeSeekableStream(stream)
      })))
    : undefined;
  const body = JSON.stringify({
    type: streamRequest.type,
    id: streamRequest.id,
    profile,
    elapsedMs: Date.now() - startedAt,
    count: streams.length,
    cacheKeys: streamCache.size,
    providerIds: EMBY_PROVIDER_IDS,
    probed: Boolean(shouldProbe),
    probeResults,
    streams: rankedStreams.slice(0, 20).map((stream) => ({
      name: stream.name,
      title: stream.title,
      urlHost: hostnameOf(stream),
      sizeBytes: streamSizeBytes(stream),
      embyScore: embyScore(stream, profile),
      hasProxyHeaders: hasProxyHeaders(stream)
    }))
  }, null, 2);

  response.writeHead(200, {
    "Access-Control-Allow-Origin": "*",
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body)
  });
  response.end(body);
}

function parseEmbyPath(pathname, searchParams) {
  let match = pathname.match(/^\/emby\/debug\/movie\/(tt\d+)$/i);
  if (match) {
    return {
      debug: true,
      type: "movie",
      id: match[1],
      searchParams
    };
  }

  match = pathname.match(/^\/emby\/debug\/series\/(tt\d+)\/(\d+)\/(\d+)$/i);
  if (match) {
    return {
      debug: true,
      type: "series",
      id: `${match[1]}:${match[2]}:${match[3]}`,
      searchParams
    };
  }

  match = pathname.match(/^\/emby\/movie\/(tt\d+)$/i);
  if (match) {
    return {
      type: "movie",
      id: match[1],
      searchParams
    };
  }

  match = pathname.match(/^\/emby\/series\/(tt\d+)\/(\d+)\/(\d+)$/i);
  if (match) {
    return {
      type: "series",
      id: `${match[1]}:${match[2]}:${match[3]}`,
      searchParams
    };
  }

  return null;
}

module.exports = {
  handleEmbyDebug,
  handleEmbyPlayback,
  parseEmbyPath,
  pickStream
};
