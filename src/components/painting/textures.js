/**
 * Canvas Texture Generator — procedural paper/canvas textures.
 * Creates tileable texture patterns as offscreen canvases.
 */

const TILE = 256; // texture tile size in px

function noise(x, y, seed) {
  let n = Math.sin(x * 127.1 + y * 311.7 + seed * 43758.5453) * 43758.5453;
  return n - Math.floor(n);
}

function smoothNoise(x, y, seed) {
  const ix = Math.floor(x), iy = Math.floor(y);
  const fx = x - ix, fy = y - iy;
  const a = noise(ix, iy, seed);
  const b = noise(ix + 1, iy, seed);
  const c = noise(ix, iy + 1, seed);
  const d = noise(ix + 1, iy + 1, seed);
  const ux = fx * fx * (3 - 2 * fx);
  const uy = fy * fy * (3 - 2 * fy);
  return a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy;
}

function fbm(x, y, seed, octaves = 4) {
  let val = 0, amp = 0.5, freq = 1;
  for (let i = 0; i < octaves; i++) {
    val += amp * smoothNoise(x * freq, y * freq, seed + i * 13);
    amp *= 0.5;
    freq *= 2;
  }
  return val;
}

/**
 * Generate a texture tile as an OffscreenCanvas or regular canvas.
 * Returns a canvas element that can be used as a pattern.
 */
function createTile(generator) {
  let canvas;
  try {
    canvas = new OffscreenCanvas(TILE, TILE);
  } catch {
    canvas = document.createElement('canvas');
    canvas.width = TILE;
    canvas.height = TILE;
  }
  const ctx = canvas.getContext('2d');
  const img = ctx.createImageData(TILE, TILE);
  const data = img.data;

  for (let y = 0; y < TILE; y++) {
    for (let x = 0; x < TILE; x++) {
      const v = generator(x, y);
      const i = (y * TILE + x) * 4;
      const gray = Math.floor(v * 255);
      data[i] = gray;
      data[i + 1] = gray;
      data[i + 2] = gray;
      data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return canvas;
}

// ─── Texture Generators ─────────────────────────────────────────────────────

function genSmoothPaper(x, y) {
  const n = fbm(x / 40, y / 40, 1, 3);
  return 0.88 + n * 0.12;
}

function genColdPress(x, y) {
  const coarse = fbm(x / 20, y / 20, 2, 4);
  const fine = noise(x * 0.8, y * 0.8, 7) * 0.15;
  return 0.7 + coarse * 0.2 + fine;
}

function genCanvas(x, y) {
  // Woven pattern
  const warpX = Math.sin(x * 0.5) * 0.1;
  const warpY = Math.sin(y * 0.5) * 0.1;
  const weave = (Math.sin((x + warpY) * 1.2) * 0.5 + 0.5) * (Math.sin((y + warpX) * 1.2) * 0.5 + 0.5);
  const n = fbm(x / 30, y / 30, 3, 2) * 0.1;
  return 0.6 + weave * 0.25 + n;
}

function genRoughPaper(x, y) {
  const n1 = fbm(x / 12, y / 12, 4, 5);
  const n2 = noise(x * 1.5, y * 1.5, 9) * 0.2;
  return 0.55 + n1 * 0.3 + n2;
}

// ─── Public API ─────────────────────────────────────────────────────────────

export const TEXTURES = [
  { id: 'smooth',    label: 'Smooth Paper' },
  { id: 'coldPress', label: 'Cold Press' },
  { id: 'canvas',    label: 'Canvas' },
  { id: 'rough',     label: 'Rough Paper' },
  { id: 'none',      label: 'No Texture' },
];

const tileCache = {};

/**
 * Get a texture tile canvas for the given texture id.
 * Returns null for 'none'.
 */
export function getTextureTile(textureId) {
  if (textureId === 'none') return null;
  if (tileCache[textureId]) return tileCache[textureId];

  const generators = {
    smooth: genSmoothPaper,
    coldPress: genColdPress,
    canvas: genCanvas,
    rough: genRoughPaper,
  };

  const gen = generators[textureId];
  if (!gen) return null;

  const tile = createTile(gen);
  tileCache[textureId] = tile;
  return tile;
}

/**
 * Draw the texture overlay onto a destination context.
 * Uses 'multiply' blending at the given intensity (0–1).
 */
export function drawTextureOverlay(destCtx, textureId, intensity, width, height) {
  if (textureId === 'none' || intensity <= 0) return;
  const tile = getTextureTile(textureId);
  if (!tile) return;

  destCtx.save();
  destCtx.globalCompositeOperation = 'multiply';
  destCtx.globalAlpha = intensity;

  const pattern = destCtx.createPattern(tile, 'repeat');
  destCtx.fillStyle = pattern;
  destCtx.fillRect(0, 0, width, height);
  destCtx.restore();
}
