'use client';
import React, { useState } from 'react';

const BLEND_MODES = [
  { id: 'source-over', label: 'Normal' },
  { id: 'multiply', label: 'Multiply' },
  { id: 'screen', label: 'Screen' },
  { id: 'overlay', label: 'Overlay' },
];

export default function LayersPanel({ layers, activeLayerId, onSetActive, onAdd, onDelete, onDuplicate, onToggleVisibility, onSetOpacity, onSetBlendMode, onRename, onReorder }) {
  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState('');
  const [dragIdx, setDragIdx] = useState(null);

  const startRename = (layer) => {
    setEditingId(layer.id);
    setEditName(layer.name);
  };

  const commitRename = () => {
    if (editingId && editName.trim()) {
      onRename(editingId, editName.trim());
    }
    setEditingId(null);
  };

  // Layers render top-to-bottom (highest index = top layer shown first)
  const reversed = [...layers].reverse();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', fontSize: 12 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 10px', borderBottom: '1px solid #e5e5e5' }}>
        <span style={{ fontWeight: 700, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.04em', color: '#666' }}>Layers</span>
        <button
          onClick={onAdd}
          disabled={layers.length >= 10}
          style={{ width: 24, height: 24, border: 'none', borderRadius: 6, background: layers.length >= 10 ? '#e5e5e5' : '#0d9488', color: '#fff', cursor: layers.length >= 10 ? 'not-allowed' : 'pointer', fontSize: 16, lineHeight: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          title="Add layer"
        >+</button>
      </div>

      {/* Layer list */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '4px 0' }}>
        {reversed.map((layer, vi) => {
          const realIdx = layers.length - 1 - vi;
          const isActive = layer.id === activeLayerId;
          return (
            <div
              key={layer.id}
              onClick={() => onSetActive(layer.id)}
              draggable
              onDragStart={() => setDragIdx(realIdx)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => { if (dragIdx !== null && dragIdx !== realIdx) { onReorder(dragIdx, realIdx); } setDragIdx(null); }}
              style={{
                display: 'flex', alignItems: 'center', gap: 6, padding: '6px 10px',
                background: isActive ? 'rgba(13,148,136,0.08)' : 'transparent',
                borderLeft: isActive ? '3px solid #0d9488' : '3px solid transparent',
                cursor: 'pointer', transition: 'background 0.1s',
              }}
            >
              {/* Visibility toggle */}
              <button
                onClick={(e) => { e.stopPropagation(); onToggleVisibility(layer.id); }}
                style={{ width: 20, height: 20, border: 'none', background: 'none', cursor: 'pointer', padding: 0, opacity: layer.visible ? 1 : 0.3 }}
                title={layer.visible ? 'Hide' : 'Show'}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                  {layer.visible ? (
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  ) : (
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M3 3l18 18" />
                  )}
                </svg>
              </button>

              {/* Layer thumbnail (tiny colored square) */}
              <div style={{ width: 24, height: 24, borderRadius: 4, background: '#f3f3f3', border: '1px solid #e0e0e0', flexShrink: 0, overflow: 'hidden' }}>
                {layer.thumbnail && <img src={layer.thumbnail} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
              </div>

              {/* Name */}
              <div style={{ flex: 1, minWidth: 0 }}>
                {editingId === layer.id ? (
                  <input
                    autoFocus
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    onBlur={commitRename}
                    onKeyDown={(e) => { if (e.key === 'Enter') commitRename(); if (e.key === 'Escape') setEditingId(null); }}
                    onClick={(e) => e.stopPropagation()}
                    style={{ width: '100%', border: '1px solid #0d9488', borderRadius: 4, padding: '2px 4px', fontSize: 11, outline: 'none' }}
                  />
                ) : (
                  <span
                    onDoubleClick={(e) => { e.stopPropagation(); startRename(layer); }}
                    style={{ fontSize: 11, fontWeight: isActive ? 600 : 400, color: '#333', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }}
                  >{layer.name}</span>
                )}
              </div>

              {/* Opacity */}
              <span style={{ fontSize: 10, color: '#999', width: 28, textAlign: 'right', flexShrink: 0 }}>{Math.round(layer.opacity * 100)}%</span>
            </div>
          );
        })}
      </div>

      {/* Active layer controls */}
      {layers.find(l => l.id === activeLayerId) && (() => {
        const active = layers.find(l => l.id === activeLayerId);
        return (
          <div style={{ borderTop: '1px solid #e5e5e5', padding: '8px 10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 6 }}>
              <span style={{ fontSize: 10, color: '#888', width: 42 }}>Opacity</span>
              <input
                type="range" min="0" max="1" step="0.01" value={active.opacity}
                onChange={(e) => onSetOpacity(active.id, parseFloat(e.target.value))}
                style={{ flex: 1, height: 4, accentColor: '#0d9488' }}
              />
              <span style={{ fontSize: 10, width: 26, textAlign: 'right', color: '#666' }}>{Math.round(active.opacity * 100)}%</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 6 }}>
              <span style={{ fontSize: 10, color: '#888', width: 42 }}>Blend</span>
              <select
                value={active.blendMode}
                onChange={(e) => onSetBlendMode(active.id, e.target.value)}
                style={{ flex: 1, height: 22, border: '1px solid #e0e0e0', borderRadius: 4, fontSize: 10, background: '#fafafa', color: '#333' }}
              >
                {BLEND_MODES.map(bm => <option key={bm.id} value={bm.id}>{bm.label}</option>)}
              </select>
            </div>
            <div style={{ display: 'flex', gap: 4 }}>
              <button onClick={() => onDuplicate(active.id)} style={btnStyle} title="Duplicate">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
              </button>
              <button onClick={() => onDelete(active.id)} disabled={layers.length <= 1} style={{ ...btnStyle, opacity: layers.length <= 1 ? 0.3 : 1 }} title="Delete">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
              </button>
            </div>
          </div>
        );
      })()}
    </div>
  );
}

const btnStyle = {
  flex: 1, height: 26, border: '1px solid #e0e0e0', borderRadius: 6,
  background: '#fafafa', cursor: 'pointer', display: 'flex',
  alignItems: 'center', justifyContent: 'center', color: '#555',
};
