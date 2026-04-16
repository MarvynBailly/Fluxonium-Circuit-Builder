import React from 'react';
import { ELEMENT_TYPES } from '../circuit/elementTypes.js';

const inputStyle = {
  display: 'block',
  width: '100%',
  background: 'var(--bg-input)',
  border: '1px solid var(--border)',
  borderRadius: 4,
  padding: '6px 8px',
  color: 'var(--text-primary)',
  fontFamily: 'inherit',
  fontSize: 13,
  marginTop: 4,
};

export default function PropertiesPanel({ selected, nodes, edges, onUpdateNode, onUpdateEdge, onDelete }) {
  if (!selected) return null;

  if (selected.type === 'node') {
    const node = nodes.find((n) => n.id === selected.id);
    if (!node) return null;
    return (
      <div style={panelStyle}>
        <div style={headerStyle}>PROPERTIES</div>
        <label style={{ display: 'block', marginBottom: 8 }}>
          <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>Label</span>
          <input
            value={node.label}
            onChange={(e) => onUpdateNode(node.id, { label: e.target.value })}
            style={inputStyle}
          />
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', marginBottom: 12 }}>
          <input
            type="checkbox"
            checked={node.isGround}
            onChange={(e) => onUpdateNode(node.id, { isGround: e.target.checked })}
          />
          <span>Ground node</span>
        </label>
        <button onClick={onDelete} style={deleteStyle}>Delete node</button>
      </div>
    );
  }

  if (selected.type === 'edge') {
    const edge = edges.find((e) => e.id === selected.id);
    if (!edge) return null;
    const info = ELEMENT_TYPES[edge.type];
    return (
      <div style={panelStyle}>
        <div style={headerStyle}>PROPERTIES</div>
        <div style={{ marginBottom: 8, color: info.color }}>{info.label}</div>
        <label style={{ display: 'block', marginBottom: 12 }}>
          <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>Value ({info.unit})</span>
          <input
            type="number"
            step="any"
            value={edge.value}
            onChange={(e) => onUpdateEdge(edge.id, { value: parseFloat(e.target.value) || 0 })}
            style={inputStyle}
          />
        </label>
        <button onClick={onDelete} style={deleteStyle}>Delete element</button>
      </div>
    );
  }

  return null;
}

const panelStyle = {
  position: 'absolute',
  top: 12,
  right: 12,
  background: 'var(--bg-card)',
  border: '1px solid var(--border)',
  borderRadius: 8,
  padding: 16,
  minWidth: 220,
  fontSize: 13,
};

const headerStyle = {
  fontWeight: 600,
  marginBottom: 12,
  color: 'var(--text-secondary)',
  fontSize: 11,
  letterSpacing: 1,
};

const deleteStyle = {
  width: '100%',
  padding: '6px 0',
  background: 'transparent',
  border: '1px solid var(--accent-red)',
  borderRadius: 4,
  color: 'var(--accent-red)',
  fontSize: 12,
  cursor: 'pointer',
  fontFamily: 'inherit',
};
