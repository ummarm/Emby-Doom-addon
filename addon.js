"use strict";

const fs = require("fs");
const path = require("path");

const ROOT = __dirname;
const TMDB_API_KEY = process.env.TMDB_API_KEY || "439c478a771f35c05022f9feabcca01c";
const DEFAULT_TIMEOUT_MS = Number(process.env.PROVIDER_TIMEOUT_MS || 45000);
const STREAM_PROBE_TIMEOUT_MS = Number(process.env.STREAM_PROBE_TIMEOUT_MS || 8000);
const STREAM_PROBE_CONCURRENCY = Number(process.env.STREAM_PROBE_CONCURRENCY || 6);

const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, "manifest.json"), "utf8"));
const providerRegistry = JSON.parse(fs.readFileSync(path.join(ROOT, "providers.json"), "utf8"));

const providerEntries = providerRegistry.scrapers
  .filter((provider) => provider.enabled)
  .map((provider) => ({
    id: provider.id,
    name: provider.name,
    modulePath: path.join(ROOT, provider.filename),
    getStreams: null
  }));

function loadProvider(provider) {
  if (!provider.getStreams) {
    provider.getStreams = require(provider.modulePath).getStreams;
  }

  if (typeof provider.getStreams !== "function") {
    throw new Error(`${provider.name} does not export getStreams`);
  }

  return provider.getStreams;
}

function parseStremioId(type, id) {
  const parts = String(id || "").split(":");
  const imdbId = parts[0];

  if (!/^tt\d+$/i.test(imdbId)) {
    return null;
  }

  if (type === "series") {
    const season = Number(parts[1]);
    const episode = Number(parts[2]);
    if (!Number.isInteger(season) || !Number.isInteger(episode)) {
      return null;
    }
    return { imdbId, type: "series", mediaType: "tv", season, episode };
  }

  if (type === "movie") {
    return { imdbId, type: "movie", mediaType: "movie", season: null, episode: null };
  }

  return null;
}

async function resolveTmdbId(imdbId, mediaType) {
  const resultsKey = mediaType === "tv" ? "tv_results" : "movie_results";
  const url = new URL(`https://api.themoviedb.org/3/find/${encodeURIComponent(imdbId)}`);
  url.searchParams.set("api_key", TMDB_API_KEY);
  url.searchParams.set("external_source", "imdb_id");

  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
      "User-Agent": "Doom-addon Stremio Addon"
    }
  });

  if (!response.ok) {
    throw new Error(`TMDB lookup failed with ${response.status}`);
  }

  const payload = await response.json();
  const match = payload[resultsKey] && payload[resultsKey][0];
  return match ? String(match.id) : null;
}

function qualityRank(value) {
  const text = String(value || "").toLowerCase();
  if (text.includes("2160") || text.includes("4k")) return 5;
  if (text.includes("1440") || text.includes("2k")) return 4;
  if (text.includes("1080")) return 3;
  if (text.includes("720")) return 2;
  if (text.includes("480")) return 1;
  return 0;
}

function normalizeHeaders(headers) {
  if (!headers || typeof headers !== "object") {
    return null;
  }

  return Object.fromEntries(
    Object.entries(headers)
      .filter(([, value]) => value !== undefined && value !== null && value !== "")
      .map(([key, value]) => [key, String(value)])
  );
}

function looksWebReady(url) {
  return /^https:\/\//i.test(url) && /\.mp4(?:[?#].*)?$/i.test(url);
}

function looksLikeHls(url, contentType = "") {
  const normalizedUrl = String(url || "").toLowerCase();
  const normalizedType = String(contentType || "").toLowerCase();
  return normalizedUrl.includes(".m3u8")
    || normalizedType.includes("mpegurl")
    || normalizedType.includes("application/x-mpegurl")
    || normalizedType.includes("vnd.apple.mpegurl");
}

function isKnownClientBoundUrl(url) {
  try {
    const parsed = new URL(url);
    return /^ddl\d*$/i.test(parsed.hostname.split(".")[0] || "")
      && parsed.hostname.toLowerCase().endsWith(".workers.dev");
  } catch {
    return false;
  }
}

function looksLikeErrorDocument(contentType, sampleText = "") {
  const normalizedType = String(contentType || "").toLowerCase();
  const sample = String(sampleText || "").trim().slice(0, 256).toLowerCase();
  return normalizedType.includes("text/html")
    || normalizedType.includes("application/json")
    || normalizedType.includes("text/plain")
    || normalizedType.includes("xml")
    || sample.startsWith("<!doctype")
    || sample.startsWith("<html")
    || sample.startsWith("{")
    || sample.includes("<title>error")
    || sample.includes("cloudflare")
    || sample.includes("access denied")
    || sample.includes("not found")
    || sample.includes("invalid link")
    || sample.includes("generate link again")
    || sample.includes("link expired");
}

function hasBoxSignature(sampleBuffer, signature) {
  if (!sampleBuffer || sampleBuffer.length < 12) {
    return false;
  }
  return sampleBuffer.includes(Buffer.from(signature), 4);
}

function looksLikeMediaBytes(url, contentType, sampleBuffer) {
  if (!sampleBuffer || sampleBuffer.length < 4) {
    return false;
  }

  const normalizedUrl = String(url || "").toLowerCase();
  const normalizedType = String(contentType || "").toLowerCase();
  const startsWith = (hex) => sampleBuffer.subarray(0, hex.length / 2).equals(Buffer.from(hex, "hex"));

  if (startsWith("1a45dfa3")) {
    return true;
  }
  if (hasBoxSignature(sampleBuffer, "ftyp") || hasBoxSignature(sampleBuffer, "styp")) {
    return true;
  }
  if (sampleBuffer[0] === 0x47 && (sampleBuffer.length < 189 || sampleBuffer[188] === 0x47)) {
    return true;
  }
  if (sampleBuffer.subarray(0, 4).toString("ascii") === "RIFF" && sampleBuffer.subarray(8, 12).toString("ascii") === "AVI ") {
    return true;
  }

  const expectsKnownContainer = /\.(?:mkv|webm|mp4|m4v|ts|avi)(?:$|[?#])/i.test(normalizedUrl)
    || normalizedType.includes("matroska")
    || normalizedType.includes("webm")
    || normalizedType.includes("mp4")
    || normalizedType.includes("video/mp2t")
    || normalizedType.includes("avi");
  return !expectsKnownContainer && normalizedType.startsWith("video/");
}

function responseProbeResult(response, url, sample = {}) {
  if (!response || !response.ok) {
    return { ok: false };
  }

  const contentType = response.headers.get("content-type") || "";
  const sampleText = sample.text || "";
  const sampleBuffer = sample.buffer || Buffer.alloc(0);
  if (looksLikeHls(url, contentType)) {
    return { ok: !sampleText || sampleText.includes("#EXTM3U") };
  }

  if (looksLikeErrorDocument(contentType, sampleText)) {
    return { ok: false };
  }

  const acceptRanges = response.headers.get("accept-ranges") || "";
  const contentRange = response.headers.get("content-range") || "";
  return {
    ok: (response.status === 206
      || /bytes/i.test(acceptRanges)
      || /^bytes\s+/i.test(contentRange))
      && looksLikeMediaBytes(url, contentType, sampleBuffer)
  };
}

function streamRequestHeaders(stream) {
  const proxyHeaders = stream.behaviorHints
    && stream.behaviorHints.proxyHeaders
    && stream.behaviorHints.proxyHeaders.request;
  return normalizeHeaders(proxyHeaders) || {};
}

async function responseSample(response) {
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
    return { buffer, text: buffer.toString("utf8") };
  } finally {
    await reader.cancel().catch(() => {});
  }
}

async function probeStream(stream) {
  if (isKnownClientBoundUrl(stream.url)) {
    return { ok: false };
  }

  const headers = streamRequestHeaders(stream);
  const isHls = looksLikeHls(stream.url);
  const rangedHeaders = Object.assign({}, headers);
  if (!isHls && !rangedHeaders.Range && !rangedHeaders.range) {
    rangedHeaders.Range = "bytes=0-4095";
  }

  const getResponse = await withTimeout(
    fetch(stream.url, {
      method: "GET",
      headers: isHls ? headers : rangedHeaders,
      redirect: "follow"
    }),
    STREAM_PROBE_TIMEOUT_MS,
    `${stream.name} probe`
  );
  const sample = await responseSample(getResponse);
  const getProbe = responseProbeResult(getResponse, stream.url, sample);
  if (getProbe.ok) {
    return getProbe;
  }

  const headResponse = await withTimeout(
    fetch(stream.url, {
      method: "HEAD",
      headers,
      redirect: "follow"
    }),
    STREAM_PROBE_TIMEOUT_MS,
    `${stream.name} head probe`
  );
  return responseProbeResult(headResponse, stream.url);
}

async function filterPlayableStreams(streams) {
  const filtered = [];
  let nextIndex = 0;

  async function worker() {
    while (nextIndex < streams.length) {
      const stream = streams[nextIndex];
      nextIndex += 1;
      try {
        const probe = await probeStream(stream);
        if (probe.ok) {
          filtered.push(stream);
        } else {
          console.log(`[Stream probe] Rejected unplayable source: ${stream.name}`);
        }
      } catch (error) {
        console.log(`[Stream probe] Rejected ${stream.name}: ${error.message || error}`);
      }
    }
  }

  const workers = Array.from(
    { length: Math.min(STREAM_PROBE_CONCURRENCY, streams.length) },
    () => worker()
  );
  await Promise.all(workers);
  return filtered;
}

const UMBRELLA_PROVIDER_CODES = {
  "4khdhub": "4KHH DR",
  "4khdhubtv": "4KHH DR",
  "4khdhub_yoruix": "4KHH Y",
  "4khdhub_murph": "4KHH M",
  "hdhub4u": "HDHU DR",
  "hdhub4u_murph": "HDHU M",
  "hdhub4u_yoruix": "HDHU Y",
  "hindmoviez": "HM",
  "movieblast": "MBL",
  "moviebox": "MB",
  "moviesdrive": "MD",
  "streamflix": "SF"
};
const KNOWN_AUDIO_LABELS = ["Hindi", "Tamil", "Telugu", "English", "Malayalam", "Kannada", "Punjabi"];

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
  if (!stream || typeof stream !== "object") {
    return 0;
  }

  return parseSizeToBytes(stream.behaviorHints && stream.behaviorHints.videoSize)
    || parseSizeToBytes(stream.videoSize)
    || parseSizeToBytes(stream.size)
    || parseSizeToBytes(stream.description)
    || parseSizeToBytes(stream.title)
    || parseSizeToBytes(stream.name);
}

function streamQualityLabel(rawStream) {
  const text = [
    rawStream.quality,
    rawStream.name,
    rawStream.title,
    rawStream.description,
    rawStream.behaviorHints && rawStream.behaviorHints.bingeGroup
  ].filter(Boolean).join(" ");
  const match = text.match(/\b(4k|2160p|1440p|1080p|720p|480p|360p)\b/i);
  if (!match) {
    return "";
  }

  const quality = match[1].toLowerCase();
  if (quality === "4k" || quality === "2160p") {
    return "2160p";
  }
  return quality;
}

function umbrellaProviderCode(rawStream, provider) {
  return UMBRELLA_PROVIDER_CODES[provider.id] || null;
}

function audioLabelsFromText(value) {
  const text = String(value || "");
  const labels = [];
  const seen = new Set();

  for (const label of KNOWN_AUDIO_LABELS) {
    const match = new RegExp(`\\b${label}\\b`, "i").exec(text);
    if (match && !seen.has(label.toLowerCase())) {
      seen.add(label.toLowerCase());
      labels.push({ label, index: match.index });
    }
  }

  if (labels.length > 0) {
    return labels
      .sort((a, b) => a.index - b.index)
      .map((item) => item.label)
      .join(" - ");
  }

  if (/\bmulti(?:\s*audio)?\b/i.test(text)) {
    return "Multi Audio";
  }

  return "";
}

function normalizeLanguageText(value) {
  const knownAudio = audioLabelsFromText(value);
  if (knownAudio) {
    return knownAudio;
  }

  const text = String(value || "")
    .replace(/\b4KHDHub\s+Murph\b/ig, "")
    .replace(/\b4KHDHub\s+Yoruix\b/ig, "")
    .replace(/\bHDHub4u\s+Murph\b/ig, "")
    .replace(/\bD3adlyRocket\b/ig, "")
    .replace(/\bYoruix\b/ig, "")
    .replace(/\bMurph\b/ig, "")
    .replace(/\bHDHub4u\b/ig, "")
    .replace(/\b4khdhub-tv\b/ig, "")
    .replace(/\b4KHDHub\b/ig, "")
    .replace(/\bHindMoviez\b/ig, "")
    .replace(/\bMovieBlast\b/ig, "")
    .replace(/\bMovieBox\b/ig, "")
    .replace(/\bMoviesDrive\b/ig, "")
    .replace(/\bStreamflix\b/ig, "")
    .replace(/\b4K\b/ig, "")
    .replace(/\b(?:2160p|1080p|720p|480p|360p|auto)\b/ig, "")
    .replace(/\b(?:fsl|pixelserver|hubcloud|hubdrive|download|file|server)\b/ig, "")
    .replace(/[|:()[\]]/g, " ")
    .replace(/[^\p{L}\p{N}\s-]/gu, " ")
    .replace(/\s*-\s*/g, " - ")
    .replace(/^\s*-\s*|\s*-\s*$/g, "")
    .replace(/\s+/g, " ")
    .trim();

  const languages = [];
  const seen = new Set();
  for (const part of text.split(/\s+-\s+|[,/]+|\s+\|\s+/)) {
    const normalized = part.trim();
    if (!normalized || /\d/.test(normalized)) continue;
    const key = normalized.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    languages.push(normalized.replace(/\b\w/g, (char) => char.toUpperCase()));
  }

  return languages.join(" - ");
}

function umbrellaStreamName(rawStream, provider) {
  const providerCode = umbrellaProviderCode(rawStream, provider);
  if (!providerCode) {
    return null;
  }

  const sourceName = rawStream.name || "";
  const sourceTitle = rawStream.title || rawStream.description || "";
  const languageText = normalizeLanguageText(sourceName) || normalizeLanguageText(sourceTitle);
  return ["Umbrella", providerCode, streamQualityLabel(rawStream), languageText].filter(Boolean).join(" | ");
}

function shouldKeepProviderStream(rawStream, provider) {
  if (provider.id !== "movieblast") {
    return true;
  }

  return /\bhindi\b/i.test([
    rawStream.name,
    rawStream.title,
    rawStream.description,
    rawStream.quality,
    rawStream.language
  ].filter(Boolean).join(" "));
}

function nameWithQuality(name, rawStream) {
  const quality = streamQualityLabel(rawStream);
  if (!quality || new RegExp(`\\b${quality}\\b`, "i").test(String(name || ""))) {
    return name;
  }
  return [name, quality].filter(Boolean).join(" | ");
}

function normalizeStream(rawStream, provider) {
  if (!rawStream || typeof rawStream !== "object") {
    return null;
  }

  if (!shouldKeepProviderStream(rawStream, provider)) {
    return null;
  }

  const targetUrl = rawStream.url || rawStream.externalUrl;
  if (!targetUrl || typeof targetUrl !== "string") {
    return null;
  }

  const requestHeaders = normalizeHeaders(rawStream.headers);
  const quality = rawStream.quality || "";
  const nameParts = [provider.name, quality].filter(Boolean);
  const description = rawStream.description || rawStream.title || nameParts.join(" | ");
  const behaviorHints = Object.assign({}, rawStream.behaviorHints || {});
  const detectedSize = streamSizeBytes(rawStream);

  if (rawStream.fileName && !behaviorHints.filename) {
    behaviorHints.filename = rawStream.fileName;
  }
  if (detectedSize > 0 && !behaviorHints.videoSize) {
    behaviorHints.videoSize = detectedSize;
  }
  if (!behaviorHints.bingeGroup) {
    behaviorHints.bingeGroup = `doomp-${provider.id}-${String(quality || "auto").toLowerCase()}`;
  }
  if (!looksWebReady(targetUrl) || requestHeaders) {
    behaviorHints.notWebReady = true;
  }
  if (requestHeaders) {
    behaviorHints.proxyHeaders = {
      request: requestHeaders
    };
  }

  return {
    name: nameWithQuality(
      umbrellaStreamName(rawStream, provider) || rawStream.name || nameParts.join(" | ") || provider.name,
      rawStream
    ),
    title: description,
    description,
    url: targetUrl,
    behaviorHints
  };
}

function dedupeStreams(streams) {
  const seen = new Set();
  return streams.filter((stream) => {
    const key = `${stream.url}|${stream.name}|${stream.description}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

async function withTimeout(promise, ms, label) {
  let timeout;
  const timer = new Promise((_, reject) => {
    timeout = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
  });

  try {
    return await Promise.race([promise, timer]);
  } finally {
    clearTimeout(timeout);
  }
}

async function getStreams(type, id) {
  const parsed = parseStremioId(type, id);
  if (!parsed) {
    return [];
  }

  let tmdbId;
  try {
    tmdbId = await resolveTmdbId(parsed.imdbId, parsed.mediaType);
    if (!tmdbId) {
      return [];
    }
  } catch (error) {
    console.error(`[TMDB] ${error.message || error}`);
    return [];
  }

  const providerResults = await Promise.allSettled(
    providerEntries.map(async (provider) => {
      const providerGetStreams = loadProvider(provider);
      const rawStreams = await withTimeout(
        Promise.resolve(providerGetStreams(tmdbId, parsed.mediaType, parsed.season, parsed.episode)),
        DEFAULT_TIMEOUT_MS,
        provider.name
      );

      return (Array.isArray(rawStreams) ? rawStreams : [])
        .map((stream) => normalizeStream(stream, provider))
        .filter(Boolean);
    })
  );

  const streams = providerResults.flatMap((result, index) => {
    if (result.status === "fulfilled") {
      return result.value;
    }
    console.error(`[${providerEntries[index].name}] ${result.reason.message || result.reason}`);
    return [];
  });

  const playableStreams = await filterPlayableStreams(dedupeStreams(streams));
  return playableStreams.sort((a, b) => {
    const sizeA = streamSizeBytes(a);
    const sizeB = streamSizeBytes(b);
    if (sizeA && sizeB && sizeA !== sizeB) {
      return sizeA - sizeB;
    }
    if (sizeA && !sizeB) return -1;
    if (!sizeA && sizeB) return 1;

    const rankA = qualityRank(`${a.name} ${a.description}`);
    const rankB = qualityRank(`${b.name} ${b.description}`);
    return rankB - rankA;
  });
}

module.exports = {
  manifest,
  getStreams,
  parseStremioId,
  resolveTmdbId,
  normalizeStream
};
