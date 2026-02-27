/**
 * Brush Engine — stamp-based rendering with Catmull-Rom interpolation.
 * Pure functions, no React. Each brush defines a stamp() and optional
 * per-stroke setup. The engine places stamps along the interpolated path.
 */

// ─── Helpers ────────────────────────────────────────────────────────────────

export function hexToRgb(hex) {
  if (!hex || typeof hex !== 'string') return [0, 0, 0];
  hex = hex.replace('#', '');
  if (hex.length === 3) hex = hex[0]+hex[0]+hex[1]+hex[1]+hex[2]+hex[2];
  return [parseInt(hex.slice(0,2),16), parseInt(hex.slice(2,4),16), parseInt(hex.slice(4,6),16)];
}

export function lerpColor(c1, c2, t) {
  return [
    Math.round(c1[0] + (c2[0]-c1[0]) * t),
    Math.round(c1[1] + (c2[1]-c1[1]) * t),
    Math.round(c1[2] + (c2[2]-c1[2]) * t),
  ];
}

export function rgbStr(r, g, b, a = 1) {
  return a < 1 ? `rgba(${r},${g},${b},${a})` : `rgb(${r},${g},${b})`;
}

function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

// ─── Catmull-Rom Interpolation ──────────────────────────────────────────────

function catmullRom(p0, p1, p2, p3, t) {
  const t2 = t * t, t3 = t2 * t;
  return {
    x: 0.5 * ((2*p1.x) + (-p0.x+p2.x)*t + (2*p0.x-5*p1.x+4*p2.x-p3.x)*t2 + (-p0.x+3*p1.x-3*p2.x+p3.x)*t3),
    y: 0.5 * ((2*p1.y) + (-p0.y+p2.y)*t + (2*p0.y-5*p1.y+4*p2.y-p3.y)*t2 + (-p0.y+3*p1.y-3*p2.y+p3.y)*t3),
    pressure: p1.pressure + (p2.pressure - p1.pressure) * t,
  };
}

/**
 * Interpolate raw input points into a smooth path with Catmull-Rom,
 * placing sub-points at the given spacing (in px).
 */
export function interpolatePoints(rawPoints, spacingPx) {
  if (rawPoints.length < 2) return rawPoints.slice();
  const pts = rawPoints;
  const out = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)];
    const p1 = pts[i];
    const p2 = pts[Math.min(pts.length - 1, i + 1)];
    const p3 = pts[Math.min(pts.length - 1, i + 2)];
    const segLen = Math.hypot(p2.x - p1.x, p2.y - p1.y);
    const steps = Math.max(1, Math.ceil(segLen / spacingPx));
    for (let s = 0; s < steps; s++) {
      out.push(catmullRom(p0, p1, p2, p3, s / steps));
    }
  }
  out.push(pts[pts.length - 1]);
  return out;
}

/**
 * Walk along interpolated points and invoke stampFn at each spacing interval.
 */
export function walkStroke(points, spacingPx, stampFn) {
  if (points.length === 0) return;
  let accumDist = 0;
  let prev = points[0];
  stampFn(prev, 0); // first stamp
  for (let i = 1; i < points.length; i++) {
    const cur = points[i];
    const dx = cur.x - prev.x;
    const dy = cur.y - prev.y;
    const dist = Math.hypot(dx, dy);
    if (dist < 0.5) continue;
    const angle = Math.atan2(dy, dx);
    accumDist += dist;
    while (accumDist >= spacingPx) {
      accumDist -= spacingPx;
      const t = 1 - accumDist / dist;
      const stampPt = {
        x: prev.x + dx * t,
        y: prev.y + dy * t,
        pressure: prev.pressure + (cur.pressure - prev.pressure) * t,
        angle,
      };
      stampFn(stampPt, angle);
    }
    prev = cur;
  }
}

// ─── Noise helper (seeded pseudo-random per stamp) ──────────────────────────

let _seed = 1;
function srand(s) { _seed = s; }
function rand() { _seed = (_seed * 16807) % 2147483647; return (_seed - 1) / 2147483646; }

// ─── BRUSH DEFINITIONS ─────────────────────────────────────────────────────

/**
 * 1. PENCIL — thin, graphite-like with paper grain response
 */
export function stampPencil(ctx, pt, settings) {
  const { size, opacity, color } = settings;
  const p = pt.pressure;
  const rgb = hexToRgb(color);
  const dynamicSize = Math.max(1, size * 0.3 * (0.5 + p * 0.5));
  const dynamicOpacity = clamp(opacity * (0.3 + p * 0.7), 0.01, 1);
  srand(Math.floor(pt.x * 73 + pt.y * 137));

  ctx.save();
  ctx.globalCompositeOperation = 'multiply';
  // Elliptical tip rotated in stroke direction
  const angle = pt.angle || 0;
  ctx.translate(pt.x, pt.y);
  ctx.rotate(angle);
  ctx.scale(1, 0.6); // elliptical

  // Noisy edge particles
  const particles = Math.ceil(dynamicSize * 2);
  for (let i = 0; i < particles; i++) {
    const ox = (rand() - 0.5) * dynamicSize;
    const oy = (rand() - 0.5) * dynamicSize;
    if (ox*ox + oy*oy > (dynamicSize/2)*(dynamicSize/2)) continue;
    const a = dynamicOpacity * (0.3 + rand() * 0.7);
    ctx.fillStyle = rgbStr(rgb[0], rgb[1], rgb[2], a);
    ctx.fillRect(ox - 0.5, oy - 0.5, 1 + rand(), 1 + rand());
  }

  ctx.restore();
}

/**
 * 2. INK PEN / LINER — crisp, uniform, 100% opacity
 */
export function stampInkPen(ctx, pt, settings) {
  const { size, color } = settings;
  const r = Math.max(0.5, size * 0.5);
  ctx.save();
  ctx.globalAlpha = 1;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(pt.x, pt.y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/**
 * 3. BALLPOINT PEN — slight waxiness, pressure affects width + opacity
 */
export function stampBallpoint(ctx, pt, settings) {
  const { size, opacity, color } = settings;
  const p = pt.pressure;
  const rgb = hexToRgb(color);
  const dynSize = Math.max(1, size * (0.4 + p * 0.3));
  const dynAlpha = clamp(opacity * (0.5 + p * 0.4), 0.05, 1);

  srand(Math.floor(pt.x * 31 + pt.y * 97));
  ctx.save();
  ctx.translate(pt.x, pt.y);
  ctx.rotate(pt.angle || 0);
  ctx.scale(1, 0.7);
  ctx.globalAlpha = dynAlpha;

  // Main dot
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(0, 0, dynSize / 2, 0, Math.PI * 2);
  ctx.fill();

  // Subtle noise
  const n = Math.ceil(dynSize);
  for (let i = 0; i < n; i++) {
    const ox = (rand() - 0.5) * dynSize;
    const oy = (rand() - 0.5) * dynSize;
    ctx.fillStyle = rgbStr(rgb[0], rgb[1], rgb[2], dynAlpha * 0.3);
    ctx.fillRect(ox, oy, 0.8, 0.8);
  }
  ctx.restore();
}

/**
 * 4. FLAT BRUSH — wide rectangular stroke, connected for smoothness
 * Uses angle interpolation (lerp) to prevent abrupt rotation snapping.
 * Stamps are drawn centered on each point and connected via quads.
 */
let _flatBrushPrev = null;
let _flatBrushAngle = null;

function lerpAngle(a, b, t) {
  // Shortest-path angular lerp
  let diff = b - a;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  return a + diff * t;
}

export function stampFlatBrush(ctx, pt, settings) {
  const { size, opacity, color } = settings;
  const p = pt.pressure;
  const w = size * (0.6 + p * 0.4);
  const h = size * 0.15; // tip thickness
  const rawAngle = pt.angle || 0;

  // Smoothly interpolate angle to prevent jagged direction snapping
  if (_flatBrushAngle === null) {
    _flatBrushAngle = rawAngle;
  } else {
    _flatBrushAngle = lerpAngle(_flatBrushAngle, rawAngle, 0.3);
  }
  const angle = _flatBrushAngle;
  const perpAngle = angle + Math.PI / 2;
  const hw = w / 2;
  const hh = h / 2;

  ctx.save();
  ctx.globalAlpha = clamp(opacity * (0.6 + p * 0.4), 0.05, 1);
  ctx.fillStyle = color;

  if (_flatBrushPrev && Math.hypot(pt.x - _flatBrushPrev.x, pt.y - _flatBrushPrev.y) < size * 4) {
    // Connect to previous stamp with a quad for gapless strokes
    const pPerp = _flatBrushPrev.angle + Math.PI / 2;
    const pHw = _flatBrushPrev.hw;
    const ppx = Math.cos(pPerp) * pHw;
    const ppy = Math.sin(pPerp) * pHw;
    const cpx = Math.cos(perpAngle) * hw;
    const cpy = Math.sin(perpAngle) * hw;

    ctx.beginPath();
    ctx.moveTo(_flatBrushPrev.x - ppx, _flatBrushPrev.y - ppy);
    ctx.lineTo(_flatBrushPrev.x + ppx, _flatBrushPrev.y + ppy);
    ctx.lineTo(pt.x + cpx, pt.y + cpy);
    ctx.lineTo(pt.x - cpx, pt.y - cpy);
    ctx.closePath();
    ctx.fill();
  }

  // Always stamp a centered rectangle at the current point
  ctx.translate(pt.x, pt.y);
  ctx.rotate(angle);
  ctx.fillRect(-hw, -hh, w, h);

  _flatBrushPrev = { x: pt.x, y: pt.y, angle, hw };
  ctx.restore();
}
export function resetFlatBrush() { _flatBrushPrev = null; _flatBrushAngle = null; }

/**
 * 5. ROUND BRUSH — bristle cluster, tapers, pressure blooms width
 */
export function stampRoundBrush(ctx, pt, settings) {
  const { size, opacity, color } = settings;
  const p = pt.pressure;
  const rgb = hexToRgb(color);
  const dynSize = size * (0.3 + p * 0.7);

  ctx.save();
  ctx.globalAlpha = clamp(opacity * (0.5 + p * 0.5), 0.05, 1);
  srand(Math.floor(pt.x * 53 + pt.y * 89));

  const bristleCount = 10;
  if (p > 0.6) {
    // High pressure: solid round
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(pt.x, pt.y, dynSize / 2, 0, Math.PI * 2);
    ctx.fill();
  } else {
    // Low pressure: separated bristles
    for (let i = 0; i < bristleCount; i++) {
      const angle = (i / bristleCount) * Math.PI * 2;
      const spread = dynSize * 0.3 * (1 - p);
      const bx = pt.x + Math.cos(angle) * spread * rand();
      const by = pt.y + Math.sin(angle) * spread * rand();
      const br = dynSize * 0.12 + rand() * dynSize * 0.06;
      const r2 = clamp(rgb[0] + (rand()-0.5)*10, 0, 255);
      const g2 = clamp(rgb[1] + (rand()-0.5)*10, 0, 255);
      const b2 = clamp(rgb[2] + (rand()-0.5)*10, 0, 255);
      ctx.fillStyle = rgbStr(r2, g2, b2);
      ctx.beginPath();
      ctx.ellipse(bx, by, br, br * 0.7, pt.angle || 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
}

/**
 * 6. WATERCOLOR — translucent, blooming, soft edges
 */
export function stampWatercolor(ctx, pt, settings) {
  const { size, opacity, color } = settings;
  const p = pt.pressure;
  const rgb = hexToRgb(color);
  const dynSize = size * (0.8 + p * 0.4);
  const baseAlpha = clamp(opacity * 0.15, 0.02, 0.3);

  ctx.save();
  // Core stroke
  const grad = ctx.createRadialGradient(pt.x, pt.y, 0, pt.x, pt.y, dynSize / 2);
  grad.addColorStop(0, rgbStr(rgb[0], rgb[1], rgb[2], baseAlpha));
  grad.addColorStop(0.6, rgbStr(rgb[0], rgb[1], rgb[2], baseAlpha * 0.6));
  grad.addColorStop(1, rgbStr(rgb[0], rgb[1], rgb[2], 0));

  ctx.globalCompositeOperation = 'source-over';
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(pt.x, pt.y, dynSize / 2, 0, Math.PI * 2);
  ctx.fill();

  // Edge bloom halo
  const haloSize = dynSize * 0.7;
  const haloGrad = ctx.createRadialGradient(pt.x, pt.y, dynSize * 0.3, pt.x, pt.y, dynSize * 0.5 + haloSize * 0.3);
  haloGrad.addColorStop(0, rgbStr(rgb[0], rgb[1], rgb[2], baseAlpha * 0.15));
  haloGrad.addColorStop(1, rgbStr(rgb[0], rgb[1], rgb[2], 0));
  ctx.fillStyle = haloGrad;
  ctx.beginPath();
  ctx.arc(pt.x, pt.y, dynSize * 0.5 + haloSize * 0.3, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

/**
 * 7. OIL BRUSH — thick, impasto, color mixing
 */
export function stampOil(ctx, pt, settings) {
  const { size, opacity, color } = settings;
  const p = pt.pressure;
  const rgb = hexToRgb(color);
  const dynSize = size * (0.5 + p * 0.5);
  const dynAlpha = clamp(opacity * (0.7 + p * 0.3), 0.3, 1);

  ctx.save();
  ctx.globalAlpha = dynAlpha;

  // Sample underlying color for mixing
  let mixed = rgb;
  try {
    const sample = ctx.getImageData(Math.floor(pt.x), Math.floor(pt.y), 1, 1).data;
    if (sample[3] > 10) {
      mixed = lerpColor(rgb, [sample[0], sample[1], sample[2]], 0.2);
    }
  } catch(e) { /* cross-origin or empty */ }

  // Main body
  ctx.fillStyle = rgbStr(mixed[0], mixed[1], mixed[2]);
  ctx.beginPath();
  ctx.arc(pt.x, pt.y, dynSize / 2, 0, Math.PI * 2);
  ctx.fill();

  // Bristle marks parallel to stroke
  srand(Math.floor(pt.x * 17 + pt.y * 59));
  const angle = pt.angle || 0;
  const bristles = 5;
  for (let i = 0; i < bristles; i++) {
    const offset = ((i / (bristles-1)) - 0.5) * dynSize * 0.6;
    const r2 = clamp(mixed[0] + (rand()-0.5)*12, 0, 255);
    const g2 = clamp(mixed[1] + (rand()-0.5)*12, 0, 255);
    const b2 = clamp(mixed[2] + (rand()-0.5)*12, 0, 255);
    ctx.strokeStyle = rgbStr(r2, g2, b2, dynAlpha * 0.7);
    ctx.lineWidth = 1.2;
    const ox = Math.cos(angle + Math.PI/2) * offset;
    const oy = Math.sin(angle + Math.PI/2) * offset;
    ctx.beginPath();
    ctx.moveTo(pt.x + ox - Math.cos(angle) * dynSize * 0.3, pt.y + oy - Math.sin(angle) * dynSize * 0.3);
    ctx.lineTo(pt.x + ox + Math.cos(angle) * dynSize * 0.3, pt.y + oy + Math.sin(angle) * dynSize * 0.3);
    ctx.stroke();
  }
  ctx.restore();
}

/**
 * 8. CHARCOAL — rough, grainy, heavy paper interaction
 */
export function stampCharcoal(ctx, pt, settings) {
  const { size, opacity, color } = settings;
  const p = pt.pressure;
  const rgb = hexToRgb(color);
  const dynSize = size * (0.6 + p * 0.5);
  const dynAlpha = clamp(opacity * Math.pow(p, 1.5), 0.01, 1);

  srand(Math.floor(pt.x * 29 + pt.y * 113));
  ctx.save();
  ctx.globalCompositeOperation = 'multiply';
  ctx.translate(pt.x, pt.y);
  ctx.rotate(Math.PI / 4); // 45° tilt
  ctx.scale(1.3, 0.7); // elliptical

  // Heavy grainy particles
  const particles = Math.ceil(dynSize * 3);
  for (let i = 0; i < particles; i++) {
    const ox = (rand() - 0.5) * dynSize;
    const oy = (rand() - 0.5) * dynSize;
    if (rand() > dynAlpha + 0.3) continue; // skip some for grain
    const a = dynAlpha * (0.2 + rand() * 0.8);
    ctx.fillStyle = rgbStr(rgb[0], rgb[1], rgb[2], a);
    const s = 0.5 + rand() * 2;
    ctx.fillRect(ox, oy, s, s);
  }

  ctx.restore();

  // Scatter dust around
  ctx.save();
  ctx.globalCompositeOperation = 'multiply';
  const dustCount = Math.ceil(dynSize * 0.8);
  for (let i = 0; i < dustCount; i++) {
    const dx = pt.x + (rand() - 0.5) * dynSize * 1.5;
    const dy = pt.y + (rand() - 0.5) * dynSize * 1.5;
    ctx.fillStyle = rgbStr(rgb[0], rgb[1], rgb[2], dynAlpha * 0.15);
    ctx.beginPath();
    ctx.arc(dx, dy, 0.5 + rand(), 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

/**
 * 9. SOFT BRUSH / AIRBRUSH — radial gradient, slow buildup
 */
export function stampSoftBrush(ctx, pt, settings) {
  const { size, opacity, flow, color } = settings;
  const p = pt.pressure;
  const rgb = hexToRgb(color);
  const dynFlow = clamp((flow || 0.1) * (0.5 + p * 0.5), 0.01, 0.2);

  ctx.save();
  const grad = ctx.createRadialGradient(pt.x, pt.y, 0, pt.x, pt.y, size);
  grad.addColorStop(0, rgbStr(rgb[0], rgb[1], rgb[2], dynFlow));
  grad.addColorStop(1, rgbStr(rgb[0], rgb[1], rgb[2], 0));

  ctx.globalCompositeOperation = 'source-over';
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(pt.x, pt.y, size, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/**
 * 10. ERASER — hard or soft removal
 */
export function stampEraser(ctx, pt, settings) {
  const { size, opacity, hardness } = settings;
  const p = pt.pressure;
  const dynSize = size * (0.5 + p * 0.5);

  ctx.save();
  ctx.globalCompositeOperation = 'destination-out';

  if ((hardness || 1) > 0.5) {
    // Hard eraser
    ctx.globalAlpha = clamp(opacity * p, 0.1, 1);
    ctx.beginPath();
    ctx.arc(pt.x, pt.y, dynSize / 2, 0, Math.PI * 2);
    ctx.fill();
  } else {
    // Soft eraser — radial gradient
    const grad = ctx.createRadialGradient(pt.x, pt.y, 0, pt.x, pt.y, dynSize / 2);
    grad.addColorStop(0, `rgba(0,0,0,${clamp(opacity * p, 0.05, 0.5)})`);
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(pt.x, pt.y, dynSize / 2, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

// ─── Brush Registry ─────────────────────────────────────────────────────────

export const BRUSH_TYPES = [
  { id: 'pencil',      label: 'Pencil',       icon: 'M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z', defaultSize: 4,  defaultOpacity: 0.8, defaultHardness: 0.8, defaultFlow: 1, spacing: 0.08 },
  { id: 'inkPen',      label: 'Ink Pen',      icon: 'M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z', defaultSize: 3, defaultOpacity: 1, defaultHardness: 1, defaultFlow: 1, spacing: 0.05 },
  { id: 'ballpoint',   label: 'Ballpoint',    icon: 'M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z', defaultSize: 3, defaultOpacity: 0.9, defaultHardness: 0.9, defaultFlow: 1, spacing: 0.06 },
  { id: 'flatBrush',   label: 'Flat Brush',   icon: 'M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z', defaultSize: 30, defaultOpacity: 0.8, defaultHardness: 0.7, defaultFlow: 0.8, spacing: 0.03 },
  { id: 'roundBrush',  label: 'Round Brush',  icon: 'M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01', defaultSize: 20, defaultOpacity: 0.85, defaultHardness: 0.5, defaultFlow: 0.9, spacing: 0.1 },
  { id: 'watercolor',  label: 'Watercolor',   icon: 'M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z', defaultSize: 40, defaultOpacity: 0.5, defaultHardness: 0.1, defaultFlow: 0.3, spacing: 0.08 },
  { id: 'oil',         label: 'Oil Brush',    icon: 'M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z', defaultSize: 25, defaultOpacity: 0.95, defaultHardness: 0.6, defaultFlow: 1, spacing: 0.12 },
  { id: 'charcoal',    label: 'Charcoal',     icon: 'M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z', defaultSize: 18, defaultOpacity: 0.7, defaultHardness: 0.3, defaultFlow: 1, spacing: 0.1 },
  { id: 'softBrush',   label: 'Airbrush',     icon: 'M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z', defaultSize: 50, defaultOpacity: 0.5, defaultHardness: 0.0, defaultFlow: 0.1, spacing: 0.15 },
  { id: 'eraser',      label: 'Eraser',       icon: 'M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16', defaultSize: 20, defaultOpacity: 1, defaultHardness: 1, defaultFlow: 1, spacing: 0.08 },
];

export const STAMP_FN = {
  pencil:     stampPencil,
  inkPen:     stampInkPen,
  ballpoint:  stampBallpoint,
  flatBrush:  stampFlatBrush,
  roundBrush: stampRoundBrush,
  watercolor: stampWatercolor,
  oil:        stampOil,
  charcoal:   stampCharcoal,
  softBrush:  stampSoftBrush,
  eraser:     stampEraser,
};

/**
 * Render a full stroke onto ctx.
 * @param {CanvasRenderingContext2D} ctx
 * @param {Array} rawPoints - [{x, y, pressure}]
 * @param {string} brushId
 * @param {object} settings - {size, opacity, hardness, flow, color, ...}
 */
export function renderStroke(ctx, rawPoints, brushId, settings) {
  if (rawPoints.length < 1) return;
  const brushDef = BRUSH_TYPES.find(b => b.id === brushId) || BRUSH_TYPES[0];
  const stampFn = STAMP_FN[brushId] || stampPencil;
  const spacingPx = Math.max(1, settings.size * (brushDef.spacing || 0.1));
  const interpolated = interpolatePoints(rawPoints, spacingPx);

  walkStroke(interpolated, spacingPx, (pt, angle) => {
    pt.angle = angle;
    stampFn(ctx, pt, settings);
  });
}

// ─── Fill Bucket (flood fill) ───────────────────────────────────────────────

export function floodFill(ctx, startX, startY, fillColor, tolerance = 32) {
  const w = ctx.canvas.width;
  const h = ctx.canvas.height;
  const imageData = ctx.getImageData(0, 0, w, h);
  const data = imageData.data;
  const rgb = hexToRgb(fillColor);

  const sx = Math.floor(startX);
  const sy = Math.floor(startY);
  if (sx < 0 || sy < 0 || sx >= w || sy >= h) return;

  const startIdx = (sy * w + sx) * 4;
  const sr = data[startIdx], sg = data[startIdx+1], sb = data[startIdx+2], sa = data[startIdx+3];

  if (sr === rgb[0] && sg === rgb[1] && sb === rgb[2]) return;

  const matches = (i) => {
    return Math.abs(data[i] - sr) + Math.abs(data[i+1] - sg) + Math.abs(data[i+2] - sb) + Math.abs(data[i+3] - sa) <= tolerance;
  };

  const stack = [[sx, sy]];
  const visited = new Uint8Array(w * h);

  while (stack.length > 0) {
    const [cx, cy] = stack.pop();
    const idx = cy * w + cx;
    if (visited[idx]) continue;
    visited[idx] = 1;
    const pi = idx * 4;
    if (!matches(pi)) continue;

    data[pi] = rgb[0];
    data[pi+1] = rgb[1];
    data[pi+2] = rgb[2];
    data[pi+3] = 255;

    if (cx > 0) stack.push([cx-1, cy]);
    if (cx < w-1) stack.push([cx+1, cy]);
    if (cy > 0) stack.push([cx, cy-1]);
    if (cy < h-1) stack.push([cx, cy+1]);
  }

  ctx.putImageData(imageData, 0, 0);
}
