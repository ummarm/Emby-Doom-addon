# Emby-Doom-addon

Emby-Doom-addon is a separate Emby-focused fork of
[`ummarm/Doom-addon`](https://github.com/ummarm/Doom-addon). It keeps the normal
Stremio endpoints, and adds clean Emby playback URLs that proxy the selected
provider stream through this addon.

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
the stream, forwards provider headers, preserves Emby's `Range` request, and
streams the media back to Emby.

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

Debug redirect mode:

```text
?profile=1080p&slot=1&mode=redirect
```

Use redirect mode only for testing. Proxy mode is the default and is the Emby
fix.

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
