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
const FIRST_MEDIA_BUFFER_BYTES = Number(process.env.FIRST_MEDIA_BUFFER_BYTES || 4096);
const SEEK_PROBE_TIMEOUT_MS = Number(process.env.SEEK_PROBE_TIMEOUT_MS || 6000);
const SYNTHETIC_HEAD_1080_BYTES = Number(process.env.SYNTHETIC_HEAD_1080_BYTES || 12 * 1024 ** 3);
const SYNTHETIC_HEAD_4K_BYTES = Number(process.env.SYNTHETIC_HEAD_4K_BYTES || 45 * 1024 ** 3);
const EMBY_RESOLVE_TIMEOUT_MS = Number(process.env.EMBY_RESOLVE_TIMEOUT_MS || 32000);
const EMBY_PROVIDER_TIMEOUT_MS = Number(process.env.EMBY_PROVIDER_TIMEOUT_MS || 30000);
const EMBY_MIN_CANDIDATES = Number(process.env.EMBY_MIN_CANDIDATES || 12);
const EMBY_VALIDATE_CANDIDATES = Number(process.env.EMBY_VALIDATE_CANDIDATES || 10);
const EMBY_VALIDATE_CONCURRENCY = Number(process.env.EMBY_VALIDATE_CONCURRENCY || 8);
const STREAM_CACHE_TTL_MS = Number(process.env.STREAM_CACHE_TTL_MS || 45000);
const EMBY_DEFAULT_MODE = String(process.env.EMBY_DEFAULT_MODE || "proxy").toLowerCase();
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
const EMBY_FAST_PROVIDER_IDS = String(process.env.EMBY_FAST_PROVIDER_IDS || [
  "moviebox",
  "movieblast"
].join(","))
  .split(",")
  .map((provider) => provider.trim())
  .filter(Boolean);
const EMBY_SLOW_PROVIDER_IDS = String(process.env.EMBY_SLOW_PROVIDER_IDS || [
  "flix_streams_emby",
  "flix_streams_vegamovies"
].join(","))
  .split(",")
  .map((provider) => provider.trim())
  .filter(Boolean);
const EMBY_FALLBACK_PROVIDER_IDS = String(process.env.EMBY_FALLBACK_PROVIDER_IDS || [
  "hdhub4u_murph",
  "hdhub4u_yoruix",
  "hdhub4u",
  "hindmoviez",
  "streamflix",
  "moviesdrive",
  "4khdhub_murph",
  "4khdhub_yoruix",
  "4khdhub",
  "4khdhubtv"
].join(","))
  .split(",")
  .map((provider) => provider.trim())
  .filter(Boolean);
const EMBY_WAIT_PROVIDER_IDS = String(process.env.EMBY_WAIT_PROVIDER_IDS || [
  "flix_streams_emby",
  "flix_streams_vegamovies"
].join(","))
  .split(",")
  .map((provider) => provider.trim())
  .filter(Boolean);
const streamCache = new Map();
const laneResolvePromises = new Map();
const prewarmPromises = new Map();

const PLAYBACK_LANES = [
  {
    name: "quick",
    providerIds: EMBY_PROVIDER_IDS,
    waitProviderIds: [],
    resolveTimeoutMs: Number(process.env.EMBY_QUICK_RESOLVE_TIMEOUT_MS || 7000),
    providerTimeoutMs: Number(process.env.EMBY_QUICK_PROVIDER_TIMEOUT_MS || 7000),
    minCandidates: Number(process.env.EMBY_QUICK_MIN_CANDIDATES || 1),
    validateCandidates: Number(process.env.EMBY_QUICK_VALIDATE_CANDIDATES || 4)
  },
  {
    name: "fast",
    providerIds: EMBY_FAST_PROVIDER_IDS,
    waitProviderIds: [],
    resolveTimeoutMs: Number(process.env.EMBY_FAST_RESOLVE_TIMEOUT_MS || 9000),
    providerTimeoutMs: Number(process.env.EMBY_FAST_PROVIDER_TIMEOUT_MS || 8000),
    minCandidates: Number(process.env.EMBY_FAST_MIN_CANDIDATES || 4),
    validateCandidates: Number(process.env.EMBY_FAST_VALIDATE_CANDIDATES || 6)
  },
  {
    name: "flix",
    providerIds: EMBY_SLOW_PROVIDER_IDS,
    waitProviderIds: EMBY_SLOW_PROVIDER_IDS,
    resolveTimeoutMs: Number(process.env.EMBY_FLIX_RESOLVE_TIMEOUT_MS || 34000),
    providerTimeoutMs: Number(process.env.EMBY_FLIX_PROVIDER_TIMEOUT_MS || 30000),
    minCandidates: Number(process.env.EMBY_FLIX_MIN_CANDIDATES || 8),
    validateCandidates: Number(process.env.EMBY_FLIX_VALIDATE_CANDIDATES || 12)
  },
  {
    name: "fallback",
    providerIds: EMBY_FALLBACK_PROVIDER_IDS,
    waitProviderIds: [],
    resolveTimeoutMs: Number(process.env.EMBY_FALLBACK_RESOLVE_TIMEOUT_MS || 18000),
    providerTimeoutMs: Number(process.env.EMBY_FALLBACK_PROVIDER_TIMEOUT_MS || 14000),
    minCandidates: Number(process.env.EMBY_FALLBACK_MIN_CANDIDATES || 10),
    validateCandidates: Number(process.env.EMBY_FALLBACK_VALIDATE_CANDIDATES || 14)
  }
].filter((lane) => lane.providerIds.length > 0);

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
  const isFlixEmby = text.includes("emb |") || text.includes("flix-streams emby") || text.includes("media library") || text.includes("media lib");
  const isVegaMovies = text.includes("vg |") || text.includes("vegamovies");
  const isFlixNest = text.includes("fn |") || text.includes("flixnest") || text.includes("debrid vault");

  if (text.includes("hindi")) score += 700;
  if (text.includes("dual")) score += 180;
  if (text.includes("multi")) score += 120;
  if (!text.includes("hindi") && !isFlixEmby) score -= 500;

  if (hasProxyHeaders(stream)) score -= 90;
  else score += 220;
  if (text.includes("web-dl") || text.includes("webdl")) score += 160;
  if (text.includes("mp4") || /\.mp4(?:[?#].*)?$/i.test(stream.url)) score += 180;
  if (text.includes("x264") || text.includes("h264")) score += 80;
  if (text.includes("ddp") || text.includes("aac")) score += 45;

  if (host.includes("r2.dev")) score += 120;
  if (host.includes("wasabisys.com")) score += 100;
  if (host.includes("diskcdn.buzz")) score += 80;
  if (host.includes("moviebox")) score += 80;
  if (isFlixNest) score += 950;
  if (isFlixEmby) score += 900;
  if (isVegaMovies) score += 500;
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
  if (profile === "4k") {
    return [
      (stream) => {
        const text = streamText(stream);
        const gb = streamSizeBytes(stream) / (1024 ** 3);
        return has4kQuality(text)
          && (!gb || gb <= 45)
          && !text.includes("remux")
          && !text.includes("truehd")
          && !text.includes("dolby vision");
      },
      (stream) => has1080Quality(streamText(stream)),
      (stream) => has720Quality(streamText(stream))
    ];
  }
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

function rankStreams(streams, profile, enforceProfile = true) {
  return streams
    .filter((stream) => stream
      && stream.url
      && (!enforceProfile || matchesProfile(stream, profile))
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

  if (incomingRequest.headers.range) {
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

function parseRangeHeader(value) {
  const match = String(value || "").match(/^bytes=(\d*)-(\d*)$/i);
  if (!match) {
    return null;
  }

  const start = match[1] === "" ? null : Number(match[1]);
  const end = match[2] === "" ? null : Number(match[2]);
  if ((start !== null && !Number.isSafeInteger(start))
    || (end !== null && !Number.isSafeInteger(end))
    || (start !== null && end !== null && end < start)) {
    return null;
  }

  return { start, end };
}

function requestedRangeLength(rangeHeader) {
  const range = parseRangeHeader(rangeHeader);
  if (!range || range.start === null || range.end === null) {
    return 0;
  }
  return range.end - range.start + 1;
}

function isMidFileRange(rangeHeader) {
  const range = parseRangeHeader(rangeHeader);
  return Boolean(range && Number.isSafeInteger(range.start) && range.start > 0);
}

function mediaContentTypeLooksUsable(contentType) {
  const normalizedType = String(contentType || "").toLowerCase();
  return normalizedType.startsWith("video/")
    || normalizedType.includes("octet-stream")
    || normalizedType.includes("matroska")
    || normalizedType.includes("mp4")
    || normalizedType.includes("mpeg")
    || normalizedType.includes("webm");
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

function clearCachedStream(cacheKey, stream = null) {
  if (!stream) {
    streamCache.delete(cacheKey);
    return;
  }

  const cached = streamCache.get(cacheKey);
  if (cached && cached.stream && cached.stream.url === stream.url) {
    streamCache.delete(cacheKey);
  }
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
  return validateRankedStreamsWithLimit(rankedStreams, desiredIndex, EMBY_VALIDATE_CANDIDATES);
}

async function validateRankedStreamsWithLimit(rankedStreams, desiredIndex, validateLimit) {
  const probeTargets = rankedStreams.slice(0, Math.max(validateLimit, desiredIndex + 1));
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
  const normalizedUpstreamType = String(upstreamType || "").toLowerCase();
  if (upstreamType
    && (normalizedUpstreamType.startsWith("video/")
      || normalizedUpstreamType.includes("matroska")
      || normalizedUpstreamType.includes("mpegurl")
      || normalizedUpstreamType.includes("mp4")
      || normalizedUpstreamType.includes("webm"))) {
    return upstreamType;
  }

  const text = streamText(stream);
  const url = String(stream.url || "").toLowerCase();
  const filename = String(stream.behaviorHints && stream.behaviorHints.filename || "").toLowerCase();
  if (text.includes(".mkv") || url.includes(".mkv") || filename.includes(".mkv")) return "video/x-matroska";
  if (text.includes(".mp4") || url.includes(".mp4") || filename.includes(".mp4")) return "video/mp4";
  if (text.includes(".webm") || url.includes(".webm") || filename.includes(".webm")) return "video/webm";
  if (text.includes(".m3u8") || url.includes(".m3u8") || filename.includes(".m3u8")) return "application/vnd.apple.mpegurl";
  if (normalizedUpstreamType.includes("force-download") || normalizedUpstreamType.includes("octet-stream")) {
    return "video/x-matroska";
  }
  if (upstreamType) return upstreamType;
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

function noStoreHeaders() {
  return {
    "Cache-Control": "no-store, no-cache, must-revalidate",
    "CDN-Cache-Control": "no-store",
    "Cloudflare-CDN-Cache-Control": "no-store",
    "Pragma": "no-cache",
    "Expires": "0"
  };
}

function writeProxyHeaders(response, upstreamResponse, stream) {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "X-Emby-Doom-Proxied": "1",
    "Accept-Ranges": "bytes",
    "Content-Type": inferContentType(stream, upstreamResponse),
    ...noStoreHeaders()
  };

  for (const name of PASS_THROUGH_HEADERS) {
    if (name === "content-type" || name === "cache-control") {
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

function hasUsefulHeadHeaders(upstreamResponse) {
  if (!upstreamResponse) {
    return false;
  }

  const contentLength = Number(upstreamResponse.headers.get("content-length") || 0);
  const contentRange = upstreamResponse.headers.get("content-range") || "";
  return contentLength > 0 || /^bytes\s+/i.test(contentRange);
}

async function proxyHeadStream(request, response, stream) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), UPSTREAM_OPEN_TIMEOUT_MS);

  try {
    let upstreamResponse = await fetch(stream.url, {
      method: "HEAD",
      headers: requestHeadersForStream(stream, request),
      redirect: "follow",
      signal: controller.signal
    });

    if (!upstreamResponse.ok || !hasUsefulHeadHeaders(upstreamResponse)) {
      const headers = requestHeadersForStream(stream, request);
      if (!headers.Range && !headers.range) {
        headers.Range = "bytes=0-0";
      }
      upstreamResponse = await fetch(stream.url, {
        method: "GET",
        headers,
        redirect: "follow",
        signal: controller.signal
      });
      if (upstreamResponse.body && typeof upstreamResponse.body.cancel === "function") {
        await upstreamResponse.body.cancel().catch(() => {});
      }
    }

    if (!upstreamResponse.ok) {
      throw new Error(`Provider returned HTTP ${upstreamResponse.status}`);
    }

    writeProxyHeaders(response, upstreamResponse, stream);
    response.end();
  } finally {
    clearTimeout(timeout);
  }
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

async function readInitialMediaBuffer(reader, contentType, rangeHeader = "") {
  const chunks = [];
  let totalBytes = 0;
  const rangeLength = requestedRangeLength(rangeHeader);
  const minimumBytes = rangeLength > 0
    ? Math.min(FIRST_MEDIA_BUFFER_BYTES, rangeLength)
    : FIRST_MEDIA_BUFFER_BYTES;
  const midFileRange = isMidFileRange(rangeHeader);

  while (totalBytes < minimumBytes) {
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
    if (looksLikeMediaSample(sample, contentType) && totalBytes >= minimumBytes) {
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
  if (midFileRange && mediaContentTypeLooksUsable(contentType)) {
    return buffer;
  }
  if (!looksLikeMediaSample(sample, contentType)) {
    throw new Error(`Provider first bytes are not playable media ${contentType || "unknown"}`);
  }
  if (buffer.length < minimumBytes) {
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
    const firstBuffer = await readInitialMediaBuffer(reader, contentType, request.headers.range || "");

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

async function proxyFirstWorkingStream(request, response, rankedStreams, options = {}) {
  const errors = [];
  const suppressFinalResponse = Boolean(options.suppressFinalResponse);
  const onAttempt = typeof options.onAttempt === "function" ? options.onAttempt : null;
  const onFailure = typeof options.onFailure === "function" ? options.onFailure : null;
  const onOpened = typeof options.onOpened === "function" ? options.onOpened : null;

  for (const stream of rankedStreams) {
    const headersAlreadySent = response.headersSent;
    try {
      console.log(`[Emby] Trying ${stream.name}`);
      if (onAttempt) {
        onAttempt(stream);
      }
      await proxySelectedStream(request, response, stream);
      if (!headersAlreadySent && response.headersSent) {
        if (onOpened) {
          onOpened(stream);
        }
        return { openedStream: stream, errors };
      }
      if (headersAlreadySent) {
        return { openedStream: null, errors, responseCommitted: true };
      }

      const message = "Stream opened but no bytes delivered to client";
      errors.push(`${stream.name}: ${message}`);
      console.log(`[Emby] Skipped ${stream.name}: ${message}`);
      if (onFailure) {
        onFailure(stream, new Error(message));
      }
    } catch (error) {
      const message = error.name === "AbortError"
        ? `Timed out opening provider after ${UPSTREAM_OPEN_TIMEOUT_MS}ms`
        : (error.message || String(error));
      errors.push(`${stream.name}: ${message}`);
      console.log(`[Emby] Skipped ${stream.name}: ${message}`);
      if (response.headersSent) {
        if (onFailure) {
          onFailure(stream, error);
        }
        return { openedStream: null, errors, responseCommitted: true };
      }
      if (onFailure) {
        onFailure(stream, error);
      }
    }
  }

  if (suppressFinalResponse) {
    return { openedStream: null, errors };
  }

  response.writeHead(502, {
    "Access-Control-Allow-Origin": "*",
    "Content-Type": "text/plain; charset=utf-8"
  });
  response.end(`No provider stream opened in time.\n${errors.slice(0, 8).join("\n")}`);
  return { openedStream: null, errors };
}

function writeSyntheticHead(response, profile, rangeHeader = "") {
  const totalBytes = profile === "4k" ? SYNTHETIC_HEAD_4K_BYTES : SYNTHETIC_HEAD_1080_BYTES;
  const range = parseRangeHeader(rangeHeader);
  const statusCode = range && range.start !== null ? 206 : 200;
  const start = range && range.start !== null ? range.start : 0;
  const end = range && range.end !== null ? Math.min(range.end, totalBytes - 1) : totalBytes - 1;
  const contentLength = statusCode === 206 ? Math.max(0, end - start + 1) : totalBytes;
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "X-Emby-Doom-Proxied": "1",
    "Accept-Ranges": "bytes",
    "Content-Type": profile === "4k" ? "video/x-matroska" : "video/mp4",
    "Content-Length": String(contentLength),
    ...noStoreHeaders()
  };

  if (statusCode === 206) {
    headers["Content-Range"] = `bytes ${start}-${end}/${totalBytes}`;
  }

  response.writeHead(statusCode, headers);
  response.end();
}

function shouldProxyStream(stream, mode) {
  if (mode === "proxy") {
    return true;
  }
  if (mode === "redirect") {
    return false;
  }
  return hasProxyHeaders(stream);
}

function redirectToStream(response, stream) {
  response.writeHead(302, {
    Location: stream.url,
    "Access-Control-Allow-Origin": "*",
    ...noStoreHeaders()
  });
  response.end();
}

async function resolveLane(streamRequest, profile, slot, lane, fallbackFilter = null, fallbackLabel = "") {
  console.log(`[Emby] Resolve lane=${lane.name}${fallbackLabel ? ` quality=${fallbackLabel}` : ""} ${streamRequest.type} ${streamRequest.id} profile=${profile}`);
  const streams = await getStreamsFast(streamRequest.type, streamRequest.id, {
    minStreams: Math.max(lane.minCandidates, slot),
    overallTimeoutMs: lane.resolveTimeoutMs,
    providerTimeoutMs: lane.providerTimeoutMs,
    providerIds: lane.providerIds,
    waitProviderIds: lane.waitProviderIds
  });

  let lastValidation = { validated: [], errors: [] };
  const fallbackFilters = fallbackFilter ? [fallbackFilter] : profileFallbacks(profile);
  for (const fallback of fallbackFilters) {
    const rankedStreams = rankStreams(streams.filter(fallback), profile, false);
    if (rankedStreams.length === 0) {
      continue;
    }

    const validation = await validateRankedStreamsWithLimit(
      rankedStreams,
      Math.max(0, slot - 1),
      lane.validateCandidates
    );
    lastValidation = validation;
    if (validation.validated.length > 0) {
      const selectedIndex = Math.min(Math.max(slot - 1, 0), validation.validated.length - 1);
      return {
        lane,
        selectedIndex,
        selected: validation.validated[selectedIndex],
        validated: validation.validated,
        errors: validation.errors
      };
    }
  }

  return {
    lane,
    selectedIndex: -1,
    selected: null,
    validated: [],
    errors: lastValidation.errors
  };
}

async function resolveLaneCached(streamRequest, profile, slot, lane, fallbackFilter = null, fallbackLabel = "") {
  const key = `${streamRequest.type}:${streamRequest.id}:${profile}:${slot}:${lane.name}:${fallbackLabel || "all"}`;
  if (laneResolvePromises.has(key)) {
    console.log(`[Emby] Join in-flight resolve ${key}`);
    return laneResolvePromises.get(key);
  }

  const promise = resolveLane(streamRequest, profile, slot, lane, fallbackFilter, fallbackLabel)
    .finally(() => {
      laneResolvePromises.delete(key);
    });
  laneResolvePromises.set(key, promise);
  return promise;
}

async function openFromPlaybackLane(request, response, streamRequest, profile, slot, lane, cacheKey, mode, fallbackFilter = null, fallbackLabel = "") {
  const result = await resolveLaneCached(streamRequest, profile, slot, lane, fallbackFilter, fallbackLabel);
  if (!result.selected) {
    console.log(`[Emby] Lane ${lane.name}${fallbackLabel ? ` ${fallbackLabel}` : ""} found no playable candidate`);
    return { openedStream: null, errors: result.errors };
  }

  console.log(`[Emby] ${streamRequest.type} ${streamRequest.id} profile=${profile} slot=${slot} lane=${lane.name}${fallbackLabel ? ` quality=${fallbackLabel}` : ""} -> ${result.selected.name}`);
  setCachedStream(cacheKey, result.selected);

  if (!shouldProxyStream(result.selected, mode)) {
    console.log(`[Emby] Redirecting ${result.selected.name}`);
    redirectToStream(response, result.selected);
    return {
      openedStream: result.selected,
      errors: result.errors
    };
  }

  const opened = await proxyFirstWorkingStream(request, response, result.validated.slice(result.selectedIndex), {
    suppressFinalResponse: true,
    onAttempt: (stream) => setCachedStream(cacheKey, stream),
    onFailure: (stream) => clearCachedStream(cacheKey, stream),
    onOpened: (stream) => setCachedStream(cacheKey, stream)
  });
  return {
    openedStream: opened.openedStream,
    errors: [...result.errors, ...opened.errors]
  };
}

async function resolveBestStreamForPlayback(streamRequest, profile, slot) {
  const allErrors = [];
  const fallbackFilters = profileFallbacks(profile);
  for (let fallbackIndex = 0; fallbackIndex < fallbackFilters.length; fallbackIndex += 1) {
    const fallbackFilter = fallbackFilters[fallbackIndex];
    const fallbackLabel = `${fallbackIndex + 1}/${fallbackFilters.length}`;
    for (const lane of PLAYBACK_LANES) {
      const result = await resolveLaneCached(streamRequest, profile, slot, lane, fallbackFilter, fallbackLabel);
      allErrors.push(...result.errors);
      if (result.selected) {
        return {
          selected: result.selected,
          errors: allErrors,
          lane,
          fallbackLabel
        };
      }
    }
  }

  return { selected: null, errors: allErrors, lane: null, fallbackLabel: "" };
}

async function handleHeadPlayback(request, response, streamRequest, profile, slot, mode, cacheKey, cachedStream) {
  if (cachedStream) {
    console.log(`[Emby] HEAD cache hit ${streamRequest.type} ${streamRequest.id} profile=${profile} slot=${slot} -> ${cachedStream.name}`);
    if (mode === "redirect") {
      redirectToStream(response, cachedStream);
      return;
    }
    try {
      await proxyHeadStream(request, response, cachedStream);
      return;
    } catch (error) {
      clearCachedStream(cacheKey, cachedStream);
      console.log(`[Emby] HEAD cached stream failed: ${error.message || error}`);
      if (response.headersSent) {
        return;
      }
    }
  }

  const result = await resolveBestStreamForPlayback(streamRequest, profile, slot);
  if (result.selected) {
    console.log(`[Emby] HEAD resolved ${streamRequest.type} ${streamRequest.id} profile=${profile} slot=${slot} -> ${result.selected.name}`);
    if (mode === "redirect") {
      redirectToStream(response, result.selected);
      return;
    }
    await proxyHeadStream(request, response, result.selected);
    return;
  }

  response.writeHead(404, {
    "Access-Control-Allow-Origin": "*",
    "Content-Type": "text/plain; charset=utf-8",
    ...noStoreHeaders()
  });
  response.end(`No seekable streams found for ${streamRequest.type} ${streamRequest.id}\n${result.errors.slice(0, 12).join("\n")}`);
}

function triggerPrewarm(streamRequest, profile, slot, cacheKey) {
  if (getCachedStream(cacheKey) || prewarmPromises.has(cacheKey)) {
    return;
  }

  const promise = resolveBestStreamForPlayback(streamRequest, profile, slot)
    .then((result) => {
      if (result.selected) {
        setCachedStream(cacheKey, result.selected);
        console.log(`[Emby] Prewarmed ${streamRequest.type} ${streamRequest.id} profile=${profile} slot=${slot} -> ${result.selected.name}`);
      } else {
        console.log(`[Emby] Prewarm found no stream for ${streamRequest.type} ${streamRequest.id} profile=${profile}`);
      }
    })
    .catch((error) => {
      console.log(`[Emby] Prewarm failed ${streamRequest.type} ${streamRequest.id}: ${error.message || error}`);
    })
    .finally(() => {
      prewarmPromises.delete(cacheKey);
    });
  prewarmPromises.set(cacheKey, promise);
}

async function handleEmbyPlayback(request, response, streamRequest) {
  const profile = String(streamRequest.searchParams.get("profile") || "1080p").toLowerCase();
  const slot = Number.parseInt(streamRequest.searchParams.get("slot") || "1", 10) || 1;
  const mode = String(streamRequest.searchParams.get("mode") || EMBY_DEFAULT_MODE).toLowerCase();
  const cacheKey = cacheKeyForRequest(streamRequest, profile, slot);
  const cachedStream = getCachedStream(cacheKey);

  if (request.method === "HEAD") {
    console.log(`[Emby] Fast HEAD ${streamRequest.type} ${streamRequest.id} profile=${profile} slot=${slot}`);
    writeSyntheticHead(response, profile, request.headers.range || "");
    return;
  }

  if (cachedStream) {
    console.log(`[Emby] Cache hit ${streamRequest.type} ${streamRequest.id} profile=${profile} slot=${slot} -> ${cachedStream.name}`);
    if (!shouldProxyStream(cachedStream, mode)) {
      console.log(`[Emby] Redirecting cached ${cachedStream.name}`);
      redirectToStream(response, cachedStream);
      return;
    }
    try {
      console.log(`[Emby] Trying cached ${cachedStream.name}`);
      await proxySelectedStream(request, response, cachedStream);
      return;
    } catch (error) {
      clearCachedStream(cacheKey, cachedStream);
      console.log(`[Emby] Cached stream failed: ${error.message || error}`);
      if (response.headersSent) {
        return;
      }
    }
  }

  const allErrors = [];
  const fallbackFilters = profileFallbacks(profile);
  for (let fallbackIndex = 0; fallbackIndex < fallbackFilters.length; fallbackIndex += 1) {
    const fallbackFilter = fallbackFilters[fallbackIndex];
    const fallbackLabel = `${fallbackIndex + 1}/${fallbackFilters.length}`;
    for (const lane of PLAYBACK_LANES) {
      if (mode === "redirect") {
        const result = await resolveLaneCached(streamRequest, profile, slot, lane, fallbackFilter, fallbackLabel);
        allErrors.push(...result.errors);
        if (result.selected) {
          setCachedStream(cacheKey, result.selected);
          redirectToStream(response, result.selected);
          return;
        }
        continue;
      }

      const result = await openFromPlaybackLane(request, response, streamRequest, profile, slot, lane, cacheKey, mode, fallbackFilter, fallbackLabel);
      allErrors.push(...result.errors);
      if (result.openedStream) {
        setCachedStream(cacheKey, result.openedStream);
        return;
      }
      if (response.headersSent) {
        return;
      }
    }
  }

  response.writeHead(404, {
    "Access-Control-Allow-Origin": "*",
    "Content-Type": "text/plain; charset=utf-8"
  });
  response.end(`No seekable streams found for ${streamRequest.type} ${streamRequest.id}\n${allErrors.slice(0, 12).join("\n")}`);
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
    providerIds: EMBY_PROVIDER_IDS,
    waitProviderIds: EMBY_WAIT_PROVIDER_IDS
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
    waitProviderIds: EMBY_WAIT_PROVIDER_IDS,
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
