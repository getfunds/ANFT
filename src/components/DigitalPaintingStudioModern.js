'use client';

import React, { useState, useRef, useCallback, useEffect } from 'react';
import styles from './DigitalPaintingStudioModern.module.css';
import { BRUSH_TYPES, renderStroke, floodFill, resetFlatBrush } from './painting/brushes';
import { TEXTURES, drawTextureOverlay } from './painting/textures';
import ColorPickerHSB from './painting/ColorPickerHSB';
import LayersPanel from './painting/LayersPanel';

const BG_OPTIONS = [
  { id: 'white', label: 'White', color: '#FFFFFF' },
  { id: 'cream', label: 'Cream', color: '#FFF8F0' },
  { id: 'grey', label: 'Light Grey', color: '#E5E5E5' },
  { id: 'transparent', label: 'Transparent', color: null },
];
const CANVAS_SIZE = 2048;
const MAX_UNDO = 50, MAX_LAYERS = 10;
let _lid = 0;
function nid() { return 'l' + (++_lid); }
function mkCanvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }

export default function DigitalPaintingStudioModern({ onMintNFT }) {
  /* ── canvas ── */
  const canvasW = CANVAS_SIZE, canvasH = CANVAS_SIZE;
  const [bgColor, setBgColor] = useState('#FFFFFF');
  const [showNewDlg, setShowNewDlg] = useState(false);
  const [newBg, setNewBg] = useState('white');

  /* ── refs ── */
  const dcRef = useRef(null);
  const containerRef = useRef(null);
  const lcRef = useRef({}); // layer canvases

  /* ── tool ── */
  const [activeTool, setActiveTool] = useState('roundBrush');
  const [tempTool, setTempTool] = useState(null);
  const [brushSize, setBrushSize] = useState(20);
  const [brushOpacity, setBrushOpacity] = useState(0.85);
  const [brushHardness, setBrushHardness] = useState(0.5);
  const [brushFlow, setBrushFlow] = useState(0.9);

  /* ── color ── */
  const [color, setColor] = useState('#1a1a1a');
  const [prevColor, setPrevColor] = useState('#000000');
  const defaultPalette = ['#000000','#ffffff','#ef4444','#f97316','#eab308','#22c55e','#14b8a6','#3b82f6','#8b5cf6','#ec4899','#6b7280','#92400e','#1e3a5f','#065f46','#581c87','#831843','#fbbf24','#a3e635','#38bdf8','#e879f9'];
  const [palette, setPalette] = useState(() => {
    if (typeof window !== 'undefined') { try { const s = localStorage.getItem('anft_pal'); if (s) return JSON.parse(s); } catch {} }
    return [...defaultPalette];
  });

  /* ── texture ── */
  const [texId, setTexId] = useState('none');
  const [texInt, setTexInt] = useState(0.3);

  /* ── layers ── */
  const [layers, setLayers] = useState([]);
  const [activeLayerId, setActiveLayerId] = useState(null);

  /* ── view ── */
  const [zoom, setZoom] = useState(1);
  const [panX, setPanX] = useState(0);
  const [panY, setPanY] = useState(0);
  const [rotation, setRotation] = useState(0);
  const zoomRef = useRef(1);
  const panXRef = useRef(0);
  const panYRef = useRef(0);

  /* ── drawing state (refs for perf) ── */
  const drawingRef = useRef(false);
  const pathRef = useRef([]);
  const cursorRef = useRef(null);
  const showCursorRef = useRef(false);
  const [showCursor, setShowCursor] = useState(false);
  const panningRef = useRef(false);
  const rotatingRef = useRef(false);
  const panStart = useRef({ x: 0, y: 0, px: 0, py: 0 });
  const rotStart = useRef({ x: 0, r: 0 });
  const spaceRef = useRef(false);
  const rKeyRef = useRef(false);
  const altRef = useRef(false);
  const prevToolRef = useRef(null);
  const [eyePreview, setEyePreview] = useState(null);

  /* ── undo/redo ── */
  const undoStack = useRef([]);
  const redoStack = useRef([]);
  const [undoN, setUndoN] = useState(0);
  const [redoN, setRedoN] = useState(0);

  /* ── sidebar ── */
  const [rTab, setRTab] = useState('brush');

  /* ── helpers ── */
  const getActiveCtx = useCallback(() => {
    if (!activeLayerId) return null;
    const c = lcRef.current[activeLayerId];
    return c ? c.getContext('2d') : null;
  }, [activeLayerId]);

  const compRef = useRef(false);
  const composite = useCallback(() => {
    if (compRef.current) return;
    compRef.current = true;
    requestAnimationFrame(() => {
      compRef.current = false;
      const dc = dcRef.current;
      if (!dc) return;
      const ctx = dc.getContext('2d');
      const w = dc.width, h = dc.height;
      ctx.clearRect(0, 0, w, h);
      if (bgColor) { ctx.fillStyle = bgColor; ctx.fillRect(0, 0, w, h); }
      else { const sq = 16; for (let y = 0; y < h; y += sq) for (let x = 0; x < w; x += sq) { ctx.fillStyle = ((x/sq+y/sq)%2===0)?'#fff':'#e0e0e0'; ctx.fillRect(x,y,sq,sq); } }
      drawTextureOverlay(ctx, texId, texInt, w, h);
      for (const l of layers) {
        if (!l.visible) continue;
        const lc = lcRef.current[l.id];
        if (!lc) continue;
        ctx.save();
        ctx.globalAlpha = l.opacity;
        ctx.globalCompositeOperation = l.blendMode || 'source-over';
        ctx.drawImage(lc, 0, 0);
        ctx.restore();
      }
    });
  }, [bgColor, texId, texInt, layers]);

  /* ── save undo ── */
  const saveUndo = useCallback(() => {
    const snap = {};
    for (const [id, c] of Object.entries(lcRef.current)) snap[id] = c.getContext('2d').getImageData(0, 0, c.width, c.height);
    undoStack.current.push({ snap, meta: JSON.parse(JSON.stringify(layers)), aid: activeLayerId });
    if (undoStack.current.length > MAX_UNDO) undoStack.current.shift();
    redoStack.current = [];
    setUndoN(undoStack.current.length);
    setRedoN(0);
  }, [layers, activeLayerId]);

  const undo = useCallback(() => {
    if (undoStack.current.length === 0) return;
    const cur = {}; for (const [id, c] of Object.entries(lcRef.current)) cur[id] = c.getContext('2d').getImageData(0, 0, c.width, c.height);
    redoStack.current.push({ snap: cur, meta: JSON.parse(JSON.stringify(layers)), aid: activeLayerId });
    const prev = undoStack.current.pop();
    for (const [id, img] of Object.entries(prev.snap)) { const c = lcRef.current[id]; if (c) c.getContext('2d').putImageData(img, 0, 0); }
    setLayers(prev.meta); setActiveLayerId(prev.aid);
    setUndoN(undoStack.current.length); setRedoN(redoStack.current.length);
    composite();
  }, [layers, activeLayerId, composite]);

  const redo = useCallback(() => {
    if (redoStack.current.length === 0) return;
    const cur = {}; for (const [id, c] of Object.entries(lcRef.current)) cur[id] = c.getContext('2d').getImageData(0, 0, c.width, c.height);
    undoStack.current.push({ snap: cur, meta: JSON.parse(JSON.stringify(layers)), aid: activeLayerId });
    const next = redoStack.current.pop();
    for (const [id, img] of Object.entries(next.snap)) { const c = lcRef.current[id]; if (c) c.getContext('2d').putImageData(img, 0, 0); }
    setLayers(next.meta); setActiveLayerId(next.aid);
    setUndoN(undoStack.current.length); setRedoN(redoStack.current.length);
    composite();
  }, [layers, activeLayerId, composite]);

  /* ── init ── */
  const initCanvas = useCallback((bg) => {
    const W = CANVAS_SIZE;
    const id = nid();
    const c = mkCanvas(W, W);
    lcRef.current = { [id]: c };
    setLayers([{ id, name: 'Layer 1', visible: true, opacity: 1, blendMode: 'source-over' }]);
    setActiveLayerId(id);
    setBgColor(bg);
    undoStack.current = []; redoStack.current = [];
    setUndoN(0); setRedoN(0); setZoom(1); setPanX(0); setPanY(0); setRotation(0);
    const dc = dcRef.current;
    if (dc) {
      dc.width = W; dc.height = W;
      const ctx = dc.getContext('2d');
      ctx.clearRect(0, 0, W, W);
      if (bg) { ctx.fillStyle = bg; ctx.fillRect(0, 0, W, W); }
      else { const sq = 16; for (let y2 = 0; y2 < W; y2 += sq) for (let x2 = 0; x2 < W; x2 += sq) { ctx.fillStyle = ((x2/sq+y2/sq)%2===0)?'#fff':'#e0e0e0'; ctx.fillRect(x2,y2,sq,sq); } }
    }
  }, []);

  /* ── fit scale: the scale at which 2048x2048 fits the container ── */
  const fitScaleRef = useRef(1);
  const calcFitScale = useCallback(() => {
    const el = containerRef.current; if (!el) return 1;
    const pad = 20;
    const sx = (el.clientWidth - pad) / CANVAS_SIZE;
    const sy = (el.clientHeight - pad) / CANVAS_SIZE;
    return Math.min(sx, sy);
  }, []);

  const doFit = useCallback(() => {
    const fs = calcFitScale();
    fitScaleRef.current = fs;
    zoomRef.current = fs; panXRef.current = 0; panYRef.current = 0;
    setZoom(fs); setPanX(0); setPanY(0); setRotation(0);
  }, [calcFitScale]);

  useEffect(() => {
    initCanvas('#FFFFFF');
    requestAnimationFrame(() => requestAnimationFrame(() => doFit()));
  }, [initCanvas, doFit]);

  /* ── recalc fit scale on window resize ── */
  useEffect(() => {
    const onResize = () => {
      const fs = calcFitScale();
      fitScaleRef.current = fs;
      // If current zoom is the old fit, update to new fit
      setZoom(prev => {
        // Always refit if within 5% of old fit
        if (Math.abs(prev - fitScaleRef.current) < 0.02) return fs;
        return prev;
      });
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [calcFitScale]);
  useEffect(() => { composite(); }, [layers, texId, texInt, bgColor, composite]);

  /* ── layer ops ── */
  const addLayer = useCallback(() => {
    if (layers.length >= MAX_LAYERS) return;
    saveUndo();
    const id = nid();
    lcRef.current[id] = mkCanvas(CANVAS_SIZE, CANVAS_SIZE);
    setLayers(p => [...p, { id, name: `Layer ${p.length+1}`, visible: true, opacity: 1, blendMode: 'source-over' }]);
    setActiveLayerId(id); composite();
  }, [layers, saveUndo, composite]);

  const deleteLayer = useCallback((id) => {
    if (layers.length <= 1) return;
    saveUndo(); delete lcRef.current[id];
    setLayers(p => { const n = p.filter(l => l.id !== id); if (activeLayerId === id) setActiveLayerId(n[n.length-1].id); return n; });
    composite();
  }, [layers, activeLayerId, saveUndo, composite]);

  const duplicateLayer = useCallback((id) => {
    if (layers.length >= MAX_LAYERS) return;
    saveUndo();
    const src = lcRef.current[id]; if (!src) return;
    const nId = nid(); const c = mkCanvas(CANVAS_SIZE, CANVAS_SIZE);
    c.getContext('2d').drawImage(src, 0, 0);
    lcRef.current[nId] = c;
    const sl = layers.find(l => l.id === id); const idx = layers.indexOf(sl);
    setLayers(p => { const n = [...p]; n.splice(idx+1, 0, { ...sl, id: nId, name: sl.name+' copy' }); return n; });
    setActiveLayerId(nId); composite();
  }, [layers, saveUndo, composite]);

  const toggleVis = useCallback((id) => setLayers(p => p.map(l => l.id===id ? {...l, visible: !l.visible} : l)), []);
  const setLayerOp = useCallback((id, v) => setLayers(p => p.map(l => l.id===id ? {...l, opacity: v} : l)), []);
  const setLayerBM = useCallback((id, bm) => setLayers(p => p.map(l => l.id===id ? {...l, blendMode: bm} : l)), []);
  const renameL = useCallback((id, n) => setLayers(p => p.map(l => l.id===id ? {...l, name: n} : l)), []);
  const reorderL = useCallback((f, t) => setLayers(p => { const n = [...p]; const [m] = n.splice(f,1); n.splice(t,0,m); return n; }), []);

  /* ── screen → canvas coords ── */
  const s2c = useCallback((cx, cy) => {
    const dc = dcRef.current; if (!dc) return { x: 0, y: 0 };
    const r = dc.getBoundingClientRect();
    return { x: (cx - r.left) / r.width * CANVAS_SIZE, y: (cy - r.top) / r.height * CANVAS_SIZE };
  }, []);

  /* ── pointer handlers ── */
  const onPtrDown = useCallback((e) => {
    e.preventDefault();
    const dc = dcRef.current; if (dc) dc.setPointerCapture(e.pointerId);
    const currentTool = tempTool || activeTool;
    if (spaceRef.current || currentTool === 'hand') { panningRef.current = true; panStart.current = { x: e.clientX, y: e.clientY, px: panX, py: panY }; return; }
    if (rKeyRef.current) { rotatingRef.current = true; rotStart.current = { x: e.clientX, r: rotation }; return; }
    const pos = s2c(e.clientX, e.clientY);
    const pressure = e.pressure || 0.5;
    if (altRef.current || currentTool === 'eyedropper') {
      const dc2 = dcRef.current; if (dc2) {
        const px = dc2.getContext('2d').getImageData(Math.floor(pos.x), Math.floor(pos.y), 1, 1).data;
        const hex = '#' + [px[0],px[1],px[2]].map(c => c.toString(16).padStart(2,'0')).join('');
        setPrevColor(color); setColor(hex);
      }
      return;
    }
    if (currentTool === 'fill') {
      const ctx = getActiveCtx(); if (ctx) { saveUndo(); floodFill(ctx, pos.x, pos.y, color); composite(); }
      return;
    }
    if (currentTool === 'hand') return;
    drawingRef.current = true;
    resetFlatBrush();
    pathRef.current = [{ x: pos.x, y: pos.y, pressure, timestamp: performance.now() }];
  }, [panX, panY, rotation, activeTool, tempTool, color, s2c, getActiveCtx, saveUndo, composite]);

  const onPtrMove = useCallback((e) => {
    // Move custom cursor via translate3d for GPU acceleration
    const wrap = containerRef.current;
    if (wrap && cursorRef.current) {
      const wr = wrap.getBoundingClientRect();
      const cx = e.clientX - wr.left;
      const cy = e.clientY - wr.top;
      cursorRef.current.style.transform = `translate3d(${cx}px, ${cy}px, 0) translate(-50%, -50%)`;
    }
    const dc = dcRef.current;
    if (!dc) return;
    const currentTool = tempTool || activeTool;
    if ((altRef.current || currentTool === 'eyedropper') && dc) {
      const pos = s2c(e.clientX, e.clientY);
      try { const px = dc.getContext('2d').getImageData(Math.floor(pos.x), Math.floor(pos.y), 1, 1).data;
        setEyePreview('#'+[px[0],px[1],px[2]].map(c=>c.toString(16).padStart(2,'0')).join(''));
      } catch { setEyePreview(null); }
    } else if (eyePreview) { setEyePreview(null); }

    if (panningRef.current) {
      const newPx = panStart.current.px + e.clientX - panStart.current.x;
      const newPy = panStart.current.py + e.clientY - panStart.current.y;
      panXRef.current = newPx; panYRef.current = newPy;
      setPanX(newPx); setPanY(newPy);
      return;
    }
    if (rotatingRef.current) { setRotation(rotStart.current.r + (e.clientX - rotStart.current.x)*0.5); return; }
    if (!drawingRef.current) return;
    const pos = s2c(e.clientX, e.clientY);
    pathRef.current.push({ x: pos.x, y: pos.y, pressure: e.pressure||0.5, timestamp: performance.now() });
    const ctx = getActiveCtx(); if (!ctx) return;
    const path = pathRef.current; if (path.length < 2) return;
    const settings = { size: brushSize, opacity: brushOpacity, hardness: brushHardness, flow: brushFlow, color };
    renderStroke(ctx, path.slice(-2), currentTool, settings);
    composite();
  }, [activeTool, tempTool, s2c, getActiveCtx, brushSize, brushOpacity, brushHardness, brushFlow, color, composite, eyePreview]);

  const onPtrUp = useCallback(() => {
    if (panningRef.current) { panningRef.current = false; return; }
    if (rotatingRef.current) { rotatingRef.current = false; return; }
    if (!drawingRef.current) return;
    drawingRef.current = false;
    resetFlatBrush();
    saveUndo(); pathRef.current = []; composite();
  }, [saveUndo, composite]);

  /* ── wheel zoom (native listener for preventDefault + cursor-position zoom) ── */
  // Keep refs in sync with state
  useEffect(() => { zoomRef.current = zoom; }, [zoom]);
  useEffect(() => { panXRef.current = panX; }, [panX]);
  useEffect(() => { panYRef.current = panY; }, [panY]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const handler = (e) => {
      e.preventDefault();
      e.stopPropagation();
      const fs = fitScaleRef.current;
      const minZ = fs * 0.5, maxZ = fs * 8;
      const oldZ = zoomRef.current;
      const factor = e.deltaY < 0 ? 1.08 : 0.92;
      const newZ = Math.max(minZ, Math.min(maxZ, oldZ * factor));
      if (newZ === oldZ) return;

      // Cursor position relative to container center
      const rect = el.getBoundingClientRect();
      const cx = e.clientX - rect.left - rect.width / 2;
      const cy = e.clientY - rect.top - rect.height / 2;

      // Adjust pan so the point under the cursor stays fixed
      const ratio = newZ / oldZ;
      const oldPx = panXRef.current;
      const oldPy = panYRef.current;
      const newPx = cx - ratio * (cx - oldPx);
      const newPy = cy - ratio * (cy - oldPy);

      zoomRef.current = newZ;
      panXRef.current = newPx;
      panYRef.current = newPy;
      setZoom(newZ);
      setPanX(newPx);
      setPanY(newPy);
    };
    el.addEventListener('wheel', handler, { passive: false });
    return () => el.removeEventListener('wheel', handler);
  }, []);

  /* ── keyboard ── */
  const brushIds = BRUSH_TYPES.filter(b => b.id !== 'eraser').map(b => b.id);
  const cycleBrush = useCallback(() => {
    const i = brushIds.indexOf(activeTool);
    setActiveTool(brushIds[(i+1) % brushIds.length]);
  }, [activeTool, brushIds]);

  const doMint = useCallback(() => {
    if (!onMintNFT) return;
    const S = CANVAS_SIZE;
    const ec = mkCanvas(S, S); const ctx = ec.getContext('2d');
    if (bgColor) { ctx.fillStyle = bgColor; ctx.fillRect(0,0,S,S); }
    for (const l of layers) { if (!l.visible) continue; const lc = lcRef.current[l.id]; if (!lc) continue; ctx.save(); ctx.globalAlpha = l.opacity; ctx.globalCompositeOperation = l.blendMode||'source-over'; ctx.drawImage(lc,0,0); ctx.restore(); }
    onMintNFT(ec.toDataURL('image/png'));
  }, [onMintNFT, bgColor, layers]);

  const clearAll = useCallback(() => {
    saveUndo();
    for (const c of Object.values(lcRef.current)) c.getContext('2d').clearRect(0,0,c.width,c.height);
    composite();
  }, [saveUndo, composite]);

  const createNew = useCallback(() => {
    const bg = BG_OPTIONS.find(b => b.id === newBg);
    initCanvas(bg ? bg.color : '#FFFFFF');
    setShowNewDlg(false);
    setTimeout(doFit, 60);
  }, [newBg, initCanvas, doFit]);

  useEffect(() => {
    const isTyping = () => {
        const el = document.activeElement;
        return el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable);
      };
    const down = (e) => {
      if (isTyping()) return;
      if (e.key === ' ') {
        e.preventDefault();
        if (!spaceRef.current && activeTool !== 'hand') {
          prevToolRef.current = activeTool;
          setTempTool('hand');
        }
        spaceRef.current = true;
      }
      if ((e.key === 'r' || e.key === 'R') && !e.ctrlKey) rKeyRef.current = true;
      if (e.key === 'Alt') { altRef.current = true; if (!prevToolRef.current) prevToolRef.current = activeTool; }
      if (e.ctrlKey || e.metaKey) {
        if (e.key === 'z' && !e.shiftKey) { e.preventDefault(); undo(); }
        if ((e.key === 'z' && e.shiftKey) || e.key === 'Z') { e.preventDefault(); redo(); }
        if (e.key === 'n' || e.key === 'N') { e.preventDefault(); setShowNewDlg(true); }
        if (e.key === '0') { e.preventDefault(); doFit(); }
        if (e.key === '1') { e.preventDefault(); zoomRef.current = 1; panXRef.current = 0; panYRef.current = 0; setZoom(1); setPanX(0); setPanY(0); }
        if (e.key === '=' || e.key === '+') { e.preventDefault(); setZoom(z => { const nz = Math.min(16, z * 1.25); zoomRef.current = nz; return nz; }); }
        if (e.key === '-') { e.preventDefault(); setZoom(z => { const nz = Math.max(fitScaleRef.current * 0.5, z / 1.25); zoomRef.current = nz; return nz; }); }
      }
      if (!e.ctrlKey && !e.metaKey && !e.altKey) {
        if (e.key === 'b' || e.key === 'B') cycleBrush();
        if (e.key === 'e' || e.key === 'E') setActiveTool('eraser');
        if (e.key === 'i' || e.key === 'I') setActiveTool('eyedropper');
        if (e.key === '[') setBrushSize(s => Math.max(1, s-2));
        if (e.key === ']') setBrushSize(s => Math.min(200, s+2));
        if (e.key === 'Escape') setRotation(0);
      }
    };
    const up = (e) => {
      if (isTyping()) return;
      if (e.key === ' ') {
        spaceRef.current = false;
        if (tempTool === 'hand' && prevToolRef.current) {
          setTempTool(null);
          prevToolRef.current = null;
        }
      }
      if (e.key === 'r' || e.key === 'R') rKeyRef.current = false;
      if (e.key === 'Alt') {
        altRef.current = false;
        if (prevToolRef.current && tempTool !== 'hand') {
          setActiveTool(prevToolRef.current);
          prevToolRef.current = null;
        }
      }
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); };
  }, [undo, redo, activeTool, tempTool, cycleBrush, doFit]);

  /* apply defaults on tool change */
  useEffect(() => {
    const def = BRUSH_TYPES.find(b => b.id === activeTool);
    if (def) { setBrushSize(def.defaultSize); setBrushOpacity(def.defaultOpacity); setBrushHardness(def.defaultHardness); setBrushFlow(def.defaultFlow); }
  }, [activeTool]);

  useEffect(() => { try { localStorage.setItem('anft_pal', JSON.stringify(palette)); } catch {} }, [palette]);

  // Cursor size in screen pixels: brush size scaled by current zoom
  const currentTool = tempTool || activeTool;
  const cursorSzCanvas = currentTool === 'pencil' ? Math.max(4, brushSize * 0.3) : brushSize;
  const cursorSz = Math.max(4, cursorSzCanvas * zoom);
  const activeBrush = BRUSH_TYPES.find(b => b.id === currentTool);
  
  // Cursor style for canvas
  const canvasCursor = currentTool === 'hand' ? (panningRef.current ? 'grabbing' : 'grab') : 'none';

  // Zoom percentage relative to fit (fit = 100%)
  const zoomPct = fitScaleRef.current > 0 ? Math.round((zoom / fitScaleRef.current) * 100) : 100;

  /* ── JSX ── */
  return (
    <div className={styles.studio}>
      {/* TOP BAR */}
      <header className={styles.topBar}>
        <div className={styles.topLeft}><span className={styles.appName}>ANFT Studio</span><span className={styles.dim}>{CANVAS_SIZE}×{CANVAS_SIZE}</span></div>
        <div className={styles.topCenter}>
          <button className={styles.tBtn} onClick={() => setShowNewDlg(true)} title="New (Ctrl+N)"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4"/></svg></button>
          <button className={styles.tBtn} onClick={undo} disabled={undoN===0} title="Undo (Ctrl+Z)"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 10h10a5 5 0 015 5v2M3 10l4-4m-4 4l4 4"/></svg></button>
          <button className={styles.tBtn} onClick={redo} disabled={redoN===0} title="Redo (Ctrl+Shift+Z)"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M21 10H11a5 5 0 00-5 5v2m15-7l-4-4m4 4l-4 4"/></svg></button>
          <button className={styles.tBtn} onClick={clearAll} title="Clear Canvas"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg></button>
        </div>
        <div className={styles.topRight}><button className={styles.mintBtn} onClick={doMint}>Mint NFT</button></div>
      </header>

      <div className={styles.mainArea}>
        {/* LEFT TOOLBAR — each tool has icon + name */}
        <aside className={styles.leftBar}>
          {BRUSH_TYPES.map(b => (
            <button key={b.id} className={`${styles.toolItem} ${activeTool===b.id?styles.toolItemOn:''}`} onClick={() => setActiveTool(b.id)} title={b.label}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d={b.icon}/></svg>
              <span className={styles.toolLabel}>{b.label}</span>
            </button>
          ))}
          <div className={styles.tDiv}/>
          <button className={`${styles.toolItem} ${currentTool==='hand'?styles.toolItemOn:''}`} onClick={() => setActiveTool('hand')} title="Hand Tool (Space)">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M7 11.5V14m0-2.5v-6a1.5 1.5 0 113 0m-3 6a1.5 1.5 0 00-3 0v2a7.5 7.5 0 0015 0v-5a1.5 1.5 0 00-3 0m-6-3V11m0-5.5v-1a1.5 1.5 0 013 0v1m0 0V11m0-5.5a1.5 1.5 0 013 0v3m0 0V11"/></svg>
            <span className={styles.toolLabel}>Hand</span>
          </button>
          <div className={styles.tDiv}/>
          <button className={`${styles.toolItem} ${activeTool==='eyedropper'?styles.toolItemOn:''}`} onClick={() => setActiveTool('eyedropper')} title="Eyedropper (I)">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01"/></svg>
            <span className={styles.toolLabel}>Picker</span>
          </button>
          <button className={`${styles.toolItem} ${activeTool==='fill'?styles.toolItemOn:''}`} onClick={() => setActiveTool('fill')} title="Fill Bucket">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z"/></svg>
            <span className={styles.toolLabel}>Fill</span>
          </button>
        </aside>

        {/* CANVAS */}
        <div ref={containerRef} className={styles.canvasWrap}>
          <div className={styles.canvasXform} style={{ transform: `translate(${panX}px,${panY}px) rotate(${rotation}deg) scale(${zoom})` }}>
            <canvas ref={dcRef} width={canvasW} height={canvasH} className={styles.dc}
              onPointerDown={onPtrDown} onPointerMove={onPtrMove} onPointerUp={onPtrUp} onPointerCancel={onPtrUp}
              onPointerEnter={() => { showCursorRef.current = true; setShowCursor(true); }}
              onPointerLeave={() => { showCursorRef.current = false; setShowCursor(false); onPtrUp(); }}
              style={{ cursor: canvasCursor, touchAction: 'none' }}
            />
          </div>
          {/* Custom circular cursor — GPU-accelerated via translate3d */}
          <div
            ref={cursorRef}
            className={styles.brushCursor}
            style={{
              width: cursorSz,
              height: cursorSz,
              opacity: showCursor && currentTool !== 'hand' ? 1 : 0,
            }}
          />
          {/* Eyedropper color preview */}
          {showCursor && (currentTool==='eyedropper'||altRef.current) && eyePreview && cursorRef.current && (
            <div className={styles.eyePreview} style={{
              transform: cursorRef.current.style.transform
                ? cursorRef.current.style.transform.replace('translate(-50%, -50%)', 'translate(8px, -36px)')
                : undefined
            }}>
              <div style={{ width:24, height:24, borderRadius:'50%', background:eyePreview, border:'2px solid #fff', boxShadow:'0 2px 8px rgba(0,0,0,0.3)' }}/>
            </div>
          )}
          <div className={styles.zoomBadge}>{zoomPct}%</div>
        </div>

        {/* RIGHT SIDEBAR */}
        <aside className={styles.rightBar}>
          <div className={styles.rTabs}>
            <button className={`${styles.rTab} ${rTab==='brush'?styles.rTabOn:''}`} onClick={() => setRTab('brush')}>Brush</button>
            <button className={`${styles.rTab} ${rTab==='layers'?styles.rTabOn:''}`} onClick={() => setRTab('layers')}>Layers</button>
          </div>
          <div className={styles.rBody}>
            {rTab === 'brush' && (
              <div className={styles.brushPanel}>
                {activeBrush && <div className={styles.bpTitle}>{activeBrush.label}</div>}
                <label className={styles.sliderLabel}>Size <span>{brushSize}px</span></label>
                <input type="range" min="1" max="200" value={brushSize} onChange={e => setBrushSize(+e.target.value)} className={styles.slider}/>
                <label className={styles.sliderLabel}>Opacity <span>{Math.round(brushOpacity*100)}%</span></label>
                <input type="range" min="0.01" max="1" step="0.01" value={brushOpacity} onChange={e => setBrushOpacity(+e.target.value)} className={styles.slider}/>
                <label className={styles.sliderLabel}>Hardness <span>{Math.round(brushHardness*100)}%</span></label>
                <input type="range" min="0" max="1" step="0.01" value={brushHardness} onChange={e => setBrushHardness(+e.target.value)} className={styles.slider}/>
                <label className={styles.sliderLabel}>Flow <span>{Math.round(brushFlow*100)}%</span></label>
                <input type="range" min="0.01" max="1" step="0.01" value={brushFlow} onChange={e => setBrushFlow(+e.target.value)} className={styles.slider}/>
                <div className={styles.secDivider}/>
                <div className={styles.bpTitle}>Color</div>
                <ColorPickerHSB color={color} previousColor={prevColor} opacity={brushOpacity} onChange={c => { setPrevColor(color); setColor(c); }} onOpacityChange={setBrushOpacity}/>
                <div className={styles.secDivider}/>
                <div className={styles.bpTitle}>Texture</div>
                <select value={texId} onChange={e => setTexId(e.target.value)} className={styles.sel}>
                  {TEXTURES.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
                </select>
                {texId !== 'none' && <>
                  <label className={styles.sliderLabel}>Intensity <span>{Math.round(texInt*100)}%</span></label>
                  <input type="range" min="0" max="1" step="0.01" value={texInt} onChange={e => setTexInt(+e.target.value)} className={styles.slider}/>
                </>}
              </div>
            )}
            {rTab === 'layers' && (
              <LayersPanel layers={layers} activeLayerId={activeLayerId}
                onSetActive={setActiveLayerId} onAdd={addLayer} onDelete={deleteLayer} onDuplicate={duplicateLayer}
                onToggleVisibility={toggleVis} onSetOpacity={setLayerOp} onSetBlendMode={setLayerBM}
                onRename={renameL} onReorder={reorderL}
              />
            )}
          </div>
        </aside>
      </div>

      {/* BOTTOM BAR */}
      <footer className={styles.bottomBar}>
        <div className={styles.palRow}>
          {palette.map((c, i) => (
            <button key={i} className={`${styles.palSwatch} ${color===c?styles.palActive:''}`}
              style={{ background: c || '#f0f0f0' }}
              onClick={() => { if (c) { setPrevColor(color); setColor(c); } }}
              onContextMenu={(e) => { e.preventDefault(); setPalette(p => { const n=[...p]; n[i]=color; return n; }); }}
              title={c ? `${c} (right-click to save current)` : 'Right-click to save'}
            />
          ))}
        </div>
        <div className={styles.zoomCtl}>
          <button className={styles.zBtn} onClick={() => setZoom(z => { const nz = Math.max(fitScaleRef.current * 0.5, z / 1.25); zoomRef.current = nz; return nz; })} title="Zoom Out (Ctrl+-)">−</button>
          <input
            type="range"
            className={styles.zoomSlider}
            min={50}
            max={800}
            value={zoomPct}
            onChange={e => { const nz = fitScaleRef.current * (+e.target.value / 100); zoomRef.current = nz; setZoom(nz); }}
            title={`${zoomPct}%`}
          />
          <button className={styles.zBtn} onClick={() => setZoom(z => { const nz = Math.min(fitScaleRef.current * 8, z * 1.25); zoomRef.current = nz; return nz; })} title="Zoom In (Ctrl++)">+</button>
          <button className={styles.zBtn} onClick={doFit} title="Fit (Ctrl+0)">{zoomPct}%</button>
        </div>
      </footer>

      {/* NEW CANVAS DIALOG */}
      {showNewDlg && (
        <div className={styles.overlay} onClick={() => setShowNewDlg(false)}>
          <div className={styles.dialog} onClick={e => e.stopPropagation()}>
            <h3 className={styles.dlgTitle}>New Canvas</h3>
            <p style={{ fontSize:12, color:'#888', margin:'0 0 12px' }}>{CANVAS_SIZE}×{CANVAS_SIZE}px</p>
            <div className={styles.dlgRow}>
              <label>Background</label>
              <div style={{ display:'flex', gap:6 }}>
                {BG_OPTIONS.map(b => (
                  <button key={b.id} className={`${styles.bgBtn} ${newBg===b.id?styles.bgBtnOn:''}`} onClick={() => setNewBg(b.id)}
                    style={{ background: b.color || 'repeating-conic-gradient(#e0e0e0 0% 25%, #fff 0% 50%) 50% / 12px 12px' }}
                    title={b.label}
                  />
                ))}
              </div>
            </div>
            <div style={{ display:'flex', gap:8, marginTop:16, justifyContent:'flex-end' }}>
              <button className={styles.tBtn} onClick={() => setShowNewDlg(false)}>Cancel</button>
              <button className={styles.mintBtn} onClick={createNew}>Create</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
