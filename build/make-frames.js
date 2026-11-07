// Renders a seamless-looping abstract "aurora mesh" background as a PNG frame
// sequence. Seamlessness: every moving quantity is a function of
// phase = 2*PI * (frame / FRAMES), so frame FRAMES-1 flows back into frame 0
// with no visible jump. ffmpeg then encodes these into mp4 + webm.
const { createCanvas } = require('@napi-rs/canvas');
const fs = require('fs');
const path = require('path');

const W = 1280;
const H = 720;
const FRAMES = 180;          // 6s at 30fps
const OUT = path.join(__dirname, 'frames');

// Brand-leaning dark palette (Forge Studio): deep navy base, with violet,
// teal and warm gold accents for the drifting light blobs.
const BASE_TOP = '#070b1a';
const BASE_BOTTOM = '#0d1430';

// Each blob rides a closed Lissajous path so its position is periodic in phase.
// cx/cy = screen fraction centre of the orbit; ax/ay = orbit radii (fraction);
// fx/fy = integer angular frequencies (must be integers to stay periodic over
// one full 2*PI phase); color = rgb; rad = base glow radius fraction;
// pulseAmt/pulseFreq = integer-frequency radius pulse.
const BLOBS = [
  { cx: 0.28, cy: 0.38, ax: 0.10, ay: 0.07, fx: 1, fy: 2, phase: 0.0,  color: [124, 92, 255],  rad: 0.42, pulseAmt: 0.10, pulseFreq: 1 },
  { cx: 0.72, cy: 0.30, ax: 0.08, ay: 0.09, fx: 2, fy: 1, phase: 1.7,  color: [46, 196, 182],  rad: 0.38, pulseAmt: 0.12, pulseFreq: 2 },
  { cx: 0.60, cy: 0.70, ax: 0.12, ay: 0.06, fx: 1, fy: 1, phase: 3.1,  color: [255, 183, 77],  rad: 0.34, pulseAmt: 0.09, pulseFreq: 1 },
  { cx: 0.40, cy: 0.78, ax: 0.07, ay: 0.08, fx: 2, fy: 2, phase: 4.6,  color: [94, 129, 255],  rad: 0.30, pulseAmt: 0.11, pulseFreq: 1 },
  { cx: 0.85, cy: 0.62, ax: 0.06, ay: 0.07, fx: 1, fy: 2, phase: 5.5,  color: [199, 125, 255],  rad: 0.28, pulseAmt: 0.10, pulseFreq: 2 },
];

// Deterministic particles (fixed start positions), drift periodically in phase.
const PARTICLES = Array.from({ length: 90 }, (_, i) => {
  // simple LCG so layout is stable across runs without a dep
  const r = (seed) => { let x = Math.sin(seed * 999.13) * 43758.5453; return x - Math.floor(x); };
  return {
    x: r(i + 1),
    y: r(i + 101),
    size: 0.6 + r(i + 201) * 1.8,
    driftX: (r(i + 301) - 0.5) * 0.04,
    driftY: (r(i + 401) - 0.5) * 0.04,
    fx: 1 + Math.floor(r(i + 501) * 2),   // integer freq -> periodic
    fy: 1 + Math.floor(r(i + 601) * 2),
    phase: r(i + 701) * Math.PI * 2,
    baseAlpha: 0.15 + r(i + 801) * 0.35,
  };
});

function drawFrame(frame) {
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext('2d');
  const phase = (frame / FRAMES) * Math.PI * 2;

  // 1. Base vertical gradient
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, BASE_TOP);
  bg.addColorStop(1, BASE_BOTTOM);
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // 2. Glowing drifting blobs (additive)
  ctx.globalCompositeOperation = 'lighter';
  for (const b of BLOBS) {
    const px = (b.cx + b.ax * Math.cos(b.fx * phase + b.phase)) * W;
    const py = (b.cy + b.ay * Math.sin(b.fy * phase + b.phase)) * H;
    const pulse = 1 + b.pulseAmt * Math.sin(b.pulseFreq * phase + b.phase);
    const radius = b.rad * Math.min(W, H) * pulse;
    const g = ctx.createRadialGradient(px, py, 0, px, py, radius);
    const [r, gr, bl] = b.color;
    g.addColorStop(0, `rgba(${r},${gr},${bl},0.55)`);
    g.addColorStop(0.45, `rgba(${r},${gr},${bl},0.22)`);
    g.addColorStop(1, `rgba(${r},${gr},${bl},0)`);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(px, py, radius, 0, Math.PI * 2);
    ctx.fill();
  }

  // 3. Floating particles (additive)
  for (const p of PARTICLES) {
    const px = ((p.x + p.driftX * Math.cos(p.fx * phase + p.phase)) % 1 + 1) % 1 * W;
    const py = ((p.y + p.driftY * Math.sin(p.fy * phase + p.phase)) % 1 + 1) % 1 * H;
    const twinkle = 0.6 + 0.4 * Math.sin(phase + p.phase);
    ctx.fillStyle = `rgba(200,220,255,${(p.baseAlpha * twinkle).toFixed(3)})`;
    ctx.beginPath();
    ctx.arc(px, py, p.size, 0, Math.PI * 2);
    ctx.fill();
  }

  // 4. Vignette on top (normal blend) to keep edges dark for text legibility
  ctx.globalCompositeOperation = 'source-over';
  const vg = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.3, W / 2, H / 2, Math.max(W, H) * 0.75);
  vg.addColorStop(0, 'rgba(0,0,0,0)');
  vg.addColorStop(1, 'rgba(0,0,0,0.55)');
  ctx.fillStyle = vg;
  ctx.fillRect(0, 0, W, H);

  return canvas.toBuffer('image/png');
}

fs.mkdirSync(OUT, { recursive: true });
for (let f = 0; f < FRAMES; f++) {
  const buf = drawFrame(f);
  const name = path.join(OUT, `frame_${String(f).padStart(4, '0')}.png`);
  fs.writeFileSync(name, buf);
  if (f % 30 === 0) process.stdout.write(`frame ${f}\n`);
}
console.log(`done: ${FRAMES} frames -> ${OUT}`);
