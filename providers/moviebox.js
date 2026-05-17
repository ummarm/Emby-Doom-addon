/**
 * ╔══════════════════════════════════════════════════════════════════════════════╗
 * ║                      MovieBox — Nuvio Stream Plugin                                        ║
 * ╠══════════════════════════════════════════════════════════════════════════════╣
 * ║  Source     › https://themoviebox.org                                                      ║
 * ║  Worker     › https://moviebox.s4nch1tt.workers.dev                                        ║
 * ║  Author     › Sanchit  |  TG: @S4NCHITT                                                    ║
 * ║  Project    › Murph's Streams                                                              ║
 * ║  Manifest   › https://badboysxs-morpheus.hf.space/manifest.json                            ║
 * ╠══════════════════════════════════════════════════════════════════════════════╣
 * ║  Mode       › Calls Cloudflare Worker API directly                                         ║
 * ║  Proxy      › Always uses proxy_url from worker (browser-safe, Range-ready)                ║
 * ║  Speed      › Single API call — no scraping, no Nuxt parsing                               ║
 * ╚══════════════════════════════════════════════════════════════════════════════╝
 */

'use strict';

// ─────────────────────────────────────────────────────────────────────────────
// Config
// ─────────────────────────────────────────────────────────────────────────────

var WORKER_BASE = 'https://moviebox.s4nch1tt.workers.dev';
var TAG         = '[MovieBox]';

// ─────────────────────────────────────────────────────────────────────────────
// Simple LRU Cache
// ─────────────────────────────────────────────────────────────────────────────

function Cache(max, ttl) {
  this.max = max; this.ttl = ttl; this.d = {}; this.ks = [];
}
Cache.prototype.get = function (k) {
  var e = this.d[k];
  if (!e) return undefined;
  if (Date.now() - e.t > this.ttl) { delete this.d[k]; return undefined; }
  return e.v;
};
Cache.prototype.set = function (k, v) {
  if (this.d[k]) { this.d[k] = { v: v, t: Date.now() }; return; }
  if (this.ks.length >= this.max) delete this.d[this.ks.shift()];
  this.ks.push(k);
  this.d[k] = { v: v, t: Date.now() };
};

var _cache = new Cache(300, 20 * 60 * 1000); // 20 min

// ─────────────────────────────────────────────────────────────────────────────
// Worker API call
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Fetch streams from the Cloudflare Worker.
 * Always passes proxy=WORKER_BASE so every stream has a proxy_url.
 *
 * Endpoint: /streams?tmdb_id=&type=&se=&ep=&proxy=
 * Response: { streams: [ { name, title, url, proxy_url, resolution, codec, size_mb, ... } ] }
 */
function fetchFromWorker(tmdbId, mediaType, se, ep) {
  var url = WORKER_BASE + '/streams'
    + '?tmdb_id=' + encodeURIComponent(tmdbId)
    + '&type='    + encodeURIComponent(mediaType)
    + '&proxy='   + encodeURIComponent(WORKER_BASE);

  if (mediaType === 'tv') {
    url += '&se=' + (se  != null ? se  : 1);
    url += '&ep=' + (ep  != null ? ep  : 1);
  }

  console.log(TAG + ' Worker → ' + url);

  return fetch(url, {
    headers  : { 'Accept': 'application/json', 'User-Agent': 'Nuvio/1.0' },
    redirect : 'follow',
  })
    .then(function (r) {
      if (!r.ok) throw new Error('Worker HTTP ' + r.status);
      return r.json();
    })
    .then(function (data) {
      // Worker returns { streams: [...] } or array directly
      if (Array.isArray(data))              return data;
      if (data && Array.isArray(data.streams)) return data.streams;
      return [];
    });
}

// ─────────────────────────────────────────────────────────────────────────────
// Stream Builder
// Worker already returns name/title/url/proxy_url/resolution/codec/size_mb
// We reformat into Nuvio stream objects using proxy_url as the stream URL
// ─────────────────────────────────────────────────────────────────────────────

function buildStream(s, isTv, se, ep) {
  // Always use proxy_url — worker supports Range headers, browser-safe
  var streamUrl = s.proxy_url || s.url || '';
  if (!streamUrl) return null;

  // Quality label
  var quality = 'Auto';
  if (s.resolution) {
    var m = String(s.resolution).match(/(\d+)/);
    quality = m ? m[1] + 'p' : String(s.resolution);
  }

  // Language — worker puts it in name like "MovieBox (Hindi) - 1080p"
  var lang = 'Original';
  var langMatch = (s.name || '').match(/\(([^)]+)\)/);
  if (langMatch) lang = langMatch[1];

  // ── Stream name (picker row) ───────────────────────────────────────────────
  var streamName = '📺 MovieBox | ' + quality + ' | ' + lang;

  // ── Stream title lines ────────────────────────────────────────────────────
  var titleBase = (s.title || '').split(' S0')[0].split(' S1')[0].trim(); // strip ep suffix
  var epTag = '';
  if (isTv && se != null && ep != null) {
    epTag = ' · S' + String(se).padStart(2, '0') + 'E' + String(ep).padStart(2, '0');
  }

  var lines = [];
  lines.push((titleBase || 'MovieBox') + epTag);

  var techLine = '📺 ' + quality + '  🔊 ' + lang;
  if (s.codec) techLine += '  🎞 ' + s.codec;
  if (s.format) techLine += '  [' + s.format + ']';
  lines.push(techLine);

  var metaLine = '';
  if (s.size_mb && s.size_mb > 0) metaLine += '💾 ' + s.size_mb + ' MB';
  if (s.duration_s) {
    var mins = Math.round(s.duration_s / 60);
    metaLine += (metaLine ? '  ' : '') + '⏱ ' + mins + 'min';
  }
  if (metaLine) lines.push(metaLine);

  lines.push("by Sanchit · @S4NCHITT · Murph's Streams");

  return {
    name    : streamName,
    title   : lines.join('\n'),
    url     : streamUrl,    // proxy_url from worker — Range-ready, no extra headers needed
    quality : quality,
    behaviorHints: {
      bingeGroup  : 'moviebox',
      notWebReady : false,
    },
    subtitles: [],
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// getStreams — main Nuvio export
// ─────────────────────────────────────────────────────────────────────────────

function getStreams(tmdbId, type, season, episode) {
  var mediaType = (type === 'series') ? 'tv' : (type || 'movie');
  var isTv      = mediaType === 'tv';
  var se        = isTv ? (season  ? parseInt(season)  : 1) : null;
  var ep        = isTv ? (episode ? parseInt(episode) : 1) : null;

  var cacheKey = 'mb_' + tmdbId + '_' + mediaType + '_' + se + '_' + ep;
  var cached   = _cache.get(cacheKey);
  if (cached) { console.log(TAG + ' Cache HIT: ' + cacheKey); return Promise.resolve(cached); }

  console.log(TAG + ' ► ' + tmdbId + ' | ' + mediaType + (isTv ? ' S' + se + 'E' + ep : ''));

  return fetchFromWorker(tmdbId, mediaType, se, ep)
    .then(function (rawStreams) {
      if (!rawStreams.length) {
        console.log(TAG + ' No streams from worker');
        return [];
      }

      console.log(TAG + ' Worker returned ' + rawStreams.length + ' stream(s)');

      var streams = rawStreams
        .map(function (s) { return buildStream(s, isTv, se, ep); })
        .filter(Boolean);

      // Sort highest resolution first
      streams.sort(function (a, b) {
        var pa = parseInt((a.quality || '').match(/\d+/) || [0]);
        var pb = parseInt((b.quality || '').match(/\d+/) || [0]);
        if (pb !== pa) return pb - pa;
        // Auto floats to top
        if (a.quality === 'Auto') return -1;
        if (b.quality === 'Auto') return 1;
        return 0;
      });

      console.log(TAG + ' ✔ ' + streams.length + ' stream(s) ready');
      if (streams.length) _cache.set(cacheKey, streams);
      return streams;
    })
    .catch(function (e) {
      console.error(TAG + ' Fatal: ' + e.message);
      return [];
    });
}

// ─────────────────────────────────────────────────────────────────────────────
// Export
// ─────────────────────────────────────────────────────────────────────────────

if (typeof module !== 'undefined' && module.exports) {
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
