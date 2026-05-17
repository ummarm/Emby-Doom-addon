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
  const candidates = streams
    .filter((stream) => stream && stream.url && !REJECT_WORDS.some((word) => streamText(stream).includes(word)))
    .map((stream) => ({ stream, score: qualityScore(streamText(stream), profile) }))
    .sort((a, b) => b.score - a.score);

  if (candidates.length === 0) {
    return null;
  }

  const index = Math.min(Math.max(slot - 1, 0), candidates.length - 1);
  return candidates[index].stream;
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
  request.on("close", () => controller.abort());

  const upstreamResponse = await fetch(stream.url, {
    method: request.method === "HEAD" ? "HEAD" : "GET",
    headers: requestHeadersForStream(stream, request),
    redirect: "follow",
    signal: controller.signal
  });

  if (!upstreamResponse.ok) {
    const text = await upstreamResponse.text().catch(() => "");
    response.writeHead(502, {
      "Access-Control-Allow-Origin": "*",
      "Content-Type": "text/plain; charset=utf-8"
    });
    response.end(`Provider returned HTTP ${upstreamResponse.status}\n${text.slice(0, 500)}`);
    return;
  }

  writeProxyHeaders(response, upstreamResponse);

  if (request.method === "HEAD" || !upstreamResponse.body) {
    response.end();
    return;
  }

  Readable.fromWeb(upstreamResponse.body).pipe(response);
}

async function handleEmbyPlayback(request, response, streamRequest) {
  const profile = String(streamRequest.searchParams.get("profile") || "1080p").toLowerCase();
  const slot = Number.parseInt(streamRequest.searchParams.get("slot") || "1", 10) || 1;
  const mode = String(streamRequest.searchParams.get("mode") || "proxy").toLowerCase();

  const minStreams = Math.max(1, slot);
  const streams = await getStreamsFast(streamRequest.type, streamRequest.id, { minStreams });
  const selected = pickStream(streams, profile, slot);

  if (!selected) {
    response.writeHead(404, {
      "Access-Control-Allow-Origin": "*",
      "Content-Type": "text/plain; charset=utf-8"
    });
    response.end(`No playable streams found for ${streamRequest.type} ${streamRequest.id}`);
    return;
  }

  console.log(`[Emby] ${streamRequest.type} ${streamRequest.id} profile=${profile} slot=${slot} -> ${selected.name}`);

  if (mode === "redirect") {
    response.writeHead(302, {
      Location: selected.url,
      "Access-Control-Allow-Origin": "*"
    });
    response.end();
    return;
  }

  await proxySelectedStream(request, response, selected);
}

async function handleEmbyDebug(response, streamRequest) {
  const slot = Number.parseInt(streamRequest.searchParams.get("slot") || "1", 10) || 1;
  const startedAt = Date.now();
  const streams = await getStreamsFast(streamRequest.type, streamRequest.id, {
    minStreams: Math.max(1, slot)
  });
  const body = JSON.stringify({
    type: streamRequest.type,
    id: streamRequest.id,
    elapsedMs: Date.now() - startedAt,
    count: streams.length,
    streams: streams.slice(0, 10).map((stream) => ({
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
