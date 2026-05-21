# Emby-Doom-addon-v1

Emby-Doom-addon-v1 is a separate Emby-focused fork that uses a configured
FlixNest / Flix-Streams manifest as its upstream stream source.

Your original Doom-addon repo is not changed.

## Why This Exists

The old Python bridge did this:

```text
Emby .strm -> Python bridge -> Doom-addon /stream JSON -> 302 redirect to provider URL
```

That loses important playback details. Doom-addon streams can include request
headers in `behaviorHints.proxyHeaders`, and Emby cannot use those headers after
a plain redirect. Some provider URLs also need byte-range handling for seeking.

This fork adds:

```text
/emby/movie/<imdb-id>/1080p.mkv?profile=1080p&slot=1
/emby/series/<imdb-id>/<season>/<episode>/1080p.mkv?profile=1080p&slot=1
```

Those URLs are clean for `.strm` files. When Emby opens one, the addon selects
the stream. By default it redirects Emby to clean direct provider URLs, and only
proxies streams that require provider headers.

## Run

```sh
npm install
npm start
```

Default local URL:

```text
http://localhost:7000
```

For another port:

```sh
PORT=8788 npm start
```

## Emby URLs

Movie:

```text
http://localhost:7000/emby/movie/tt0111161/1080p.mkv?profile=1080p&slot=1
```

Series episode:

```text
http://localhost:7000/emby/series/tt0944947/1/1/1080p.mkv?profile=1080p&slot=1
```

Profiles:

- `profile=4k`
- `profile=1080p`

Slots:

- `slot=1` best ranked stream for that profile
- `slot=2` second ranked stream
- `slot=3` third ranked stream

Playback modes:

```text
?profile=1080p&slot=1&mode=auto
?profile=1080p&slot=1&mode=proxy
?profile=1080p&slot=1&mode=redirect
```

Auto mode is the default. It redirects clean direct URLs and proxies only when
provider headers are required.

## Stremio Endpoints

The original Stremio-compatible endpoints are still present:

```text
/manifest.json
/stream/movie/tt0111161.json
/stream/series/tt0944947:1:1.json
```

## Source

This project was copied from `ummarm/Doom-addon` and renamed so Emby-specific
changes do not touch the live Doom-addon project.
