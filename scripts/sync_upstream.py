#!/usr/bin/env python3
"""Sync Doom-addon providers directly from the original upstream sources.

Doom-addon no longer treats Doom-plug as an upstream. Provider source files are
checked against the original projects, then Doom-addon-specific patches are
applied for hosted Stremio use.
"""

from __future__ import annotations

import json
import os
import re
import sys
import urllib.request
from dataclasses import dataclass
from datetime import date, datetime, timezone
from pathlib import Path
from urllib.error import HTTPError


REPO_ROOT = Path(__file__).resolve().parents[1]
PROVIDER_REGISTRY_PATH = REPO_ROOT / "providers.json"
STREMIO_MANIFEST_PATH = REPO_ROOT / "manifest.json"
PACKAGE_PATH = REPO_ROOT / "package.json"
PROVIDERS_DIR = REPO_ROOT / "providers"
ANCHOR_DATE = date(2026, 4, 20)
CADENCE_DAYS = 2
D3ADLYROCKET_UPSTREAM_RAW_BASE = "https://raw.githubusercontent.com/D3adlyRocket/All-in-One-Nuvio/main"
D3ADLYROCKET_UPSTREAM_TREE_API = "https://api.github.com/repos/D3adlyRocket/All-in-One-Nuvio/git/trees/main?recursive=1"
YORUIX_UPSTREAM_RAW_BASE = "https://raw.githubusercontent.com/yoruix/nuvio-providers/main"
YORUIX_UPSTREAM_TREE_API = "https://api.github.com/repos/yoruix/nuvio-providers/git/trees/main?recursive=1"
MURPH_MANIFEST_URL = "https://badboysxs-morpheus.hf.space/manifest.json"
ADDON_DOMAINS_URL = "https://raw.githubusercontent.com/ummarm/Doom-addon/main/domains.json"
USER_AGENT = "Doom-addon direct upstream sync"
SEEKABLE_VALIDATION_MARKER = "__DOOM_SEEKABLE_VALIDATION__"
STREAM_NORMALIZATION_MARKER = "__DOOM_STREAM_NORMALIZATION__"
SEEKABLE_VALIDATION_SNIPPET = r"""
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
"""
STREAM_NORMALIZATION_SNIPPET = r"""
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
"""


@dataclass(frozen=True)
class Provider:
    scraper_id: str
    upstream_paths: tuple[str, ...]
    local_path_str: str
    discovery_terms: tuple[str, ...] = ()
    upstream_raw_base: str = D3ADLYROCKET_UPSTREAM_RAW_BASE
    upstream_tree_api: str = D3ADLYROCKET_UPSTREAM_TREE_API

    @property
    def local_path(self) -> Path:
        return REPO_ROOT / self.local_path_str


@dataclass(frozen=True)
class ResolvedProvider:
    provider: Provider
    upstream_path: str

    @property
    def scraper_id(self) -> str:
        return self.provider.scraper_id

    @property
    def upstream_url(self) -> str:
        return f"{self.provider.upstream_raw_base}/{self.upstream_path}"


PROVIDERS = (
    Provider("4khdhub", ("providers/4khdhub.js", "providers/4khdhubtest.js"), "providers/4khdhub.js", ("4khdhub", "hubcloud")),
    Provider("4khdhubtv", ("providers/4khdhub_tv.js",), "providers/4khdhub_tv.js"),
    Provider("hdhub4u", ("providers/hdhub4u.js", "src/hdhub4u/index.js"), "providers/hdhub4u.js", ("hdhub4u",)),
    Provider("hindmoviez", ("providers/hindmoviez.js",), "providers/hindmoviez.js", ("hindmoviez",)),
    Provider("movieblast", ("providers/movieblast.js",), "providers/movieblast.js", ("movieblast",)),
    Provider("moviebox", ("providers/moviebox.js",), "providers/moviebox.js", ("moviebox",)),
    Provider("4khdhub_yoruix", ("providers/4khdhub.js",), "providers/4khdhub_yoruix.js", ("4khdhub", "hubcloud", "yoruix"), YORUIX_UPSTREAM_RAW_BASE, YORUIX_UPSTREAM_TREE_API),
    Provider("hdhub4u_yoruix", ("providers/hdhub4u.js", "src/hdhub4u/index.js"), "providers/hdhub4u_yoruix.js", ("hdhub4u", "yoruix"), YORUIX_UPSTREAM_RAW_BASE, YORUIX_UPSTREAM_TREE_API),
    Provider("moviesdrive", ("src/providers/moviesdrive.js", "providers/moviesdrive.js"), "providers/moviesdrive.js", ("moviesdrive",)),
    Provider("streamflix", ("providers/streamflix.js",), "providers/streamflix.js", ("streamflix",)),
)
MURPH_WRAPPER_IDS = {"4khdhub_murph", "hdhub4u_murph"}


def write_output(name: str, value: str) -> None:
    github_output = os.environ.get("GITHUB_OUTPUT")
    if not github_output:
        return
    with open(github_output, "a", encoding="utf-8") as fh:
        fh.write(f"{name}={value}\n")


def write_summary(lines: list[str]) -> None:
    summary_path = os.environ.get("GITHUB_STEP_SUMMARY")
    if not summary_path:
        return
    with open(summary_path, "a", encoding="utf-8") as fh:
        fh.write("\n".join(lines) + "\n")


def fetch_text(url: str) -> str:
    request = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(request, timeout=30) as response:
        return response.read().decode("utf-8")


def fetch_json(url: str, accept: str = "application/json") -> object:
    request = urllib.request.Request(
        url,
        headers={"User-Agent": USER_AGENT, "Accept": accept},
    )
    with urllib.request.urlopen(request, timeout=30) as response:
        return json.load(response)


def fetch_upstream_tree_paths(tree_api: str) -> list[str]:
    payload = fetch_json(tree_api, "application/vnd.github+json")
    tree = payload["tree"]
    return [item["path"] for item in tree if item.get("type") == "blob"]


def normalize_token(value: str) -> str:
    return re.sub(r"[^a-z0-9]+", "", value.lower())


def score_discovered_path(provider: Provider, path: str) -> int:
    normalized_path = normalize_token(path)
    normalized_name = normalize_token(Path(path).stem)
    normalized_id = normalize_token(provider.scraper_id)
    score = 0

    if normalized_name == normalized_id:
        score += 100
    elif normalized_id and normalized_id in normalized_name:
        score += 50

    for term in provider.discovery_terms:
        normalized_term = normalize_token(term)
        if not normalized_term:
            continue
        if normalized_term in normalized_name:
            score += 30
        elif normalized_term in normalized_path:
            score += 12

    if path.startswith("providers/"):
        score += 5
    elif path.startswith("src/providers/"):
        score += 3

    return score


def candidate_upstream_paths(provider: Provider, upstream_tree_paths: list[str]) -> list[str]:
    ordered: list[str] = []
    seen: set[str] = set()
    tree_set = set(upstream_tree_paths)

    for path in provider.upstream_paths:
        if path in tree_set and path not in seen:
            ordered.append(path)
            seen.add(path)

    scored_paths = [
        (score_discovered_path(provider, path), path)
        for path in upstream_tree_paths
        if path.endswith(".js")
    ]
    scored_paths.sort(key=lambda item: (-item[0], item[1]))

    for score, path in scored_paths:
        if score < 40 or path in seen:
            continue
        ordered.append(path)
        seen.add(path)

    for path in provider.upstream_paths:
        if path not in seen:
            ordered.append(path)
            seen.add(path)

    return ordered


def patch_domain_source(text: str) -> str:
    updated, count = re.subn(
        r"""(?:var|const|let)\s+DOMAINS_URL\s*=\s*["'][^"']+["'];""",
        f'var DOMAINS_URL = "{ADDON_DOMAINS_URL}";',
        text,
        count=1,
    )
    if count != 1:
        raise RuntimeError("Could not retarget DOMAINS_URL to Doom-addon domains.json")
    return updated


def patch_moviesdrive_domain_source(text: str) -> str:
    if "DOMAIN_JSON_URL" in text:
        updated, count = re.subn(
            r"""(?:var|const|let)\s+DOMAIN_JSON_URL\s*=\s*["'][^"']+["'];""",
            f'const DOMAIN_JSON_URL = "{ADDON_DOMAINS_URL}";',
            text,
            count=1,
        )
        if count != 1:
            raise RuntimeError("Could not retarget DOMAIN_JSON_URL to Doom-addon domains.json")
        old_block = """if (data && data[PROVIDER_KEY] && data[PROVIDER_KEY].url) {
          moviesDriveDomain = data[PROVIDER_KEY].url.replace(/\\/$/, "");
          domainCacheTimestamp = now;
          console.log(`[MoviesDrive] Domain set to: ${moviesDriveDomain}`);
        }
"""
        new_block = """if (data) {
          const resolvedDomain = data.Moviesdrive || (typeof data[PROVIDER_KEY] === "string" ? data[PROVIDER_KEY] : data[PROVIDER_KEY] && data[PROVIDER_KEY].url);
          if (resolvedDomain) {
            moviesDriveDomain = resolvedDomain.replace(/\\/$/, "");
            domainCacheTimestamp = now;
            console.log(`[MoviesDrive] Domain set to: ${moviesDriveDomain}`);
          }
        }
"""
        if old_block not in updated:
            raise RuntimeError("Could not adapt MoviesDrive domain reader to Doom-addon domains.json")
        return updated.replace(old_block, new_block, 1)

    return patch_domain_source(text)


def patch_yoruix_hdhub4u_source(text: str) -> str:
    return text.replace("https://search.pingora.fyi", "https://search.hdhub4u.glass")


def patch_hindmoviez_source(text: str) -> str:
    text = re.sub(
        r"// ── Cloudflare Worker proxy[\s\S]*?const DEFAULT_HEADERS = \{",
        "const DEFAULT_HEADERS = {",
        text,
        count=1,
    )
    text, call_count = re.subn(r"(:\s*)hmProxyUrl\(([^)]+)\)", r"\1\2", text)
    text, assign_count = re.subn(
        r"((?:var|const|let)\s+proxiedUrl\s*=\s*)hmProxyUrl\(([^)]+)\);",
        r"\1\2;",
        text,
    )
    return text


def patch_seekable_validation(text: str) -> str:
    if SEEKABLE_VALIDATION_MARKER in text:
        return text
    return text.rstrip("\n") + "\n\n" + SEEKABLE_VALIDATION_SNIPPET.strip("\n") + "\n"


def patch_stream_normalization(text: str) -> str:
    if STREAM_NORMALIZATION_MARKER in text:
        return text
    return text.rstrip("\n") + "\n\n" + STREAM_NORMALIZATION_SNIPPET.strip("\n") + "\n"


def transform_source(provider: Provider, text: str) -> str:
    if provider.scraper_id in {"4khdhub", "4khdhubtv", "hdhub4u", "4khdhub_yoruix", "hdhub4u_yoruix"}:
        text = patch_domain_source(text)
    elif provider.scraper_id == "moviesdrive":
        text = patch_moviesdrive_domain_source(text)
    if provider.scraper_id == "hdhub4u_yoruix":
        text = patch_yoruix_hdhub4u_source(text)
    if provider.scraper_id == "hindmoviez":
        text = patch_hindmoviez_source(text)
    text = patch_seekable_validation(text)
    text = patch_stream_normalization(text)
    return "\n".join(line.rstrip() for line in text.rstrip("\n").splitlines()) + "\n"


def bump_patch(version: str) -> str:
    parts = version.split(".")
    if len(parts) != 3 or not all(part.isdigit() for part in parts):
        raise ValueError(f"Expected semantic version x.y.z, got {version!r}")
    major, minor, patch = (int(part) for part in parts)
    return f"{major}.{minor}.{patch + 1}"


def load_provider_registry() -> dict:
    return json.loads(PROVIDER_REGISTRY_PATH.read_text(encoding="utf-8"))


def write_json_if_changed(path: Path, payload: dict) -> bool:
    next_text = json.dumps(payload, indent=2) + "\n"
    current_text = path.read_text(encoding="utf-8") if path.exists() else ""
    if current_text == next_text:
        return False
    path.write_text(next_text, encoding="utf-8")
    return True


def provider_names(registry: dict) -> list[str]:
    return [scraper["name"] for scraper in registry.get("scrapers", [])]


def addon_description(names: list[str]) -> str:
    return "A Stremio stream add-on wrapping the Doom-addon provider set: " + ", ".join(names) + "."


def package_description(names: list[str]) -> str:
    return "Doom-addon: a Stremio stream add-on with " + ", ".join(names) + "."


def update_versions(changed_ids: set[str]) -> tuple[bool, list[str], dict]:
    registry = load_provider_registry()
    if not changed_ids:
        return False, [], registry

    changes: list[str] = []
    old_repo_version = registry["version"]
    registry["version"] = bump_patch(old_repo_version)
    changes.append(f"Doom-addon providers: `{old_repo_version}` -> `{registry['version']}`")

    for scraper in registry.get("scrapers", []):
        if scraper.get("id") not in changed_ids:
            continue
        old_version = scraper["version"]
        scraper["version"] = bump_patch(old_version)
        changes.append(f"{scraper['name']}: `{old_version}` -> `{scraper['version']}`")

    return write_json_if_changed(PROVIDER_REGISTRY_PATH, registry), changes, registry


def update_stremio_manifest(registry: dict) -> bool:
    stremio_manifest = json.loads(STREMIO_MANIFEST_PATH.read_text(encoding="utf-8"))
    names = provider_names(registry)
    stremio_manifest["version"] = registry["version"]
    stremio_manifest["name"] = "Doom-addon"
    stremio_manifest["description"] = addon_description(names)
    return write_json_if_changed(STREMIO_MANIFEST_PATH, stremio_manifest)


def update_package(registry: dict) -> bool:
    package_json = json.loads(PACKAGE_PATH.read_text(encoding="utf-8"))
    names = provider_names(registry)
    package_json["version"] = registry["version"]
    package_json["description"] = package_description(names)
    return write_json_if_changed(PACKAGE_PATH, package_json)


def check_murph_manifest() -> list[str]:
    warnings: list[str] = []
    try:
        manifest = fetch_json(MURPH_MANIFEST_URL)
    except Exception as exc:
        return [f"Murph manifest check failed: {exc}"]

    manifest_text = json.dumps(manifest).lower()
    for label in ("4khdhub", "hdhub4u"):
        if label not in manifest_text:
            warnings.append(f"Murph manifest did not expose `{label}` text during this check.")
    return warnings


def is_due_to_run(today_utc: date, force: bool) -> bool:
    if force:
        return True
    delta_days = (today_utc - ANCHOR_DATE).days
    return delta_days >= 0 and delta_days % CADENCE_DAYS == 0


def main() -> int:
    force = os.environ.get("FORCE_SYNC", "false").lower() == "true"
    today_utc = datetime.now(timezone.utc).date()

    if not is_due_to_run(today_utc, force):
        write_output("changed", "false")
        write_output("skipped", "true")
        write_summary([
            "## Doom-addon direct upstream sync",
            "",
            f"Skipped on `{today_utc.isoformat()}` UTC because the 2-day cadence is anchored to `{ANCHOR_DATE.isoformat()}`.",
        ])
        print("Not on the 2-day sync cadence; skipping.")
        return 0

    changed_providers: list[ResolvedProvider] = []
    sync_warnings: list[str] = []
    upstream_tree_cache: dict[str, list[str]] = {}

    for provider in PROVIDERS:
        try:
            upstream_tree_paths = upstream_tree_cache.get(provider.upstream_tree_api)
            if upstream_tree_paths is None:
                upstream_tree_paths = fetch_upstream_tree_paths(provider.upstream_tree_api)
                upstream_tree_cache[provider.upstream_tree_api] = upstream_tree_paths
        except Exception as exc:
            upstream_tree_paths = []
            warning = (
                f"Upstream tree discovery failed for `{provider.scraper_id}`, so Doom-addon "
                f"fell back to static paths: {exc}"
            )
            sync_warnings.append(warning)
            print(f"Warning: {warning}")

        resolved_provider = None
        upstream_text = None

        for upstream_path in candidate_upstream_paths(provider, upstream_tree_paths):
            try:
                upstream_text = fetch_text(f"{provider.upstream_raw_base}/{upstream_path}")
                resolved_provider = ResolvedProvider(provider, upstream_path)
                if upstream_path != provider.upstream_paths[0]:
                    print(f"Info: `{provider.scraper_id}` auto-followed upstream path `{upstream_path}`.")
                break
            except HTTPError as exc:
                if exc.code == 404:
                    continue
                raise

        if resolved_provider is None or upstream_text is None:
            warning = f"`{provider.scraper_id}` was skipped because no compatible upstream provider file could be found automatically."
            sync_warnings.append(warning)
            print(f"Warning: {warning}")
            continue

        try:
            transformed_text = transform_source(provider, upstream_text)
        except RuntimeError as exc:
            warning = f"`{provider.scraper_id}` was skipped because Doom-addon patching failed: {exc}"
            sync_warnings.append(warning)
            print(f"Warning: {warning}")
            continue

        local_text = provider.local_path.read_text(encoding="utf-8") if provider.local_path.exists() else ""
        if transformed_text != local_text:
            provider.local_path.parent.mkdir(parents=True, exist_ok=True)
            provider.local_path.write_text(transformed_text, encoding="utf-8")
            changed_providers.append(resolved_provider)

    sync_warnings.extend(check_murph_manifest())

    changed_ids = {provider.scraper_id for provider in changed_providers}
    registry_changed, version_changes, registry = update_versions(changed_ids)
    changed_files: list[str] = [provider.provider.local_path_str for provider in changed_providers]

    if changed_ids:
        if registry_changed:
            changed_files.append("providers.json")
        if update_stremio_manifest(registry):
            changed_files.append("manifest.json")
        if update_package(registry):
            changed_files.append("package.json")

    changed = bool(changed_files)
    changed_names = ",".join(provider.scraper_id for provider in changed_providers)
    write_output("changed", "true" if changed else "false")
    write_output("skipped", "false")
    write_output("changed_scrapers", changed_names)

    summary_lines = [
        "## Doom-addon direct upstream sync",
        "",
        f"Checked original upstreams on `{today_utc.isoformat()}` UTC.",
        f"Changed: `{'true' if changed else 'false'}`",
        "",
        "Sources:",
        f"- `{D3ADLYROCKET_UPSTREAM_RAW_BASE}`",
        f"- `{YORUIX_UPSTREAM_RAW_BASE}`",
        f"- `{MURPH_MANIFEST_URL}`",
    ]
    if changed_providers:
        summary_lines.extend(["", f"Updated scrapers: `{changed_names}`", "", "Version bumps:"])
        summary_lines.extend(f"- {item}" for item in version_changes)
        summary_lines.extend(["", "Changed files:"])
        summary_lines.extend(f"- `{path}`" for path in changed_files)
    else:
        summary_lines.extend(["", "No upstream provider file changes were applied."])
    if sync_warnings:
        summary_lines.extend(["", "Warnings:"])
        summary_lines.extend(f"- {item}" for item in sync_warnings)
    write_summary(summary_lines)

    if changed:
        print("Updated from original upstreams:")
        for path in changed_files:
            print(f"- {path}")
    else:
        print("No original upstream provider changes detected.")
    if sync_warnings:
        print("Warnings:")
        for warning in sync_warnings:
            print(f"- {warning}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
