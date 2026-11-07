#!/usr/bin/env bash
# Exact ffmpeg invocations used to turn the PNG frame sequence into the two
# background video sources plus the poster. Run after `node build/make-frames.js`.
# FF points at the locally installed ffmpeg 9.0.2.
set -e
FF="${FF:-ffmpeg}"
cd "$(dirname "$0")/.."

# MP4 (H.264) — yuv420p for universal decode, +faststart for instant playback
"$FF" -y -framerate 30 -i build/frames/frame_%04d.png \
  -c:v libx264 -pix_fmt yuv420p -crf 23 -preset slow -movflags +faststart \
  -an assets/hero.mp4

# WebM (VP9) — smaller, served first
"$FF" -y -framerate 30 -i build/frames/frame_%04d.png \
  -c:v libvpx-vp9 -pix_fmt yuv420p -crf 34 -b:v 0 -row-mt 1 \
  -an assets/hero.webm

# Poster = first frame (matches the loop start, so no flash when video takes over)
"$FF" -y -i build/frames/frame_0000.png -q:v 3 assets/hero-poster.jpg
