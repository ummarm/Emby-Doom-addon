"use strict";

const { Readable } = require("stream");
const { getStreams, getStreamsFast } = require("./addon");

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

const UPSTREAM_OPEN_TIMEOUT_MS = Number(process.env.UPSTREAM_OPEN_TIMEOUT_MS || 10000);
const SEEK_PROBE_TIMEOUT_MS = Number(process.env.SEEK_PROBE_TIMEOUT_MS || 8000);
const EMBY_RESOLVE_TIMEOUT_MS = Number(process.env.EMBY_RESOLVE_TIMEOUT_MS || 45000);
const EMBY_PROVIDER_TIMEOUT_MS = Number(process.env.EMBY_PROVIDER_TIMEOUT_MS || 25000);
const EMBY_MIN_CANDIDATES = Number(process.env.EMBY_MIN_CANDIDATES || 40);
const EMBY_VALIDATE_CANDIDATES = Number(process.env.EMBY_VALIDATE_CANDIDATES || 24);
const EMBY_VALIDATE_CONCURRENCY = Number(process.env.EMBY_VALIDATE_CONCURRENCY || 8);
const STREAM_CACHE_TTL_MS = Number(process.env.STREAM_CACHE_TTL_MS || 30 * 60 * 1000);
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
    .map((stream) => ({ stream, score: qualityScore(streamText(stream), profile) }))
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
  const results = [];
  const errors = [];
  let nextIndex = 0;
  const concurrency = Math.min(EMBY_VALIDATE_CONCURRENCY, probeTargets.length);

  async function worker() {
    while (nextIndex < probeTargets.length) {
      const currentIndex = nextIndex;
      const current = probeTargets[currentIndex];
      nextIndex += 1;
      const probe = await probeSeekableStream(current);
      if (probe.ok) {
        results.push({ index: currentIndex, stream: current });
        console.log(`[Emby] Seekable ${current.name}`);
      } else {
        errors.push(`${current.name}: ${probe.reason}`);
        console.log(`[Emby] Not seekable ${current.name}: ${probe.reason}`);
      }
    }
  }

  await Promise.all(Array.from({ length: concurrency }, () => worker()));
  const validated = results
    .sort((a, b) => a.index - b.index)
    .map((result) => result.stream);
  return { validated, errors };
}

function writeProxyHeaders(response, upstreamResponse) {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "X-Emby-Doom-Proxied": "1"
  };

  for (const name of PASS_THROUGH_HEADERS) {
    const value = upstreamResponse.headers.get(name);
    if (value && !HOP_BY_HOP_HEADERS.has(name)) {
      headers[name] = value;
    }
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

  writeProxyHeaders(response, upstreamResponse);

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
    providerTimeoutMs: EMBY_PROVIDER_TIMEOUT_MS
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
  const streams = await getStreamsFast(streamRequest.type, streamRequest.id, {
    minStreams: Math.max(EMBY_MIN_CANDIDATES, slot),
    overallTimeoutMs: EMBY_RESOLVE_TIMEOUT_MS,
    providerTimeoutMs: EMBY_PROVIDER_TIMEOUT_MS
  });
  const rankedStreams = rankStreams(streams, String(streamRequest.searchParams.get("profile") || "1080p").toLowerCase());
  const body = JSON.stringify({
    type: streamRequest.type,
    id: streamRequest.id,
    elapsedMs: Date.now() - startedAt,
    count: streams.length,
    cacheKeys: streamCache.size,
    streams: rankedStreams.slice(0, 20).map((stream) => ({
      name: stream.name,
      title: stream.title,
      urlHost: (() => {
        try {
          return new URL(stream.url).host;
        } catch {
          return null;
        }
      })(),
      hasProxyHeaders: Boolean(stream.behaviorHints && stream.behaviorHints.proxyHeaders)
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
