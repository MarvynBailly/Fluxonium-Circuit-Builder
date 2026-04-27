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

export default function WirePropertiesPanel({
  selected,
  wire,
  onSetComponentType,
  onSetComponentValue,
  onDelete,
}) {
  if (!selected) return null;

  if (selected.kind === 'wireComponent') {
    const c = wire.components.find((x) => x.id === selected.id);
    if (!c) return null;
    const info = ELEMENT_TYPES[c.type];
    return (
      <div style={panelStyle}>
        <div style={headerStyle}>COMPONENT</div>
        <div style={{ marginBottom: 8, color: info.color }}>{info.label}</div>
        <label style={{ display: 'block', marginBottom: 8 }}>
          <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>Type</span>
          <select
            value={c.type}
            onChange={(e) => onSetComponentType(c.id, e.target.value)}
            style={inputStyle}
          >
            {Object.values(ELEMENT_TYPES).map((t) => (
              <option key={t.id} value={t.id}>
                {t.label}
              </option>
            ))}
          </select>
        </label>
        <label style={{ display: 'block', marginBottom: 12 }}>
          <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>
            Symbol (LaTeX)
          </span>
          <input
            type="text"
            value={c.value}
            onChange={(e) => onSetComponentValue(c.id, e.target.value)}
            placeholder={`${info.symbol}_{i}`}
            style={{ ...inputStyle, fontFamily: 'var(--font-mono)' }}
          />
        </label>
        <button onClick={onDelete} style={deleteStyle}>
          Remove component (wire stays)
        </button>
      </div>
    );
  }

  if (selected.kind === 'wireSegment') {
    return (
      <div style={panelStyle}>
        <div style={headerStyle}>WIRE SEGMENT</div>
        <div style={{ color: 'var(--text-muted)', fontSize: 11, marginBottom: 12 }}>
          Pure wire connection between two vertices.
        </div>
        <button onClick={onDelete} style={deleteStyle}>
          Delete segment
        </button>
      </div>
    );
  }

  if (selected.kind === 'wireVertex') {
    return (
      <div style={panelStyle}>
        <div style={headerStyle}>WIRE VERTEX</div>
        <div style={{ color: 'var(--text-muted)', fontSize: 11, marginBottom: 12 }}>
          Visual turning point
        </div>
        <button onClick={onDelete} style={deleteStyle}>
          Delete vertex
        </button>
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
