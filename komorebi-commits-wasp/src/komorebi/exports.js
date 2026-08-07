'use strict';

/* shared export layout: framed scene + caption, like the page itself */

import { GROUND, LIGHT, GOLD, SHADE, PAGE_RGB, BORDER_RGB, REDUCED_MOTION } from './engine.js';

function exportScale(engine) {
  return Math.max(1, Math.min(6, Math.round(engine.cssW / engine.fw)));
}

function exportLayout(engine) {
  const scale = exportScale(engine);
  const pad = 36, capH = 56;
  return {
    scale, pad, capH,
    w: engine.fw * scale + pad * 2,
    h: engine.fh * scale + pad * 2 + capH,
  };
}

function drawExportChrome(o, engine, L, caption, withScene) {
  o.fillStyle = `rgb(${PAGE_RGB.join(',')})`;
  o.fillRect(0, 0, L.w, L.h);
  o.strokeStyle = 'rgba(154,172,208,0.55)';
  o.lineWidth = 1;
  o.strokeRect(L.pad - 10.5, L.pad - 10.5, engine.fw * L.scale + 21, engine.fh * L.scale + 21);
  if (withScene) {
    o.imageSmoothingEnabled = false;
    o.drawImage(engine.canvas, L.pad, L.pad, engine.fw * L.scale, engine.fh * L.scale);
  }
  o.fillStyle = 'rgba(154,172,208,0.9)';
  o.font = '15px ui-monospace, Menlo, monospace';
  o.textAlign = 'center';
  o.fillText(caption, L.w / 2, engine.fh * L.scale + L.pad + 38);
}

function downloadBlob(blob, name) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 10000);
}

export function savePng(engine, caption, user) {
  const L = exportLayout(engine);
  const out = document.createElement('canvas');
  out.width = L.w; out.height = L.h;
  drawExportChrome(out.getContext('2d'), engine, L, caption, true);
  const a = document.createElement('a');
  a.download = `komorebi-${user || 'commits'}.png`;
  a.href = out.toDataURL('image/png');
  a.click();
}

/* ---------- animated GIF export ----------
   The frame is already four flat colors, which is exactly what GIF
   wants — so this is a small hand-rolled GIF89a encoder with a
   4-entry palette. The loop is a perfect cycle: each frame blends the
   light field with itself one period earlier (see renderLoopFrame),
   so the last frame flows straight back into the first. */

const R_TO_INDEX = { 20: 0, 52: 1, 154: 2, 220: 3 }; // red channel is unique per tone
/* full GIF palette: the four scene tones plus the page chrome
   (background, frame border) — 6 used, padded to 8 entries */
const GIF_PALETTE = [GROUND, SHADE, LIGHT, GOLD, PAGE_RGB, BORDER_RGB, [0, 0, 0], [0, 0, 0]];

/* render the frame + caption once and map it to palette indices —
   the static plate every GIF frame is composed onto */
function gifChromeTemplate(engine, L, caption) {
  const c = document.createElement('canvas');
  c.width = L.w; c.height = L.h;
  const o = c.getContext('2d');
  drawExportChrome(o, engine, L, caption, false);
  const d = o.getImageData(0, 0, L.w, L.h).data;
  const out = new Uint8Array(L.w * L.h);
  for (let i = 0; i < out.length; i++) {
    const r = d[i * 4], g = d[i * 4 + 1], b = d[i * 4 + 2];
    let best = 0, bd = Infinity;
    for (let p = 0; p < 6; p++) {
      const pc = GIF_PALETTE[p];
      const dist = (r - pc[0]) ** 2 + (g - pc[1]) ** 2 + (b - pc[2]) ** 2;
      if (dist < bd) { bd = dist; best = p; }
    }
    out[i] = best;
  }
  return out;
}

function frameIndices(engine, scale) {
  const { fw, fh } = engine;
  const w = fw * scale;
  const out = new Uint8Array(w * fh * scale);
  const d = engine.img.data;
  for (let y = 0; y < fh; y++) {
    for (let x = 0; x < fw; x++) {
      const ci = R_TO_INDEX[d[(y * fw + x) * 4]] || 0;
      for (let sy = 0; sy < scale; sy++) {
        const row = (y * scale + sy) * w + x * scale;
        for (let sx = 0; sx < scale; sx++) out[row + sx] = ci;
      }
    }
  }
  return out;
}

function lzwEncode(indices, minCodeSize, out) {
  const clear = 1 << minCodeSize, eoi = clear + 1;
  let codeSize = minCodeSize + 1;
  let nextCode = eoi + 1;
  let table = new Map();
  let acc = 0, accBits = 0;
  const bytes = [];
  const emit = (code) => {
    acc |= code << accBits;
    accBits += codeSize;
    while (accBits >= 8) { bytes.push(acc & 0xff); acc >>= 8; accBits -= 8; }
  };
  emit(clear);
  let prev = indices[0];
  for (let i = 1; i < indices.length; i++) {
    const k = indices[i];
    const key = (prev << 8) | k;
    const hit = table.get(key);
    if (hit !== undefined) { prev = hit; continue; }
    emit(prev);
    if (nextCode === 4096) {
      emit(clear);
      table = new Map();
      nextCode = eoi + 1;
      codeSize = minCodeSize + 1;
    } else {
      if (nextCode >= (1 << codeSize)) codeSize++;
      table.set(key, nextCode++);
    }
    prev = k;
  }
  emit(prev);
  emit(eoi);
  if (accBits > 0) bytes.push(acc & 0xff);
  out.push(minCodeSize);
  for (let i = 0; i < bytes.length; i += 255) {
    const n = Math.min(255, bytes.length - i);
    out.push(n);
    for (let j = 0; j < n; j++) out.push(bytes[i + j]);
  }
  out.push(0);
}

let gifBusy = false;

/** Renders ~7s of ping-ponged animation into a GIF and downloads it.
    Returns false if an export is already in flight. */
export async function saveGif(engine, caption, user) {
  if (gifBusy) return false;
  gifBusy = true;
  await new Promise(r => setTimeout(r, 40));
  try {
    const L = exportLayout(engine);
    const template = gifChromeTemplate(engine, L, caption);
    const sw = engine.fw * L.scale;
    const dt = 0.08, nFrames = 60;                     // one 4.8s seamless cycle
    const period = dt * nFrames;
    const t0 = REDUCED_MOTION ? 12.0 : engine.currentT();
    const frames = [];
    for (let i = 0; i < nFrames; i++) {
      engine.renderLoopFrame(t0, i / nFrames, period);
      const scene = frameIndices(engine, L.scale);
      const f = template.slice();
      for (let y = 0; y < engine.fh * L.scale; y++) {
        f.set(scene.subarray(y * sw, y * sw + sw), (y + L.pad) * L.w + L.pad);
      }
      frames.push(f);
      if (i % 8 === 7) await new Promise(r => setTimeout(r, 0));
    }
    const out = [];
    const u16 = (v) => { out.push(v & 0xff, (v >> 8) & 0xff); };
    for (const ch of 'GIF89a') out.push(ch.charCodeAt(0));
    u16(L.w); u16(L.h); out.push(0xF2, 0, 0);          // 8-entry global palette
    for (const c of GIF_PALETTE) out.push(c[0], c[1], c[2]);
    out.push(0x21, 0xFF, 0x0B);                        // loop forever
    for (const ch of 'NETSCAPE2.0') out.push(ch.charCodeAt(0));
    out.push(3, 1, 0, 0, 0);
    for (const f of frames) {
      out.push(0x21, 0xF9, 4, 0x04); u16(8); out.push(0, 0);   // 80ms/frame
      out.push(0x2C); u16(0); u16(0); u16(L.w); u16(L.h); out.push(0);
      lzwEncode(f, 3, out);
      await new Promise(r => setTimeout(r, 0));
    }
    out.push(0x3B);
    downloadBlob(new Blob([new Uint8Array(out)], { type: 'image/gif' }), `komorebi-${user || 'commits'}.gif`);
    return true;
  } finally {
    gifBusy = false;
  }
}
