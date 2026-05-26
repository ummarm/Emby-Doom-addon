'use strict';const _0x425992=_0x4ea4;(function(_0x2b7bc9,_0x21a9d8){const _0x55d55e=_0x4ea4,_0x3e506c=_0x2b7bc9();while(!![]){try{const _0x4bc400=-parseInt(_0x55d55e(0x17c))/0x1*(parseInt(_0x55d55e(0x1a2))/0x2)+-parseInt(_0x55d55e(0x17a))/0x3+-parseInt(_0x55d55e(0x181))/0x4+-parseInt(_0x55d55e(0x178))/0x5*(-parseInt(_0x55d55e(0x191))/0x6)+-parseInt(_0x55d55e(0x175))/0x7+-parseInt(_0x55d55e(0x183))/0x8*(parseInt(_0x55d55e(0x182))/0x9)+parseInt(_0x55d55e(0x190))/0xa;if(_0x4bc400===_0x21a9d8)break;else _0x3e506c['push'](_0x3e506c['shift']());}catch(_0x6b8a11){_0x3e506c['push'](_0x3e506c['shift']());}}}(_0x25d7,0x696ca));var __async=(_0x33b1c5,_0x583324,_0x5b3932)=>{return new Promise((_0x41260e,_0x5480ce)=>{const _0x3e4b8d=_0x4ea4;var _0x29919b=_0x450698=>{try{_0x1a9de8(_0x5b3932['next'](_0x450698));}catch(_0x330fe9){_0x5480ce(_0x330fe9);}},_0x3d72b5=_0x2dab3a=>{try{_0x1a9de8(_0x5b3932['throw'](_0x2dab3a));}catch(_0x5319c0){_0x5480ce(_0x5319c0);}},_0x1a9de8=_0x5c4086=>_0x5c4086[_0x3e4b8d(0x1a3)]?_0x41260e(_0x5c4086[_0x3e4b8d(0x19d)]):Promise[_0x3e4b8d(0x18e)](_0x5c4086[_0x3e4b8d(0x19d)])[_0x3e4b8d(0x18b)](_0x29919b,_0x3d72b5);_0x1a9de8((_0x5b3932=_0x5b3932[_0x3e4b8d(0x173)](_0x33b1c5,_0x583324))[_0x3e4b8d(0x186)]());});},TMDB_API_KEY=_0x425992(0x17f),MURPH_BASE=_0x425992(0x179);function _0x25d7(){const _0x38dbe9=['yMvOyxzPB3jiAw50CW','DgHLBG','r0vu','ANnVBG','CMvZB2X2zq','Aw5JBhvKzxm','mJe4otG3mdb4CxvUBvG','mtmYotbjv1v5BLK','zMLSDgvY','zNvUy3rPB24','sgLUze1VDMLLihWG','p2fWAv9RzxK9','x19KB29TtM9YBwfSAxPLzfDYyxbWzwq','C2vYAwvZ','Dg9mB3DLCKnHC2u','Ahr0Chm6lY9HCgKUDgHLBw92AwvKyI5VCMCVmY8','BMfTzq','C3rHCNrZv2L0Aa','BwfW','DMfSDwu','zxHWB3j0CW','AgLUzg1VDMLL','Dw5KzwzPBMvK','Ahr0Ca','ndG2DKnoy2fq','zg9Uzq','DgL0Bgu','yxbWBhK','lMPZB24','mti5ntq2mMDmt3PIrW','C3rYzwfTCW','ywXS','mtC2mhDrzfPxwq','Ahr0Chm6lY9IywrIB3LZEhmTBw9YCgHLDxmUAgyUC3bHy2u','mte5nJq4nfb0wwvnwq','AgrODwi','mZa3nefXter5uW','Aw1KyL9Pza','AxnbCNjHEq','ndm5yZq3oge3nZfMmZvJmduWmJjMowzLywjJy2eWmwm','Bw92Awu','mJu4ndy2nfzvqwrvCq','mZG4mtD2D1jQEhG','mta0meXbvhzzzG','l3n0CMvHBs9TB3zPzs8','z2v0u3rYzwfTCW','BMv4Da','DxjS','l3n0CMvHBs9ZzxjPzxmV','tw92Awu'];_0x25d7=function(){return _0x38dbe9;};return _0x25d7();}function fetchJson(_0x30e905){return __async(this,null,function*(){const _0x771de2=_0x4ea4;try{const _0x1e0b17=yield fetch(_0x30e905,{'method':_0x771de2(0x18c)});return _0x1e0b17['ok']?yield _0x1e0b17[_0x771de2(0x18d)]():null;}catch(_0x11a702){return null;}});}function resolveMediaDetails(_0x252cb2,_0x3c9348){return __async(this,null,function*(){const _0x264ae2=_0x4ea4,_0xc983c=_0x3c9348===_0x264ae2(0x197)?'tv':_0x264ae2(0x180);let _0x95420=String(_0x252cb2)[_0x264ae2(0x19b)]('tt')?_0x252cb2:null,_0x3149ef='Movie';const _0x14a550=_0x264ae2(0x199)+_0xc983c+'/'+_0x252cb2+_0x264ae2(0x195)+TMDB_API_KEY,_0x1a023f=_0x264ae2(0x199)+_0xc983c+'/'+_0x252cb2+'/external_ids?api_key='+TMDB_API_KEY,[_0x13b7fe,_0x418055]=yield Promise[_0x264ae2(0x177)]([fetchJson(_0x14a550),fetchJson(_0x1a023f)]);return _0x13b7fe&&(_0x3149ef=_0x13b7fe[_0x264ae2(0x1a4)]||_0x13b7fe['name']||_0x264ae2(0x189)),!_0x95420&&_0x418055&&(_0x95420=_0x418055[_0x264ae2(0x17d)]),{'imdbId':_0x95420,'title':_0x3149ef};});}function isHindMovieSource(_0x5a507f){const _0x32813e=_0x425992,_0x368667=String(_0x5a507f[_0x32813e(0x19a)]||'')['toLowerCase'](),_0x239d9e=String(_0x5a507f['title']||'')[_0x32813e(0x198)](),_0x43c67e=_0x368667['includes'](_0x32813e(0x19f))||_0x239d9e[_0x32813e(0x18f)](_0x32813e(0x19f)),_0x40bb6c=!_0x368667[_0x32813e(0x18f)](_0x32813e(0x17b))&&!_0x239d9e['includes'](_0x32813e(0x17b));return _0x43c67e&&_0x40bb6c;}function getStreams(_0x55bf8f,_0x456756,_0x34f95f,_0x54a35a){return __async(this,null,function*(){const _0x5534d6=_0x4ea4,{imdbId:_0x2e7e61,title:_0x5f1553}=yield resolveMediaDetails(_0x55bf8f,_0x456756);if(!_0x2e7e61)return[];const _0x4cb4eb=_0x456756===_0x5534d6(0x197)?MURPH_BASE+_0x5534d6(0x188)+_0x2e7e61+':'+_0x34f95f+':'+_0x54a35a+_0x5534d6(0x174):MURPH_BASE+_0x5534d6(0x184)+_0x2e7e61+'.json',_0xcaf2f3=yield fetchJson(_0x4cb4eb);if(!_0xcaf2f3||!_0xcaf2f3[_0x5534d6(0x176)])return[];return _0xcaf2f3[_0x5534d6(0x176)][_0x5534d6(0x192)](isHindMovieSource)[_0x5534d6(0x19c)](_0x528b55=>{const _0x2b7338=_0x5534d6;let _0x12fb16=_0x528b55[_0x2b7338(0x187)];return _0x12fb16&&!_0x12fb16[_0x2b7338(0x19b)](_0x2b7338(0x1a1))&&(_0x12fb16=MURPH_BASE+(_0x12fb16[_0x2b7338(0x19b)]('/')?'':'/')+_0x12fb16),{'name':_0x2b7338(0x194)+_0x5f1553,'title':_0x528b55[_0x2b7338(0x1a4)]||'HindMovie\x20Stream','url':_0x12fb16,'behaviorHints':{'bingeGroup':'hind-movie-v3-refresh'}};});});}typeof module!==_0x425992(0x1a0)&&module[_0x425992(0x19e)]?module[_0x425992(0x19e)]={'getStreams':getStreams}:global[_0x425992(0x185)]=getStreams;function _0x4ea4(_0x355e2d,_0x567fa7){_0x355e2d=_0x355e2d-0x173;const _0x25d7ea=_0x25d7();let _0x4ea4f7=_0x25d7ea[_0x355e2d];if(_0x4ea4['EsBSYR']===undefined){var _0x171b9b=function(_0x427140){const _0x4cd3ec='abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789+/=';let _0x33b1c5='',_0x583324='';for(let _0x5b3932=0x0,_0x41260e,_0x5480ce,_0x29919b=0x0;_0x5480ce=_0x427140['charAt'](_0x29919b++);~_0x5480ce&&(_0x41260e=_0x5b3932%0x4?_0x41260e*0x40+_0x5480ce:_0x5480ce,_0x5b3932++%0x4)?_0x33b1c5+=String['fromCharCode'](0xff&_0x41260e>>(-0x2*_0x5b3932&0x6)):0x0){_0x5480ce=_0x4cd3ec['indexOf'](_0x5480ce);}for(let _0x3d72b5=0x0,_0x1a9de8=_0x33b1c5['length'];_0x3d72b5<_0x1a9de8;_0x3d72b5++){_0x583324+='%'+('00'+_0x33b1c5['charCodeAt'](_0x3d72b5)['toString'](0x10))['slice'](-0x2);}return decodeURIComponent(_0x583324);};_0x4ea4['FNPaaa']=_0x171b9b,_0x4ea4['dsgMAz']={},_0x4ea4['EsBSYR']=!![];}const _0x32862b=_0x25d7ea[0x0],_0x812254=_0x355e2d+_0x32862b,_0x1c9c21=_0x4ea4['dsgMAz'][_0x812254];return!_0x1c9c21?(_0x4ea4f7=_0x4ea4['FNPaaa'](_0x4ea4f7),_0x4ea4['dsgMAz'][_0x812254]=_0x4ea4f7):_0x4ea4f7=_0x1c9c21,_0x4ea4f7;}function __doomNormalizeStream(_0x5ee5ab){const _0x3cae3d=_0x425992;if(!_0x5ee5ab||!_0x5ee5ab[_0x3cae3d(0x187)])return null;return{'name':_0x5ee5ab[_0x3cae3d(0x19a)],'title':_0x5ee5ab[_0x3cae3d(0x1a4)],'url':_0x5ee5ab['url'],'behaviorHints':_0x5ee5ab[_0x3cae3d(0x18a)]};}(function(){const _0x5b2fa3=_0x425992;if(typeof getStreams!==_0x5b2fa3(0x193)||getStreams[_0x5b2fa3(0x196)])return;var _0xaa7d6f=getStreams,_0x555df3=function(){const _0x21f916=_0x5b2fa3;return Promise[_0x21f916(0x18e)](_0xaa7d6f['apply'](this,arguments))['then'](function(_0x2ca757){const _0x5865b0=_0x21f916;if(!Array[_0x5865b0(0x17e)](_0x2ca757))return[];return _0x2ca757[_0x5865b0(0x19c)](__doomNormalizeStream)[_0x5865b0(0x192)](Boolean);});};_0x555df3[_0x5b2fa3(0x196)]=!![],getStreams=_0x555df3;if(typeof module!==_0x5b2fa3(0x1a0)&&module['exports'])module[_0x5b2fa3(0x19e)][_0x5b2fa3(0x185)]=getStreams;else typeof global!==_0x5b2fa3(0x1a0)&&(global[_0x5b2fa3(0x185)]=getStreams);}());

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
