/**
 * streamflix - Built from src/streamflix/
 * Generated: 2026-04-29T05:18:55.028Z
 */
var __async = (__this, __arguments, generator) => {
  return new Promise((resolve, reject) => {
    var fulfilled = (value) => {
      try {
        step(generator.next(value));
      } catch (e) {
        reject(e);
      }
    };
    var rejected = (value) => {
      try {
        step(generator.throw(value));
      } catch (e) {
        reject(e);
      }
    };
    var step = (x) => x.done ? resolve(x.value) : Promise.resolve(x.value).then(fulfilled, rejected);
    step((generator = generator.apply(__this, __arguments)).next());
  });
};

// src/streamflix/index.js
var TMDB_API_KEY = "439c478a771f35c05022f9feabcca01c";
var SF_BASE = "https://api.streamflix.app";
var CONFIG_URL = `${SF_BASE}/config/config-streamflixapp.json`;
var FIREBASE_DB = "https://chilflix-410be-default-rtdb.asia-southeast1.firebasedatabase.app";
var PROXY_URL = "https://script.google.com/macros/s/AKfycbzKvHoxL0rV7PGsti4EN0oNMoiFmizAmipZ2R_ZoCQeIyAC_xeXVBeI2vB2GDa4fGIYYg/exec";
var HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Referer": "https://api.streamflix.app/",
  "Accept": "application/json, text/plain, */*"
};
function getStreams(tmdbId, mediaType = "movie", season = null, episode = null) {
  return __async(this, null, function* () {
    try {
      console.log(`[StreamFlix] Request: ID=${tmdbId}, Type=${mediaType}, S=${season}, E=${episode}`);
      const mediaInfo = yield getMediaDetails(tmdbId, mediaType);
      if (!mediaInfo || !mediaInfo.title) {
        console.log("[StreamFlix] Could not resolve media details (TMDB match failed).");
        return [];
      }
      const config = yield getConfig();
      if (!config)
        return [];
      const items = yield fetchMetadata(mediaInfo.id || tmdbId, mediaInfo.title);
      if (!items || items.length === 0) {
        console.log("[StreamFlix] No matches found in StreamFlix database.");
        return [];
      }
      const allStreams = [];
      for (const item of items) {
        let streams = [];
        if (mediaType === "movie") {
          streams = yield processMovie(item, config, mediaInfo.title);
        } else {
          streams = yield processTV(item, config, season, episode, mediaInfo.title);
        }
        allStreams.push(...streams);
      }
      return allStreams.sort((a, b) => (parseInt(b.quality) || 0) - (parseInt(a.quality) || 0));
    } catch (e) {
      console.error(`[StreamFlix] Global Error: ${e.message}`);
      return [];
    }
  });
}
function getMediaDetails(id, type) {
  return __async(this, null, function* () {
    const isImdb = id.toString().startsWith("tt");
    const tmdbType = type === "tv" ? "tv" : "movie";
    try {
      if (isImdb) {
        console.log(`[StreamFlix] Mobile detected (IMDB ID: ${id}). Resolving to TMDB...`);
        const findUrl = `https://api.themoviedb.org/3/find/${id}?api_key=${TMDB_API_KEY}&external_source=imdb_id`;
        const res = yield fetch(findUrl);
        const data = yield res.json();
        const results = type === "tv" ? data.tv_results : data.movie_results;
        if (results && results.length > 0) {
          const item = results[0];
          return {
            id: item.id,
            title: type === "tv" ? item.name : item.title,
            year: (item.first_air_date || item.release_date || "").split("-")[0]
          };
        }
        return null;
      } else {
        const url = `https://api.themoviedb.org/3/${tmdbType}/${id}?api_key=${TMDB_API_KEY}`;
        const res = yield fetch(url);
        const data = yield res.json();
        return {
          id: data.id,
          title: type === "tv" ? data.name : data.title,
          year: (data.first_air_date || data.release_date || "").split("-")[0]
        };
      }
    } catch (e) {
      console.error(`[StreamFlix] TMDB Resolver Failed: ${e.message}`);
      return null;
    }
  });
}
function fetchMetadata(tmdbId, title) {
  return __async(this, null, function* () {
    if (PROXY_URL) {
      console.log(`[StreamFlix] Searching Proxy: ${title} (ID: ${tmdbId})`);
      const proxyReq = `${PROXY_URL}?tmdb=${tmdbId}&title=${encodeURIComponent(title)}`;
      const res = yield fetch(proxyReq);
      const json = yield res.json();
      return json.success ? json.data : [];
    }
    return [];
  });
}
function getConfig() {
  return __async(this, null, function* () {
    try {
      const res = yield fetch(CONFIG_URL, { headers: HEADERS });
      return yield res.json();
    } catch (e) {
      return null;
    }
  });
}
function processMovie(item, config, tmdbTitle) {
  return __async(this, null, function* () {
    const streams = [];
    const path = item.movielink;
    if (!path)
      return [];
    const langs = detectLanguages(item);
    if (config.premium) {
      config.premium.forEach((base) => {
        streams.push(createStreamObject(base + path, "1080p", langs, item, tmdbTitle));
      });
    }
    if (config.movies) {
      config.movies.forEach((base) => {
        streams.push(createStreamObject(base + path, "720p", langs, item, tmdbTitle));
      });
    }
    return streams;
  });
}
function processTV(item, config, s, e, tmdbTitle) {
  return __async(this, null, function* () {
    const streams = [];
    const movieKey = item.moviekey;
    if (!movieKey)
      return [];
    const langs = detectLanguages(item);
    try {
      const epRes = yield fetch(`${FIREBASE_DB}/Data/${movieKey}/seasons/${s}/episodes/${e - 1}.json`);
      const epData = yield epRes.json();
      if (epData && epData.link) {
        const path = epData.link;
        if (config.premium)
          config.premium.forEach((base) => streams.push(createStreamObject(base + path, "1080p", langs, item, tmdbTitle, s, e, epData.name)));
        if (config.tv)
          config.tv.forEach((base) => streams.push(createStreamObject(base + path, "720p", langs, item, tmdbTitle, s, e, epData.name)));
      }
    } catch (err) {
    }
    if (streams.length === 0 && config.premium) {
      const fallbackPath = `tv/${movieKey}/s${s}/episode${e}.mkv`;
      config.premium.forEach((base) => {
        streams.push(createStreamObject(base + fallbackPath, "720p", langs, item, tmdbTitle, s, e, "Episode " + e));
      });
    }
    return streams;
  });
}
function createStreamObject(url, quality, langs, item, tmdbTitle, s, e, epName) {
  const titleLines = [
    tmdbTitle + (item.movieyear ? ` (${item.movieyear})` : ""),
    `\u{1F4FA} ${quality}`
  ];
  if (s && e)
    titleLines.push(`\u{1F4CC} S${s}E${e} - ${epName || "Episode"}`);
  titleLines.push(`by Kabir \xB7 StreamFlix 2.0 Port`);
  return {
    name: `\u{1F3AC} StreamFlix | ${quality}`,
    title: titleLines.join("\n"),
    url,
    quality,
    headers: {
      "User-Agent": HEADERS["User-Agent"],
      "Referer": "https://api.streamflix.app/",
      "Origin": "https://api.streamflix.app"
    }
  };
}
function detectLanguages(item) {
  const title = (item.moviename || "").toLowerCase();
  const found = [];
  const map = { "hindi": "Hindi", "tamil": "Tamil", "telugu": "Telugu", "english": "English", "kannada": "Kannada", "malayalam": "Malayalam", "bengali": "Bengali" };
  for (const key in map) {
    if (title.includes(key))
      found.push(map[key]);
  }
  return found.length > 0 ? found : ["Hindi"];
}
if (typeof module !== "undefined" && module.exports) {
  module.exports = { getStreams };
} else {
  global.getStreams = getStreams;
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
