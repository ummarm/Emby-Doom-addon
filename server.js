"use strict";

const http = require("http");
const fs = require("fs");
const path = require("path");
const { manifest, getStreams } = require("./addon");
const { handleEmbyDebug, handleEmbyPlayback, parseEmbyPath } = require("./emby");

const PORT = Number(process.env.PORT || 7000);
const HOST = process.env.HOST || "0.0.0.0";
const ASSETS_DIR = path.join(__dirname, "assets");

function sendJson(response, statusCode, payload, cacheSeconds = 0) {
  const body = JSON.stringify(payload);
  response.writeHead(statusCode, {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "*",
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": cacheSeconds > 0 ? `public, max-age=${cacheSeconds}` : "no-store",
    "Content-Length": Buffer.byteLength(body)
  });
  response.end(body);
}

function sendText(response, statusCode, text) {
  response.writeHead(statusCode, {
    "Access-Control-Allow-Origin": "*",
    "Content-Type": "text/plain; charset=utf-8",
    "Content-Length": Buffer.byteLength(text)
  });
  response.end(text);
}

function sendFile(response, statusCode, filePath, contentType, cacheSeconds = 0) {
  const body = fs.readFileSync(filePath);
  response.writeHead(statusCode, {
    "Access-Control-Allow-Origin": "*",
    "Content-Type": contentType,
    "Cache-Control": cacheSeconds > 0 ? `public, max-age=${cacheSeconds}` : "no-store",
    "Content-Length": body.length
  });
  response.end(body);
}

function parseStreamPath(pathname) {
  const match = pathname.match(/^\/stream\/([^/]+)\/(.+)\.json$/);
  if (!match) {
    return null;
  }

  return {
    type: decodeURIComponent(match[1]),
    id: decodeURIComponent(match[2])
  };
}

const server = http.createServer(async (request, response) => {
  try {
    const url = new URL(request.url, `http://${request.headers.host || "localhost"}`);
    console.log(`[HTTP] ${request.method} ${url.pathname}${url.search}`);

    if (request.method === "OPTIONS") {
      response.writeHead(204, {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "*",
        "Access-Control-Allow-Methods": "GET, OPTIONS"
      });
      response.end();
      return;
    }

    if (request.method !== "GET" && request.method !== "HEAD") {
      sendJson(response, 405, { error: "Method not allowed" });
      return;
    }

    if (url.pathname === "/" || url.pathname === "/health") {
      sendText(
        response,
        200,
        `Doom-addon Stremio add-on is running.\nInstall URL: ${url.origin}/manifest.json\n`
      );
      return;
    }

    if (url.pathname === "/assets/umbrella-icon.png") {
      sendFile(response, 200, path.join(ASSETS_DIR, "umbrella-icon.png"), "image/png", 86400);
      return;
    }

    if (url.pathname === "/manifest.json") {
      sendJson(response, 200, manifest, 3600);
      return;
    }

    const embyRequest = parseEmbyPath(url.pathname, url.searchParams);
    if (embyRequest) {
      if (embyRequest.debug) {
        await handleEmbyDebug(response, embyRequest);
      } else {
        await handleEmbyPlayback(request, response, embyRequest);
      }
      return;
    }

    const streamRequest = parseStreamPath(url.pathname);
    if (streamRequest) {
      const streams = await getStreams(streamRequest.type, streamRequest.id);
      sendJson(response, 200, { streams }, 300);
      return;
    }

    sendJson(response, 404, { error: "Not found" });
  } catch (error) {
    console.error(error);
    sendJson(response, 500, { error: "Internal server error" });
  }
});

server.listen(PORT, HOST, () => {
  const displayHost = HOST === "0.0.0.0" ? "localhost" : HOST;
  console.log(`Doom-addon Stremio add-on listening on http://${displayHost}:${PORT}`);
});
