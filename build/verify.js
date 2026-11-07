// Live verification of the puzzle #61 hero via a real Chrome (Playwright).
// Proves: no-chrome autoplay video actually playing (currentTime advances,
// not paused), muted + looping + covers the hero, overlaid title renders on
// top, and that prefers-reduced-motion:reduce swaps to the static poster.
const { chromium } = require('playwright');

const URL = process.argv[2] || 'http://localhost:8061/index.html';

async function run() {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const report = {};

  // ---- 1. MOTION context (default) --------------------------------------
  {
    const ctx = await browser.newContext({ viewport: { width: 1366, height: 768 } });
    const page = await ctx.newPage();
    await page.goto(URL, { waitUntil: 'load' });
    await page.waitForTimeout(1200); // let autoplay get going

    const t1 = await page.$eval('.hero__video', v => v.currentTime);
    await page.waitForTimeout(1200);
    const motion = await page.evaluate(() => {
      const v = document.querySelector('.hero__video');
      const poster = document.querySelector('.hero__poster');
      const hero = document.querySelector('.hero');
      const h1 = document.querySelector('.hero h1');
      const vr = v.getBoundingClientRect();
      const hr = hero.getBoundingClientRect();
      const h1r = h1.getBoundingClientRect();
      const cs = getComputedStyle(v);
      return {
        paused: v.paused,
        currentTime: v.currentTime,
        muted: v.muted,
        loop: v.loop,
        controls: v.controls,
        hasControlsAttr: v.hasAttribute('controls'),
        playsInline: v.playsInline,
        readyState: v.readyState,
        videoWidth: v.videoWidth,
        videoHeight: v.videoHeight,
        objectFit: cs.objectFit,
        videoDisplay: cs.display,
        posterDisplay: getComputedStyle(poster).display,
        coversHero: Math.abs(vr.width - hr.width) < 2 && Math.abs(vr.height - hr.height) < 2,
        heroSize: [Math.round(hr.width), Math.round(hr.height)],
        videoSize: [Math.round(vr.width), Math.round(vr.height)],
        h1Text: h1.textContent.replace(/\s+/g, ' ').trim(),
        h1Visible: h1r.width > 0 && h1r.height > 0,
        h1Color: getComputedStyle(h1).color,
        chip: document.getElementById('modeChip').textContent,
      };
    });
    motion.currentTimeBefore = t1;
    motion.currentTimeAdvanced = motion.currentTime > t1;
    report.motion = motion;
    await page.screenshot({ path: 'build/shot-motion.png' });
    await ctx.close();
  }

  // ---- 2. REDUCED-MOTION context ----------------------------------------
  {
    const ctx = await browser.newContext({ viewport: { width: 1366, height: 768 }, reducedMotion: 'reduce' });
    const page = await ctx.newPage();
    await page.goto(URL, { waitUntil: 'load' });
    await page.waitForTimeout(1500); // give any (wrongly) playing video time to advance

    const reduced = await page.evaluate(() => {
      const v = document.querySelector('.hero__video');
      const poster = document.querySelector('.hero__poster');
      return {
        prefersReduced: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
        videoDisplay: getComputedStyle(v).display,
        posterDisplay: getComputedStyle(poster).display,
        posterVisible: poster.getBoundingClientRect().width > 0,
        videoPaused: v.paused,
        videoCurrentTime: v.currentTime,
        hasAutoplayAttr: v.hasAttribute('autoplay'),
        chip: document.getElementById('modeChip').textContent,
      };
    });
    report.reduced = reduced;
    await page.screenshot({ path: 'build/shot-reduced.png' });
    await ctx.close();
  }

  await browser.close();
  console.log(JSON.stringify(report, null, 2));

  // ---- Assertions --------------------------------------------------------
  const m = report.motion, r = report.reduced;
  const checks = [
    ['motion: video is NOT paused', m.paused === false],
    ['motion: currentTime advanced', m.currentTimeAdvanced === true],
    ['motion: muted', m.muted === true],
    ['motion: loop', m.loop === true],
    ['motion: no controls (property)', m.controls === false],
    ['motion: no controls attribute', m.hasControlsAttr === false],
    ['motion: playsInline', m.playsInline === true],
    ['motion: real video decoded (videoWidth>0)', m.videoWidth > 0],
    ['motion: object-fit cover', m.objectFit === 'cover'],
    ['motion: video covers hero', m.coversHero === true],
    ['motion: poster hidden', m.posterDisplay === 'none'],
    ['motion: title renders & visible', m.h1Visible === true && m.h1Text.length > 0],
    ['reduced: media query matched', r.prefersReduced === true],
    ['reduced: video hidden (display none)', r.videoDisplay === 'none'],
    ['reduced: poster shown (display block)', r.posterDisplay === 'block'],
    ['reduced: poster visible', r.posterVisible === true],
    ['reduced: video paused (not autoplaying)', r.videoPaused === true],
    ['reduced: video currentTime at 0', r.videoCurrentTime === 0],
  ];
  let allPass = true;
  console.log('\n--- CHECKS ---');
  for (const [name, ok] of checks) {
    console.log((ok ? 'PASS' : 'FAIL') + '  ' + name);
    if (!ok) allPass = false;
  }
  console.log('\nRESULT: ' + (allPass ? 'ALL PASS' : 'SOME FAILED'));
  process.exit(allPass ? 0 : 1);
}

run().catch(e => { console.error(e); process.exit(2); });
