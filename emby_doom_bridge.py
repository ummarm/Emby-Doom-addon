"""
Doom Addon -> Emby Catalog + Playback Bridge

What it does:
1. Pulls catalog items from TMDB:
   - 200 popular movies
   - 200 popular shows
   - 200 trending movies
   - 200 trending shows
   - 200 new-release movies
   - 200 new-release shows
   - 200 latest Indian/Bollywood/regional movies
   - 200 latest Indian/Bollywood/regional shows

2. Creates Emby-friendly .strm placeholder files.
   Each movie/episode gets 4 .strm files:
   - 4K
   - 1080p A
   - 1080p B
   - 1080p C

3. Writes clean Emby playback URLs for Emby-Doom-addon.
   Emby opens the .strm URL -> Emby-Doom-addon chooses best stream -> proxies playback with provider headers/ranges.

Install:
    pip install requests flask python-dateutil

Run sync only:
    python doom_emby_bridge.py sync

Run legacy bridge server only:
    python emby_doom_bridge.py server

Run sync, then server:
    python emby_doom_bridge.py all

Important:
- Set TMDB_API_KEY and EMBY_API_KEY below.
- Keep Emby-Doom-addon running while Emby users play.
- If Emby clients are outside your PC/network, ADDON_PUBLIC_URL must be a domain/public IP reachable by them.
"""

import json
import os
import re
import sys
import time
import traceback
from datetime import datetime, timedelta
from pathlib import Path
from urllib.parse import quote

import requests
from flask import Flask, Response, redirect, request


def load_dotenv(path: Path = Path(".env")) -> None:
    if not path.exists():
        return

    for raw_line in path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        key = key.strip()
        value = value.strip().strip('"').strip("'")
        if key and key not in os.environ:
            os.environ[key] = value


load_dotenv()

# =========================
# CONFIG - EDIT THESE
# =========================

TMDB_API_KEY = os.environ.get("TMDB_API_KEY", "PUT_YOUR_TMDB_API_KEY_HERE")

# Your Emby-Doom-addon base URL. This should point at the Node addon created in
# this repo, not your original Doom-addon deployment.
ADDON_PUBLIC_URL = os.environ.get("ADDON_PUBLIC_URL", "https://emby-doom-addon.zxflix.com")

# Legacy only: your original Doom addon base URL. The new .strm files do not use
# this directly.
DOOM_ADDON_BASE = os.environ.get("DOOM_ADDON_BASE", "https://doom-addon.zxflix.com")

# Legacy only: old bridge URL. New .strm files use ADDON_PUBLIC_URL instead.
# This is the URL that Emby clients opened from old .strm files.
# If Emby and clients are on same PC only, localhost is fine.
# For TV/phone on same LAN, use your PC IP: http://192.168.0.10:8787
# For remote users, use your domain: https://bridge.yourdomain.com
BRIDGE_PUBLIC_URL = os.environ.get("BRIDGE_PUBLIC_URL", "http://192.168.0.10:8787")

# Emby server details, used only to trigger library scan after sync.
EMBY_URL = os.environ.get("EMBY_URL", "http://localhost:8096")
EMBY_API_KEY = os.environ.get("EMBY_API_KEY", "PUT_YOUR_EMBY_API_KEY_HERE")

MOVIES_DIR = Path(os.environ.get("MOVIES_DIR", r"D:\movies"))
SHOWS_DIR = Path(os.environ.get("SHOWS_DIR", r"D:\shows"))

# Catalog sizes
TARGET_PER_LIST = 200

# TV catalog can become huge if you create all episodes for 800 shows.
# Start safe. Increase later if you want.
MAX_SEASONS_PER_SHOW = 2
MAX_EPISODES_PER_SEASON = 8

# If true, existing .strm files are overwritten with fresh bridge URLs.
OVERWRITE_STRM = True

# Provider priority. Put your best Doom providers first if you know names.
PROVIDER_PRIORITY = [
    "torrentio",
    "comet",
    "knightcrawler",
    "annatar",
    "mediafusion",
    "jackett",
    "zilean",
]

# Reject bad quality names
REJECT_WORDS = [
    "cam", "hdcam", "ts", "telesync", "tc", "telecine",
    "xbet", "hqcam", "predvd", "dvdscr", "scr",
]

# Prefer these Indian/regional language words when available
INDIAN_LANGUAGE_WORDS = [
    "hindi", "urdu", "dual", "multi", "multi audio",
    "telugu", "telegu", "tamil", "malayalam", "kannada", "kandana",
    "punjabi", "bengali", "marathi",
]

REQUEST_TIMEOUT = 25

# =========================
# APP
# =========================

app = Flask(__name__)
session = requests.Session()


def safe_name(name: str) -> str:
    name = re.sub(r'[<>:"/\\|?*]', "", name or "")
    name = re.sub(r"\s+", " ", name).strip()
    return name[:180] or "Unknown"


def log(msg: str) -> None:
    print(f"[{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}] {msg}", flush=True)


def tmdb_get(path: str, params=None):
    if not TMDB_API_KEY or TMDB_API_KEY == "PUT_YOUR_TMDB_API_KEY_HERE":
        raise RuntimeError("Set TMDB_API_KEY first.")
    params = dict(params or {})
    params["api_key"] = TMDB_API_KEY
    url = f"https://api.themoviedb.org/3{path}"
    r = session.get(url, params=params, timeout=REQUEST_TIMEOUT)
    r.raise_for_status()
    return r.json()


def emby_scan():
    if not EMBY_API_KEY or EMBY_API_KEY == "PUT_YOUR_EMBY_API_KEY_HERE":
        log("Skipping Emby scan because EMBY_API_KEY is not set.")
        return
    try:
        url = f"{EMBY_URL.rstrip('/')}/emby/Library/Refresh"
        r = session.post(url, headers={"X-Emby-Token": EMBY_API_KEY}, timeout=REQUEST_TIMEOUT)
        log(f"Emby library scan triggered: HTTP {r.status_code}")
    except Exception as e:
        log(f"Could not trigger Emby scan: {e}")


def collect_tmdb_list(kind: str, category: str, target: int = TARGET_PER_LIST):
    """
    kind: movie or tv
    category: popular, trending, new, indian
    """
    results = []
    seen = set()
    page = 1

    while len(results) < target and page <= 20:
        try:
            if category == "popular":
                data = tmdb_get(f"/{kind}/popular", {"page": page, "language": "en-US"})
            elif category == "trending":
                data = tmdb_get(f"/trending/{kind}/week", {"page": page, "language": "en-US"})
            elif category == "new":
                if kind == "movie":
                    data = tmdb_get("/movie/now_playing", {"page": page, "language": "en-US"})
                else:
                    # recently aired shows
                    today = datetime.utcnow().date()
                    last_90 = today - timedelta(days=90)
                    data = tmdb_get("/discover/tv", {
                        "page": page,
                        "language": "en-US",
                        "sort_by": "first_air_date.desc",
                        "first_air_date.gte": str(last_90),
                        "first_air_date.lte": str(today),
                    })
            elif category == "indian":
                if kind == "movie":
                    data = tmdb_get("/discover/movie", {
                        "page": page,
                        "language": "en-US",
                        "region": "IN",
                        "with_origin_country": "IN",
                        "sort_by": "primary_release_date.desc",
                        "include_adult": "false",
                    })
                else:
                    data = tmdb_get("/discover/tv", {
                        "page": page,
                        "language": "en-US",
                        "with_origin_country": "IN",
                        "sort_by": "first_air_date.desc",
                    })
            else:
                raise ValueError(category)

            for item in data.get("results", []):
                tid = item.get("id")
                if tid and tid not in seen:
                    seen.add(tid)
                    results.append(item)
                    if len(results) >= target:
                        break
            page += 1
        except Exception as e:
            log(f"TMDB list error {kind}/{category}/page {page}: {e}")
            break

    log(f"Collected {len(results)} TMDB {kind} items for {category}")
    return results[:target]


def get_imdb_id(kind: str, tmdb_id: int):
    try:
        if kind == "movie":
            data = tmdb_get(f"/movie/{tmdb_id}/external_ids")
        else:
            data = tmdb_get(f"/tv/{tmdb_id}/external_ids")
        return data.get("imdb_id")
    except Exception as e:
        log(f"Could not get IMDb ID for {kind} {tmdb_id}: {e}")
        return None


def get_movie_details(tmdb_id: int):
    try:
        return tmdb_get(f"/movie/{tmdb_id}", {"language": "en-US"})
    except Exception:
        return {}


def get_tv_details(tmdb_id: int):
    try:
        return tmdb_get(f"/tv/{tmdb_id}", {"language": "en-US"})
    except Exception:
        return {}


def get_tv_season(tmdb_id: int, season_number: int):
    try:
        return tmdb_get(f"/tv/{tmdb_id}/season/{season_number}", {"language": "en-US"})
    except Exception:
        return {}


def write_file(path: Path, content: str):
    path.parent.mkdir(parents=True, exist_ok=True)
    if path.exists() and not OVERWRITE_STRM:
        return False
    path.write_text(content.strip() + "\n", encoding="utf-8")
    return True


def movie_strm_urls(imdb_id: str):
    base = f"{ADDON_PUBLIC_URL.rstrip()}/emby/movie/{quote(imdb_id)}"
    return {
        "4K": f"{base}?profile=4k&slot=1",
        "1080p A": f"{base}?profile=1080p&slot=1",
        "1080p B": f"{base}?profile=1080p&slot=2",
        "1080p C": f"{base}?profile=1080p&slot=3",
    }


def episode_strm_urls(imdb_id: str, season: int, episode: int):
    base = f"{ADDON_PUBLIC_URL.rstrip()}/emby/series/{quote(imdb_id)}/{season}/{episode}"
    return {
        "4K": f"{base}?profile=4k&slot=1",
        "1080p A": f"{base}?profile=1080p&slot=1",
        "1080p B": f"{base}?profile=1080p&slot=2",
        "1080p C": f"{base}?profile=1080p&slot=3",
    }


def create_movie_item(item):
    tmdb_id = item.get("id")
    imdb_id = get_imdb_id("movie", tmdb_id)
    if not imdb_id:
        return 0

    details = get_movie_details(tmdb_id)
    title = details.get("title") or item.get("title") or item.get("name") or "Unknown Movie"
    release = details.get("release_date") or item.get("release_date") or ""
    year = release[:4] if release else ""
    folder_name = safe_name(f"{title} ({year})" if year else title)
    movie_dir = MOVIES_DIR / folder_name

    count = 0
    for label, url in movie_strm_urls(imdb_id).items():
        file_name = safe_name(f"{folder_name} - {label}.strm")
        if write_file(movie_dir / file_name, url):
            count += 1

    # Optional NFO for better matching
    nfo = f"""<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<movie>
  <title>{title}</title>
  <year>{year}</year>
  <imdbid>{imdb_id}</imdbid>
  <tmdbid>{tmdb_id}</tmdbid>
</movie>"""
    write_file(movie_dir / "movie.nfo", nfo)
    return count


def create_show_item(item):
    tmdb_id = item.get("id")
    imdb_id = get_imdb_id("tv", tmdb_id)
    if not imdb_id:
        return 0

    details = get_tv_details(tmdb_id)
    title = details.get("name") or item.get("name") or "Unknown Show"
    first_air = details.get("first_air_date") or item.get("first_air_date") or ""
    year = first_air[:4] if first_air else ""
    folder_name = safe_name(f"{title} ({year})" if year else title)
    show_dir = SHOWS_DIR / folder_name

    count = 0

    seasons = details.get("seasons") or []
    real_seasons = [s for s in seasons if s.get("season_number", 0) > 0]
    real_seasons = real_seasons[:MAX_SEASONS_PER_SHOW]

    for season in real_seasons:
        sn = season.get("season_number")
        sdata = get_tv_season(tmdb_id, sn)
        episodes = (sdata.get("episodes") or [])[:MAX_EPISODES_PER_SEASON]
        season_dir = show_dir / f"Season {sn:02d}"

        for ep in episodes:
            en = ep.get("episode_number")
            if not en:
                continue
            ep_title = safe_name(ep.get("name") or f"Episode {en}")
            prefix = safe_name(f"{folder_name} - S{sn:02d}E{en:02d} - {ep_title}")
            for label, url in episode_strm_urls(imdb_id, sn, en).items():
                file_name = safe_name(f"{prefix} - {label}.strm")
                if write_file(season_dir / file_name, url):
                    count += 1

    nfo = f"""<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<tvshow>
  <title>{title}</title>
  <year>{year}</year>
  <imdbid>{imdb_id}</imdbid>
  <tmdbid>{tmdb_id}</tmdbid>
</tvshow>"""
    write_file(show_dir / "tvshow.nfo", nfo)
    return count


def sync_catalog():
    MOVIES_DIR.mkdir(parents=True, exist_ok=True)
    SHOWS_DIR.mkdir(parents=True, exist_ok=True)

    movie_lists = []
    show_lists = []

    for cat in ["popular", "trending", "new", "indian"]:
        movie_lists.extend(collect_tmdb_list("movie", cat, TARGET_PER_LIST))
        show_lists.extend(collect_tmdb_list("tv", cat, TARGET_PER_LIST))

    # De-duplicate by TMDB id
    movies = {}
    shows = {}
    for m in movie_lists:
        if m.get("id"):
            movies[m["id"]] = m
    for s in show_lists:
        if s.get("id"):
            shows[s["id"]] = s

    log(f"Unique movies to create: {len(movies)}")
    log(f"Unique shows to create: {len(shows)}")

    created = 0

    for i, item in enumerate(movies.values(), 1):
        try:
            c = create_movie_item(item)
            created += c
            log(f"Movie {i}/{len(movies)} created {c} files")
        except Exception as e:
            log(f"Movie create error: {e}")

    for i, item in enumerate(shows.values(), 1):
        try:
            c = create_show_item(item)
            created += c
            log(f"Show {i}/{len(shows)} created {c} files")
        except Exception as e:
            log(f"Show create error: {e}")

    log(f"Finished sync. Created/updated {created} .strm files.")
    emby_scan()


def fetch_doom_streams(kind: str, imdb_id: str, season=None, episode=None):
    if kind == "movie":
        url = f"{DOOM_ADDON_BASE.rstrip()}/stream/movie/{imdb_id}.json"
    else:
        url = f"{DOOM_ADDON_BASE.rstrip()}/stream/series/{imdb_id}:{season}:{episode}.json"

    r = session.get(url, timeout=REQUEST_TIMEOUT)
    r.raise_for_status()
    data = r.json()
    streams = data.get("streams") or []
    return streams


def text_of_stream(stream):
    parts = [
        stream.get("name", ""),
        stream.get("title", ""),
        stream.get("description", ""),
        stream.get("url", ""),
    ]
    return " ".join([str(p) for p in parts if p]).lower()


def stream_url(stream):
    # Stremio streams usually use "url"; sometimes "externalUrl" is not directly playable.
    return stream.get("url") or stream.get("externalUrl")


def is_rejected(stream):
    text = text_of_stream(stream)
    return any(w in text for w in REJECT_WORDS)


def quality_score(text: str, profile: str):
    score = 0

    if "2160" in text or "4k" in text or "uhd" in text:
        score += 400
    if "1080" in text:
        score += 300
    if "720" in text:
        score += 180
    if "480" in text:
        score += 90

    if profile == "4k":
        if "2160" in text or "4k" in text or "uhd" in text:
            score += 1000
        elif "1080" in text:
            score += 200
    else:
        if "1080" in text:
            score += 1000
        elif "720" in text:
            score += 250
        elif "480" in text:
            score += 120

    if "web-dl" in text or "webdl" in text:
        score += 80
    if "bluray" in text or "blu-ray" in text:
        score += 70
    if "hevc" in text or "x265" in text:
        score += 35
    if "x264" in text:
        score += 20

    # Indian/Hindi/regional language preference
    if any(w in text for w in INDIAN_LANGUAGE_WORDS):
        score += 120

    for idx, p in enumerate(PROVIDER_PRIORITY):
        if p.lower() in text:
            score += max(0, 100 - idx * 10)

    return score


def rank_streams(streams, profile: str, slot: int):
    candidates = []
    for s in streams:
        url = stream_url(s)
        if not url:
            continue
        if is_rejected(s):
            continue
        text = text_of_stream(s)
        score = quality_score(text, profile)
        candidates.append((score, s))

    candidates.sort(key=lambda x: x[0], reverse=True)

    # slot 1 = best, slot 2 = second best, etc.
    index = max(0, slot - 1)
    if index >= len(candidates):
        index = 0

    return [s for _, s in candidates[index:]] + [s for _, s in candidates[:index]]


def resolve_and_redirect(kind: str, imdb_id: str, season=None, episode=None):
    profile = request.args.get("profile", "1080p").lower()
    try:
        slot = int(request.args.get("slot", "1"))
    except Exception:
        slot = 1

    try:
        if kind == "movie":
            final_url = f"{ADDON_PUBLIC_URL.rstrip()}/emby/movie/{quote(imdb_id)}?profile={quote(profile)}&slot={slot}"
        else:
            final_url = f"{ADDON_PUBLIC_URL.rstrip()}/emby/series/{quote(imdb_id)}/{season}/{episode}?profile={quote(profile)}&slot={slot}"

        log(f"LEGACY PLAY {kind} {imdb_id} profile={profile} slot={slot} -> {final_url}")
        return redirect(final_url, code=302)

    except Exception as e:
        log(f"Bridge error: {e}")
        traceback.print_exc()
        return Response(f"Bridge error: {e}", status=500, mimetype="text/plain")


@app.route("/")
def home():
    return Response("Doom -> Emby bridge is running.", mimetype="text/plain")


@app.route("/play/movie/<imdb_id>")
def play_movie(imdb_id):
    return resolve_and_redirect("movie", imdb_id)


@app.route("/play/series/<imdb_id>/<int:season>/<int:episode>")
def play_series(imdb_id, season, episode):
    return resolve_and_redirect("series", imdb_id, season, episode)


def run_server():
    log(f"Bridge running on 0.0.0.0:8787")
    log(f"New .strm files should use Emby-Doom-addon: {ADDON_PUBLIC_URL}")
    log(f"Legacy bridge URLs will redirect to Emby-Doom-addon instead of raw provider URLs.")
    app.run(host="0.0.0.0", port=8787, threaded=True)


def main():
    cmd = sys.argv[1].lower() if len(sys.argv) > 1 else "help"

    if cmd == "sync":
        sync_catalog()
    elif cmd == "server":
        run_server()
    elif cmd == "all":
        sync_catalog()
        run_server()
    else:
        print("""
Usage:
  python emby_doom_bridge.py sync
  python emby_doom_bridge.py server
  python emby_doom_bridge.py all
""")


if __name__ == "__main__":
    main()
