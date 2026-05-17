"use strict";

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
  "EMB",
  "VG",
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

const UPSTREAM_OPEN_TIMEOUT_MS = Number(process.env.UPSTREAM_OPEN_TIMEOUT_MS || 12000);
const FIRST_CHUNK_TIMEOUT_MS = Number(process.env.FIRST_CHUNK_TIMEOUT_MS || 8000);
const FIRST_MEDIA_BUFFER_BYTES = Number(process.env.FIRST_MEDIA_BUFFER_BYTES || 65536);
const SEEK_PROBE_TIMEOUT_MS = Number(process.env.SEEK_PROBE_TIMEOUT_MS || 6000);
const EMBY_RESOLVE_TIMEOUT_MS = Number(process.env.EMBY_RESOLVE_TIMEOUT_MS || 12000);
const EMBY_PROVIDER_TIMEOUT_MS = Number(process.env.EMBY_PROVIDER_TIMEOUT_MS || 10000);
const EMBY_MIN_CANDIDATES = Number(process.env.EMBY_MIN_CANDIDATES || 6);
const EMBY_VALIDATE_CANDIDATES = Number(process.env.EMBY_VALIDATE_CANDIDATES || 10);
const EMBY_VALIDATE_CONCURRENCY = Number(process.env.EMBY_VALIDATE_CONCURRENCY || 4);
const STREAM_CACHE_TTL_MS = Number(process.env.STREAM_CACHE_TTL_MS || 900000);
const EMBY_PROVIDER_IDS = String(process.env.EMBY_PROVIDER_IDS || [
  "flix_streams_emby",
  "flix_streams_vegamovies",
  "moviebox",
  "streamflix",
  "hindmoviez",
  "hdhub4u",
  "hdhub4u_yoruix",
  "hdhub4u_murph",
  "moviesdrive",
  "4khdhub",
  "4khdhub_yoruix",
  "4khdhub_murph",
  "4khdhubtv",
  "movieblast"
].join(","))
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

function has4kQuality(text) {
  return /\b(?:2160p?|uhd|ultra\s*hd)\b/i.test(text)
    || /(?:^|[^a-z0-9])4k(?:[^a-z0-9]|$)/i.test(text);
}

function has1080Quality(text) {
  return /\b1080p?\b/i.test(text);
}

function has720Quality(text) {
  return /\b720p?\b/i.test(text);
}

function has480Quality(text) {
  return /\b480p?\b/i.test(text);
}

function qualityScore(text, profile) {
  let score = 0;

  if (has4kQuality(text)) score += 400;
  if (has1080Quality(text)) score += 300;
  if (has720Quality(text)) score += 180;
  if (has480Quality(text)) score += 90;

  if (profile === "4k") {
    if (has4kQuality(text)) score += 1000;
    else if (has1080Quality(text)) score += 200;
  } else {
    if (has1080Quality(text)) score += 1000;
    else if (has720Quality(text)) score += 250;
    else if (has480Quality(text)) score += 120;
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

  if (text.includes("hindi")) score += 700;
  if (text.includes("dual")) score += 180;
  if (text.includes("multi")) score += 120;
  if (!text.includes("hindi")) score -= 500;

  if (hasProxyHeaders(stream)) score += 140;
  if (text.includes("web-dl") || text.includes("webdl")) score += 160;
  if (text.includes("mp4") || /\.mp4(?:[?#].*)?$/i.test(stream.url)) score += 180;
  if (text.includes("x264") || text.includes("h264")) score += 80;
  if (text.includes("ddp") || text.includes("aac")) score += 45;

  if (host.includes("r2.dev")) score += 120;
  if (host.includes("wasabisys.com")) score += 100;
  if (host.includes("diskcdn.buzz")) score += 80;
  if (host.includes("moviebox")) score += 80;
  if (text.includes("emb |") || text.includes("flix-streams emby") || text.includes("media library")) score += 260;
  if (text.includes("vg |") || text.includes("vegamovies")) score += 220;
  if (host.includes("workers.dev")) score -= 60;
  if (host.includes("odyssey.surf")) score -= 140;

  if (text.includes("remux")) score -= 220;
  if (text.includes("truehd")) score -= 160;
  if (text.includes("atmos")) score -= 80;
  if (text.includes("dv ") || text.includes("dolby vision") || text.includes("hdr10")) score -= 80;
  if (profile === "1080p" && has4kQuality(text)) {
    score -= 2000;
  }

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

function matchesProfile(stream, profile) {
  const text = streamText(stream);
  const is4k = has4kQuality(text);
  if (profile === "4k") {
    return is4k;
  }
  if (profile === "1080p") {
    if (is4k) {
      return false;
    }
    return has1080Quality(text) || has720Quality(text) || has480Quality(text);
  }
  return true;
}

function profileFallbacks(profile) {
  if (profile === "1080p") {
    return [
      (stream) => has1080Quality(streamText(stream)),
      (stream) => has720Quality(streamText(stream)),
      (stream) => has480Quality(streamText(stream))
    ];
  }
  return [
    (stream) => matchesProfile(stream, profile)
  ];
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
    .filter((stream) => stream
      && stream.url
      && matchesProfile(stream, profile)
      && !REJECT_WORDS.some((word) => streamText(stream).includes(word)))
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
  if (STREAM_CACHE_TTL_MS <= 0) {
    return null;
  }

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
  if (STREAM_CACHE_TTL_MS <= 0) {
    return;
  }

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
    return { buffer: Buffer.alloc(0), text: "" };
  }

  const reader = response.body.getReader();
  try {
    const chunk = await reader.read();
    if (!chunk.value) {
      return { buffer: Buffer.alloc(0), text: "" };
    }
    const buffer = Buffer.from(chunk.value).slice(0, 512);
    return {
      buffer,
      text: buffer.toString("utf8").trim().toLowerCase()
    };
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

function looksLikeMediaSample(buffer, contentType) {
  if (!buffer || buffer.length < 4) {
    return false;
  }

  const normalizedType = String(contentType || "").toLowerCase();
  if (buffer[0] === 0x1a && buffer[1] === 0x45 && buffer[2] === 0xdf && buffer[3] === 0xa3) {
    return true;
  }
  if (buffer.includes(Buffer.from("ftyp"), 4) || buffer.includes(Buffer.from("moov"), 4) || buffer.includes(Buffer.from("mdat"), 4)) {
    return true;
  }
  if (buffer[0] === 0x47 && (buffer.length < 189 || buffer[188] === 0x47)) {
    return true;
  }
  if (buffer.subarray(0, 4).toString("ascii") === "RIFF") {
    return true;
  }
  if ((normalizedType.startsWith("video/") || normalizedType.includes("octet-stream"))
    && !/^[\s\x00-\x7f]*$/.test(buffer.subarray(0, Math.min(buffer.length, 64)).toString("latin1"))) {
    return true;
  }
  return false;
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
    if (looksLikeBadProbeBody(sample.text, contentType)) {
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

    const mediaTypeLooksUsable = String(contentType || "").toLowerCase().startsWith("video/")
      || String(contentType || "").toLowerCase().includes("octet-stream");
    if (!mediaTypeLooksUsable && !looksLikeMediaSample(sample.buffer, contentType)) {
      return { ok: false, reason: `no media bytes ${contentType || "unknown"}` };
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
  const upstreamType = upstreamResponse && upstreamResponse.headers.get("content-type");
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

function syntheticHeadersForStream(stream) {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "X-Emby-Doom-Proxied": "1",
    "Accept-Ranges": "bytes",
    "Content-Type": inferContentType(stream, null)
  };

  const filename = inferFilename(stream);
  if (filename) {
    headers["Content-Disposition"] = `inline; filename="${filename}"`;
  }

  return headers;
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

async function readChunkWithTimeout(reader, timeoutMs, label) {
  let timeout;
  const timeoutPromise = new Promise((_, reject) => {
    timeout = setTimeout(() => reject(new Error(`${label} timed out after ${timeoutMs}ms`)), timeoutMs);
  });

  try {
    return await Promise.race([
      reader.read(),
      timeoutPromise
    ]);
  } finally {
    clearTimeout(timeout);
  }
}

function mediaSampleText(buffer) {
  return Buffer.from(buffer || Buffer.alloc(0))
    .slice(0, 512)
    .toString("utf8")
    .trim()
    .toLowerCase();
}

async function writeResponseChunk(response, buffer) {
  if (!buffer || buffer.length === 0 || response.destroyed || response.writableEnded) {
    return false;
  }

  if (response.write(buffer)) {
    return true;
  }

  await new Promise((resolve) => {
    const cleanup = () => {
      response.off("drain", onDrain);
      response.off("close", onClose);
      response.off("error", onClose);
    };
    const onDrain = () => {
      cleanup();
      resolve();
    };
    const onClose = () => {
      cleanup();
      resolve();
    };
    response.once("drain", onDrain);
    response.once("close", onClose);
    response.once("error", onClose);
  });
  return !response.destroyed && !response.writableEnded;
}

async function readInitialMediaBuffer(reader, contentType) {
  const chunks = [];
  let totalBytes = 0;

  while (totalBytes < FIRST_MEDIA_BUFFER_BYTES) {
    const read = await readChunkWithTimeout(reader, FIRST_CHUNK_TIMEOUT_MS, "first media chunk");
    if (read.done || !read.value || read.value.length === 0) {
      break;
    }

    const chunk = Buffer.from(read.value);
    chunks.push(chunk);
    totalBytes += chunk.length;

    const sample = Buffer.concat(chunks, Math.min(totalBytes, 4096));
    const text = mediaSampleText(sample);
    if (looksLikeBadProbeBody(text, contentType)) {
      throw new Error(`Provider sent non-media body ${contentType || "unknown"}`);
    }
    if (looksLikeMediaSample(sample, contentType) && totalBytes >= FIRST_MEDIA_BUFFER_BYTES) {
      break;
    }
  }

  if (totalBytes === 0) {
    throw new Error("Provider closed before sending media bytes");
  }

  const buffer = Buffer.concat(chunks, totalBytes);
  const sample = buffer.subarray(0, Math.min(buffer.length, 4096));
  if (looksLikeBadProbeBody(mediaSampleText(sample), contentType)) {
    throw new Error(`Provider sent non-media body ${contentType || "unknown"}`);
  }
  if (!looksLikeMediaSample(sample, contentType)) {
    throw new Error(`Provider first bytes are not playable media ${contentType || "unknown"}`);
  }
  if (buffer.length < FIRST_MEDIA_BUFFER_BYTES) {
    throw new Error(`Provider only sent ${buffer.length} initial bytes before stalling`);
  }

  return buffer;
}

async function proxySelectedStream(request, response, stream) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), UPSTREAM_OPEN_TIMEOUT_MS);
  let clientClosed = false;
  response.on("close", () => {
    if (!response.writableEnded) {
      clientClosed = true;
    }
    if (clientClosed && !controller.signal.aborted) {
      controller.abort();
    }
  });

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

  if (request.method === "HEAD" || !upstreamResponse.body) {
    writeProxyHeaders(response, upstreamResponse, stream);
    response.end();
    return;
  }

  const reader = upstreamResponse.body.getReader();
  let bytesSent = 0;
  let headersCommitted = false;

  try {
    const contentType = upstreamResponse.headers.get("content-type") || "";
    const firstBuffer = await readInitialMediaBuffer(reader, contentType);

    writeProxyHeaders(response, upstreamResponse, stream);
    headersCommitted = true;

    const wroteFirstChunk = await writeResponseChunk(response, firstBuffer);
    if (!wroteFirstChunk) {
      throw new Error("Client closed before first media bytes were delivered");
    }
    bytesSent += firstBuffer.length;
    console.log(`[Emby] Opened ${stream.name}; firstBuffer=${firstBuffer.length} bytes`);

    while (true) {
      const read = await reader.read();
      if (read.done) {
        break;
      }
      const chunk = Buffer.from(read.value);
      const wroteChunk = await writeResponseChunk(response, chunk);
      if (!wroteChunk) {
        break;
      }
      bytesSent += chunk.length;
    }

    if (!response.writableEnded && !response.destroyed) {
      response.end();
    }
  } catch (error) {
    if (!controller.signal.aborted) {
      controller.abort();
    }
    await reader.cancel().catch(() => {});

    if (clientClosed || error.name === "AbortError" || error.code === "ABORT_ERR" || error.code === "ERR_STREAM_PREMATURE_CLOSE") {
      if (!headersCommitted && bytesSent === 0) {
        throw new Error("Client closed before provider delivered media bytes");
      }
      console.log(`[Emby] Client closed stream for ${stream.name}; bytesSent=${bytesSent}`);
      return;
    }
    throw error;
  }
}

async function proxyFirstWorkingStream(request, response, rankedStreams) {
  const errors = [];

  for (const stream of rankedStreams) {
    try {
      console.log(`[Emby] Trying ${stream.name}`);
      await proxySelectedStream(request, response, stream);
      return stream;
    } catch (error) {
      const message = error.name === "AbortError"
        ? `Timed out opening provider after ${UPSTREAM_OPEN_TIMEOUT_MS}ms`
        : (error.message || String(error));
      errors.push(`${stream.name}: ${message}`);
      console.log(`[Emby] Skipped ${stream.name}: ${message}`);
      if (response.headersSent) {
        return stream;
      }
    }
  }

  response.writeHead(502, {
    "Access-Control-Allow-Origin": "*",
    "Content-Type": "text/plain; charset=utf-8"
  });
  response.end(`No provider stream opened in time.\n${errors.slice(0, 8).join("\n")}`);
  return null;
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
      console.log(`[Emby] Trying cached ${cachedStream.name}`);
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
  let validation = { validated: [], errors: [] };
  let rankedStreams = [];
  for (const fallback of profileFallbacks(profile)) {
    rankedStreams = rankStreams(streams.filter(fallback), profile);
    if (rankedStreams.length === 0) {
      continue;
    }
    validation = await validateRankedStreams(rankedStreams, Math.max(0, slot - 1));
    if (validation.validated.length > 0) {
      break;
    }
  }
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

  console.log(`[Emby] ${streamRequest.type} ${streamRequest.id} profile=${profile} slot=${slot} -> ${selected.name}`);

  if (mode === "redirect") {
    setCachedStream(cacheKey, selected);
    response.writeHead(302, {
      Location: selected.url,
      "Access-Control-Allow-Origin": "*"
    });
    response.end();
    return;
  }

  if (request.method === "HEAD") {
    setCachedStream(cacheKey, selected);
    response.writeHead(200, syntheticHeadersForStream(selected));
    response.end();
    return;
  }

  const openedStream = await proxyFirstWorkingStream(request, response, validation.validated.slice(selectedIndex));
  if (openedStream) {
    setCachedStream(cacheKey, openedStream);
  }
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

  match = pathname.match(/^\/emby\/movie\/(tt\d+)(?:\/[^/]+\.(?:mkv|mp4|webm))?$/i);
  if (match) {
    return {
      type: "movie",
      id: match[1],
      searchParams
    };
  }

  match = pathname.match(/^\/emby\/series\/(tt\d+)\/(\d+)\/(\d+)(?:\/[^/]+\.(?:mkv|mp4|webm))?$/i);
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
