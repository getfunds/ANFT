'use client';
import React, { useState, useRef, useCallback, useEffect } from 'react';

// ─── Color conversion helpers ───────────────────────────────────────────────

function hsvToRgb(h, s, v) {
  h = ((h % 360) + 360) % 360;
  s = Math.max(0, Math.min(1, s));
  v = Math.max(0, Math.min(1, v));
  const c = v * s, x = c * (1 - Math.abs(((h / 60) % 2) - 1)), m = v - c;
  let r, g, b;
  if (h < 60)       { r = c; g = x; b = 0; }
  else if (h < 120) { r = x; g = c; b = 0; }
  else if (h < 180) { r = 0; g = c; b = x; }
  else if (h < 240) { r = 0; g = x; b = c; }
  else if (h < 300) { r = x; g = 0; b = c; }
  else              { r = c; g = 0; b = x; }
  return [Math.round((r + m) * 255), Math.round((g + m) * 255), Math.round((b + m) * 255)];
}

function rgbToHsv(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
  let h = 0;
  if (d !== 0) {
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60; if (h < 0) h += 360;
  }
  return [h, max === 0 ? 0 : d / max, max];
}

function rgbToHex(r, g, b) {
  return '#' + [r, g, b].map(c => c.toString(16).padStart(2, '0')).join('');
}

function hexToRgb(hex) {
  hex = hex.replace('#', '');
  if (hex.length === 3) hex = hex[0]+hex[0]+hex[1]+hex[1]+hex[2]+hex[2];
  return [parseInt(hex.slice(0,2),16), parseInt(hex.slice(2,4),16), parseInt(hex.slice(4,6),16)];
}

// ─── Component ──────────────────────────────────────────────────────────────

export default function ColorPickerHSB({ color, previousColor, opacity, onChange, onOpacityChange }) {
  const [hsv, setHsv] = useState(() => {
    const rgb = hexToRgb(color || '#000000');
    return rgbToHsv(rgb[0], rgb[1], rgb[2]);
  });
  const [hexInput, setHexInput] = useState(color || '#000000');
  const [dragging, setDragging] = useState(null); // 'hue' | 'sv' | 'opacity'
  const svRef = useRef(null);
  const hueRef = useRef(null);
  const opRef = useRef(null);

  // Sync external color changes
  useEffect(() => {
    const rgb = hexToRgb(color || '#000000');
    const newHsv = rgbToHsv(rgb[0], rgb[1], rgb[2]);
    setHsv(newHsv);
    setHexInput(color || '#000000');
  }, [color]);

  const emitColor = useCallback((h, s, v) => {
    const rgb = hsvToRgb(h, s, v);
    const hex = rgbToHex(rgb[0], rgb[1], rgb[2]);
    setHsv([h, s, v]);
    setHexInput(hex);
    onChange(hex);
  }, [onChange]);

  // ─── SV Square ────────────────────────────────────────────────────────
  const handleSV = useCallback((e) => {
    const rect = svRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const y = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));
    emitColor(hsv[0], x, 1 - y);
  }, [hsv, emitColor]);

  // ─── Hue Bar ──────────────────────────────────────────────────────────
  const handleHue = useCallback((e) => {
    const rect = hueRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    emitColor(x * 360, hsv[1], hsv[2]);
  }, [hsv, emitColor]);

  // ─── Opacity Bar ──────────────────────────────────────────────────────
  const handleOpacity = useCallback((e) => {
    if (!onOpacityChange) return;
    const rect = opRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    onOpacityChange(Math.round(x * 100) / 100);
  }, [onOpacityChange]);

  // ─── Drag handling ────────────────────────────────────────────────────
  useEffect(() => {
    if (!dragging) return;
    const handler = (e) => {
      e.preventDefault();
      if (dragging === 'sv') handleSV(e);
      else if (dragging === 'hue') handleHue(e);
      else if (dragging === 'opacity') handleOpacity(e);
    };
    const up = () => setDragging(null);
    window.addEventListener('pointermove', handler);
    window.addEventListener('pointerup', up);
    return () => { window.removeEventListener('pointermove', handler); window.removeEventListener('pointerup', up); };
  }, [dragging, handleSV, handleHue, handleOpacity]);

  // Hex input
  const handleHexChange = (val) => {
    setHexInput(val);
    if (/^#[0-9a-fA-F]{6}$/.test(val)) {
      const rgb = hexToRgb(val);
      const newHsv = rgbToHsv(rgb[0], rgb[1], rgb[2]);
      setHsv(newHsv);
      onChange(val);
    }
  };

  const hueColor = rgbToHex(...hsvToRgb(hsv[0], 1, 1));
  const currentRgb = hsvToRgb(hsv[0], hsv[1], hsv[2]);

  return (
    <div style={{ width: '100%', userSelect: 'none' }}>
      {/* SV Square */}
      <div
        ref={svRef}
        onPointerDown={(e) => { setDragging('sv'); handleSV(e); }}
        style={{
          width: '100%', aspectRatio: '1', borderRadius: 8, position: 'relative', cursor: 'crosshair', marginBottom: 8,
          background: `linear-gradient(to top, #000, transparent), linear-gradient(to right, #fff, ${hueColor})`,
        }}
      >
        <div style={{
          position: 'absolute',
          left: `${hsv[1] * 100}%`, top: `${(1 - hsv[2]) * 100}%`,
          width: 14, height: 14, borderRadius: '50%',
          border: '2px solid #fff', boxShadow: '0 0 3px rgba(0,0,0,0.5)',
          transform: 'translate(-50%, -50%)', pointerEvents: 'none',
        }} />
      </div>

      {/* Hue Bar */}
      <div
        ref={hueRef}
        onPointerDown={(e) => { setDragging('hue'); handleHue(e); }}
        style={{
          width: '100%', height: 14, borderRadius: 7, cursor: 'pointer', position: 'relative', marginBottom: 8,
          background: 'linear-gradient(to right, #f00, #ff0, #0f0, #0ff, #00f, #f0f, #f00)',
        }}
      >
        <div style={{
          position: 'absolute', left: `${(hsv[0] / 360) * 100}%`, top: '50%',
          width: 14, height: 14, borderRadius: '50%',
          border: '2px solid #fff', boxShadow: '0 0 3px rgba(0,0,0,0.4)',
          transform: 'translate(-50%, -50%)', pointerEvents: 'none',
          background: hueColor,
        }} />
      </div>

      {/* Opacity Bar */}
      {onOpacityChange && (
        <div
          ref={opRef}
          onPointerDown={(e) => { setDragging('opacity'); handleOpacity(e); }}
          style={{
            width: '100%', height: 14, borderRadius: 7, cursor: 'pointer', position: 'relative', marginBottom: 10,
            background: `linear-gradient(to right, transparent, ${rgbToHex(currentRgb[0], currentRgb[1], currentRgb[2])})`,
            backgroundImage: `linear-gradient(to right, rgba(${currentRgb.join(',')},0), rgba(${currentRgb.join(',')},1))`,
            backgroundColor: '#e5e5e5',
          }}
        >
          <div style={{
            position: 'absolute', left: `${(opacity ?? 1) * 100}%`, top: '50%',
            width: 14, height: 14, borderRadius: '50%',
            border: '2px solid #fff', boxShadow: '0 0 3px rgba(0,0,0,0.4)',
            transform: 'translate(-50%, -50%)', pointerEvents: 'none',
            background: `rgba(${currentRgb.join(',')},${opacity ?? 1})`,
          }} />
        </div>
      )}

      {/* Swatches + Hex */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <div style={{ width: 28, height: 28, borderRadius: 6, background: color, border: '1px solid rgba(0,0,0,0.15)' }} title="Current" />
        {previousColor && (
          <div
            onClick={() => onChange(previousColor)}
            style={{ width: 28, height: 28, borderRadius: 6, background: previousColor, border: '1px solid rgba(0,0,0,0.1)', cursor: 'pointer', opacity: 0.7 }}
            title="Previous"
          />
        )}
        <input
          type="text"
          value={hexInput}
          onChange={(e) => handleHexChange(e.target.value)}
          maxLength={7}
          style={{
            flex: 1, height: 28, border: '1px solid #e0e0e0', borderRadius: 6,
            padding: '0 6px', fontSize: 11, fontFamily: 'monospace',
            background: '#fafafa', color: '#333', outline: 'none', minWidth: 0,
          }}
        />
      </div>

      {/* RGB sliders */}
      <div style={{ marginTop: 8, display: 'grid', gap: 3 }}>
        {['R', 'G', 'B'].map((ch, ci) => (
          <div key={ch} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ fontSize: 10, fontWeight: 600, color: '#888', width: 12 }}>{ch}</span>
            <input
              type="range" min="0" max="255" value={currentRgb[ci]}
              onChange={(e) => {
                const v = parseInt(e.target.value);
                const newRgb = [...currentRgb];
                newRgb[ci] = v;
                const hex = rgbToHex(newRgb[0], newRgb[1], newRgb[2]);
                const newHsv = rgbToHsv(newRgb[0], newRgb[1], newRgb[2]);
                setHsv(newHsv);
                setHexInput(hex);
                onChange(hex);
              }}
              style={{ flex: 1, height: 4, accentColor: ['#ef4444','#22c55e','#3b82f6'][ci] }}
            />
            <span style={{ fontSize: 10, color: '#666', width: 22, textAlign: 'right' }}>{currentRgb[ci]}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
