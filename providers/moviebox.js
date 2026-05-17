// ============================================================
//  MovieBox Multi Audio with Proxy, plugin for Nuvio
//  Author: Xyr0nX/Antonio-Ante
//  Github: https://github.com/Xyr0nX
// ============================================================

if (typeof fetch === "undefined") {
  var _https = require("https");
  var _http  = require("http");
  var _url   = require("url");
  global.fetch = function(reqUrl, opts) {
    opts = opts || {};
    var method  = (opts.method || "GET").toUpperCase();
    var body    = opts.body || null;
    var headers = Object.assign({}, opts.headers || {});
    if (body) headers["content-length"] = Buffer.byteLength(body).toString();
    return new Promise(function(resolve, reject) {
      var parsed = new _url.URL(reqUrl);
      var lib    = parsed.protocol === "https:" ? _https : _http;
      var req    = lib.request({
        hostname: parsed.hostname,
        port:     parsed.port || (parsed.protocol === "https:" ? 443 : 80),
        path:     parsed.pathname + (parsed.search || ""),
        method:   method,
        headers:  headers,
      }, function(res) {
        var chunks = [];
        res.on("data", function(c) { chunks.push(c); });
        res.on("end", function() {
          var text = Buffer.concat(chunks).toString("utf8");
          var raw  = res.headers;
          resolve({
            status: res.statusCode,
            ok:     res.statusCode >= 200 && res.statusCode < 300,
            headers: { get: function(k) { return raw[k.toLowerCase()] || null; } },
            text:    function() { return Promise.resolve(text); },
            json:    function() {
              try   { return Promise.resolve(JSON.parse(text)); }
              catch (e) { return Promise.reject(new Error("JSON: " + text.slice(0,100))); }
            },
          });
        });
      });
      req.on("error", reject);
      if (body) req.write(body);
      req.end();
    });
  };
}

var PLUGIN_ID   = "moviebox";
var PLUGIN_NAME = "MovieBox";

var WORKER_URL  = "https://xyr0nx-proxy.python-hacking19.workers.dev";

var PROXY_SERVER_URL = null;

var HOME_SECTIONS = [
  { id: "trending",    name: "Trending" },
  { id: "cinema",      name: "Trending in Cinema" },
  { id: "bollywood",   name: "Bollywood" },
  { id: "south",       name: "South Indian" },
  { id: "hollywood",   name: "Hollywood" },
  { id: "series",      name: "Top Series This Week" },
  { id: "anime",       name: "Anime" },
  { id: "korean",      name: "Korean Drama" },
  { id: "chinese",     name: "Chinese Drama" },
  { id: "western",     name: "Western TV" },
];

var MovixPlugin = {
  id:          PLUGIN_ID,
  name:        PLUGIN_NAME,
  version:     "2.0.0",
  description: "MovieBox — Movies, Series & Anime.",
  language:    "hi",
  logo:        "https://h5-static.aoneroom.com/oneroomProject/icon/moviebox-official.jpg",

  getHomeSections: function(sectionCallback) {
    HOME_SECTIONS.forEach(function(sec) {
      sectionCallback({ id: sec.id, title: sec.name, items: [] });
    });
    return Promise.resolve();
  },

  getStreams: function(tmdbId, type, season, episode) {
    var mediaType = (type === "series") ? "tv" : (type || "movie");
    var isTv      = mediaType === "tv";
    var se        = isTv ? (season  ? parseInt(season)  : 1) : 0;
    var ep        = isTv ? (episode ? parseInt(episode) : 1) : 0;

    var url = WORKER_URL + "/streams"
      + "?tmdb_id=" + encodeURIComponent(tmdbId)
      + "&type="    + encodeURIComponent(mediaType);

    if (isTv) {
      url += "&se=" + se + "&ep=" + ep;
    }

    return fetch(url, {
      headers: { "Accept": "application/json", "User-Agent": "Nuvio/1.0" },
    })
      .then(function(r) { return r.json(); })
      .then(function(data) {
        var rawStreams = Array.isArray(data) ? data : (data.streams || []);
        if (!rawStreams.length) return [];

        var streams = rawStreams.map(function(s) {
          var streamUrl = s.proxy_url || s.url || "";
          if (!streamUrl) return null;

          var fmt        = (s.format || "").toUpperCase();
          var isDash     = fmt === "DASH" || streamUrl.indexOf(".mpd") >= 0;
          var streamType = isDash ? "dash" : fmt === "MP4" ? "mp4" : "hls";


          var quality = s.resolution || "Auto";

          var lang = "Original";
          var lm   = (s.name || "").match(/\(([^)]+)\)/);
          if (lm) lang = lm[1];

          var label = PLUGIN_NAME + " (" + lang + ") - " + quality;


          var streamHeaders = s.headers || {};

          return {
            url:     streamUrl,
            quality: quality,
            type:    streamType,
            label:   label,
            title:   label,
            name:    label,
            headers: streamHeaders,
          };
        }).filter(Boolean);

        streams.sort(function(a, b) {
          var pa = parseInt((a.quality||"").match(/\d+/)||[0]);
          var pb = parseInt((b.quality||"").match(/\d+/)||[0]);
          return pb - pa;
        });

        return streams;
      })
      .catch(function(e) {
        console.error("[MovieBox] Error:", e.message);
        return [];
      });
  },
};

if (typeof module !== "undefined" && module.exports) {
  module.exports = MovixPlugin;
} else if (typeof registerPlugin === "function") {
  registerPlugin(MovixPlugin);
}

// __DOOM_SEEKABLE_VALIDATION__
var __doomProbeCache = Object.create(null);
var __doomProbeCacheTtlMs = 10 * 60 * 1000;
var __doomProbeTimeoutMs = 6 * 1000;

function __doomMergeHeaders(base, extra) {
  var merged = {};
  var key;
  for (key in base || {}) merged[key] = base[key];
  for (key in extra || {}) merged[key] = extra[key];
  return merged;
}

function __doomWithTimeout(promise, timeoutMs) {
  return new Promise(function(resolve, reject) {
    var settled = false;
    var timer = setTimeout(function() {
      if (settled) return;
      settled = true;
      reject(new Error("timeout"));
    }, timeoutMs);

    Promise.resolve(promise).then(function(value) {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(value);
    }, function(error) {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reject(error);
    });
  });
}

function __doomLooksLikeHls(url, contentType) {
  var normalizedUrl = String(url || "").toLowerCase();
  var normalizedType = String(contentType || "").toLowerCase();
  return normalizedUrl.indexOf(".m3u8") !== -1
    || normalizedType.indexOf("mpegurl") !== -1
    || normalizedType.indexOf("application/x-mpegurl") !== -1
    || normalizedType.indexOf("vnd.apple.mpegurl") !== -1;
}

function __doomBuildProbeCacheKey(stream) {
  var headers = stream && stream.headers ? stream.headers : {};
  return [
    stream && stream.url ? stream.url : "",
    headers.Referer || headers.referer || "",
    headers.Origin || headers.origin || ""
  ].join("|");
}

function __doomGetCachedProbeResult(cacheKey) {
  var entry = __doomProbeCache[cacheKey];
  if (!entry) return null;
  if (Date.now() - entry.timestamp > __doomProbeCacheTtlMs) {
    delete __doomProbeCache[cacheKey];
    return null;
  }
  return entry.ok;
}

function __doomSetCachedProbeResult(cacheKey, ok) {
  __doomProbeCache[cacheKey] = {
    ok: !!ok,
    timestamp: Date.now()
  };
}

function __doomResponseIsSeekable(response, url) {
  if (!response || !response.ok) return false;
  var headers = response.headers;
  var contentType = headers && headers.get ? headers.get("content-type") || "" : "";
  if (__doomLooksLikeHls(url, contentType)) return true;
  var acceptRanges = headers && headers.get ? headers.get("accept-ranges") || "" : "";
  var contentRange = headers && headers.get ? headers.get("content-range") || "" : "";
  return response.status === 206
    || /bytes/i.test(acceptRanges)
    || /^bytes\s+/i.test(contentRange);
}

function __doomProbeStream(stream) {
  if (!stream || !stream.url || typeof fetch !== "function") {
    return Promise.resolve(false);
  }

  var cacheKey = __doomBuildProbeCacheKey(stream);
  var cached = __doomGetCachedProbeResult(cacheKey);
  if (cached !== null) {
    return Promise.resolve(cached);
  }

  var url = stream.url;
  var isHls = __doomLooksLikeHls(url, "");
  var baseHeaders = __doomMergeHeaders({}, stream.headers || {});
  var rangedHeaders = __doomMergeHeaders({}, baseHeaders);
  if (!isHls && !rangedHeaders.Range && !rangedHeaders.range) {
    rangedHeaders.Range = "bytes=0-1";
  }

  var attempts = [
    { method: "GET", headers: isHls ? baseHeaders : rangedHeaders, redirect: "follow" },
    { method: "HEAD", headers: baseHeaders, redirect: "follow" }
  ];

  function tryAttempt(index) {
    if (index >= attempts.length) return Promise.resolve(false);
    return __doomWithTimeout(fetch(url, attempts[index]), __doomProbeTimeoutMs)
      .then(function(response) {
        if (__doomResponseIsSeekable(response, url)) return true;
        return tryAttempt(index + 1);
      })
      .catch(function() {
        return tryAttempt(index + 1);
      });
  }

  return tryAttempt(0).then(function(ok) {
    __doomSetCachedProbeResult(cacheKey, ok);
    return ok;
  });
}

function __doomFilterSeekableStreams(streams, providerLabel) {
  if (!Array.isArray(streams) || streams.length === 0) {
    return Promise.resolve([]);
  }

  return Promise.all(streams.map(function(stream) {
    return __doomProbeStream(stream)
      .then(function(ok) { return { stream: stream, ok: ok }; })
      .catch(function() { return { stream: stream, ok: false }; });
  })).then(function(results) {
    var filtered = results.filter(function(item) { return item.ok; }).map(function(item) { return item.stream; });
    var label = providerLabel || "[Doom-addon]";
    if (filtered.length === 0) {
      console.log(label + " Seekable filter kept 0/" + streams.length + " streams; returning original streams as fallback");
      return streams;
    }
    console.log(label + " Seekable filter kept " + filtered.length + "/" + streams.length + " streams");
    return filtered;
  });
}

(function() {
  if (typeof getStreams !== "function" || getStreams.__doomSeekableWrapped) {
    return;
  }

  var __doomOriginalGetStreams = getStreams;
  var __doomProviderLabel = typeof PLUGIN_TAG !== "undefined"
    ? PLUGIN_TAG
    : (typeof TAG !== "undefined" ? TAG : "[Doom-addon]");

  var __doomWrappedGetStreams = function() {
    return Promise.resolve(__doomOriginalGetStreams.apply(this, arguments))
      .then(function(streams) {
        return __doomFilterSeekableStreams(streams, __doomProviderLabel);
      })
      .catch(function(error) {
        var message = error && error.message ? error.message : String(error);
        console.error(__doomProviderLabel + " Seekable validation failed: " + message);
        return [];
      });
  };

  __doomWrappedGetStreams.__doomSeekableWrapped = true;
  getStreams = __doomWrappedGetStreams;

  if (typeof module !== "undefined" && module.exports) {
    module.exports.getStreams = getStreams;
  } else if (typeof global !== "undefined") {
    global.getStreams = getStreams;
  }
})();

// __DOOM_STREAM_NORMALIZATION__
function __doomNormalizeHeaders(headers) {
  if (!headers || typeof headers !== "object") return null;
  var normalized = {};
  var key;
  for (key in headers) {
    if (headers[key] !== undefined && headers[key] !== null && headers[key] !== "") {
      normalized[key] = String(headers[key]);
    }
  }
  return Object.keys(normalized).length ? normalized : null;
}

function __doomLooksWebReady(url) {
  var normalized = String(url || "").toLowerCase();
  return normalized.indexOf("https://") === 0
    && (normalized.indexOf(".mp4") !== -1 || normalized.indexOf("format=mp4") !== -1);
}

function __doomNormalizeStream(rawStream) {
  if (!rawStream || typeof rawStream !== "object") return null;
  var targetUrl = rawStream.url || rawStream.externalUrl;
  if (!targetUrl || typeof targetUrl !== "string") return null;

  var requestHeaders = __doomNormalizeHeaders(rawStream.headers);
  var behaviorHints = {};
  var key;
  for (key in rawStream.behaviorHints || {}) behaviorHints[key] = rawStream.behaviorHints[key];

  if (rawStream.fileName && !behaviorHints.filename) behaviorHints.filename = rawStream.fileName;
  if (typeof rawStream.size === "number" && rawStream.size > 0 && !behaviorHints.videoSize) {
    behaviorHints.videoSize = rawStream.size;
  }
  if (typeof rawStream.videoSize === "number" && rawStream.videoSize > 0 && !behaviorHints.videoSize) {
    behaviorHints.videoSize = rawStream.videoSize;
  }
  if (!behaviorHints.bingeGroup) {
    var providerId = typeof PLUGIN_TAG !== "undefined" ? PLUGIN_TAG : (typeof TAG !== "undefined" ? TAG : "doom-addon");
    behaviorHints.bingeGroup = String(providerId).replace(/[^a-z0-9]+/gi, "-").toLowerCase();
  }
  if (!__doomLooksWebReady(targetUrl) || requestHeaders) behaviorHints.notWebReady = true;
  if (requestHeaders) behaviorHints.proxyHeaders = { request: requestHeaders };

  var description = rawStream.description || rawStream.title || rawStream.name || "Doom-addon stream";
  return {
    name: rawStream.name || "Doom-addon",
    title: description,
    description: description,
    url: targetUrl,
    behaviorHints: behaviorHints
  };
}

(function() {
  if (typeof getStreams !== "function" || getStreams.__doomNormalizedWrapped) return;

  var __doomOriginalGetStreamsForNormalization = getStreams;
  var __doomNormalizedGetStreams = function() {
    return Promise.resolve(__doomOriginalGetStreamsForNormalization.apply(this, arguments))
      .then(function(streams) {
        if (!Array.isArray(streams)) return [];
        return streams.map(__doomNormalizeStream).filter(Boolean);
      });
  };

  __doomNormalizedGetStreams.__doomNormalizedWrapped = true;
  getStreams = __doomNormalizedGetStreams;

  if (typeof module !== "undefined" && module.exports) {
    module.exports.getStreams = getStreams;
  } else if (typeof global !== "undefined") {
    global.getStreams = getStreams;
  }
})();
