# Puzzle #61 — No-UI autoplay hero background video with overlaid titles

A hero section with a full-bleed background **video** that autoplays with no
visible player chrome (muted, loop, playsinline, autoplay), crisp overlaid
title / subtitle / CTA text kept legible by a gradient scrim, fully responsive,
and respecting `prefers-reduced-motion` by falling back to a **static poster
image** instead of an autoplaying video.

**Live:** https://meherawadikian.github.io/puzzle-61-video-hero/
**Source:** https://github.com/MeherAwadikian/puzzle-61-video-hero

---

## What it does

- **Full-bleed background video** (`object-fit: cover`) behind the hero content,
  with `autoplay muted loop playsinline` and **no `controls`** so there is zero
  player chrome. Muting is what makes silent inline autoplay allowed by every
  modern browser's autoplay policy.
- **Two sources** for broad support: `assets/hero.webm` (VP9, ~103 KB) first,
  `assets/hero.mp4` (H.264 + `faststart`, ~354 KB) as the fallback.
- **Readable overlay**: a two-axis gradient scrim darkens the bottom-left where
  the copy sits, so white text stays legible over any frame of the moving video
  (belt-and-braces text-shadow as a second line of defence).
- **Reduced-motion fallback**: when the user prefers reduced motion, CSS hides
  the `<video>` and shows a static `<img>` poster, and JS also pauses the video
  and resets it to 0 so it never decodes in the background. It reacts live if the
  OS/browser setting is flipped while the page is open.
- **Status chip** (bottom-right) reflects the real media mode
  (`autoplay · muted · looping` vs `reduced motion · static poster`).

## How the video was produced (local, no hotlinking)

The background clip is generated locally, not hotlinked (CSP / offline reasons,
and the Task Forge convention of vendoring assets):

1. `build/make-frames.js` renders a **180-frame PNG sequence** (1280×720, 30fps,
   6s) of an abstract "aurora mesh" — drifting soft radial light blobs plus
   floating particles over a deep-navy field, with a vignette that keeps the
   edges dark for text contrast (`@napi-rs/canvas`, prebuilt, no native build).
2. **Seamless loop by construction**: every moving quantity is a function of
   `phase = 2π · frame / FRAMES`, and every orbital/pulse frequency is an
   integer, so frame 179 flows back into frame 0 with no jump. Measured: the
   wrap step (179→0) mean-abs pixel delta is `0.5135`, indistinguishable from a
   normal consecutive step (`~0.51`).
3. `ffmpeg` (9.0.2) encodes the frames to **mp4** (`libx264`, `yuv420p`,
   `+faststart`) and **webm** (`libvpx-vp9`), and extracts frame 0 as the
   **poster** (`hero-poster.jpg`) so the poster matches the loop start with no
   flash.

Regenerate everything:

```bash
npm install
node build/make-frames.js        # -> build/frames/*.png
# then encode (see build/encode.sh for the exact ffmpeg invocations)
```

## Live verification (not faked)

`build/verify.js` drives a real Chrome via Playwright against the locally served
page and asserts the behaviour in two contexts. All 18 checks pass:

**Motion (default):**
- `video.paused === false` and `currentTime` advanced `1.28s → 2.49s` between two
  samples (genuinely playing, not a still)
- `muted === true`, `loop === true`, `playsInline === true`
- `controls === false` and no `controls` attribute (no player chrome)
- `videoWidth === 1280` (a real decoded video), `object-fit: cover`
- video box equals the hero box (1366×768) — it covers the hero
- poster `display: none`; `<h1>` renders, visible, white (`rgb(246,248,255)`)

**Reduced motion (`reducedMotion: 'reduce'`):**
- media query matches; `<video>` `display: none`, poster `display: block` and
  visible
- `video.paused === true`, `currentTime === 0`, `autoplay` attribute removed

Screenshots of both states: `build/shot-motion.png`, `build/shot-reduced.png`.

```bash
python -m http.server 8061        # serve the folder
PLAYWRIGHT_BROWSERS_PATH=C:\Users\h\.ms-playwright node build/verify.js
```

## Files

```
index.html             the hero (inline CSS + JS, single file)
assets/hero.webm       VP9 background video
assets/hero.mp4        H.264 background video (faststart)
assets/hero-poster.jpg static poster (loop-start frame)
build/make-frames.js   procedural seamless frame generator
build/verify.js        Playwright live verification
build/encode.sh        the exact ffmpeg encode commands
```

Static site — no backend. Deployed to GitHub Pages.
