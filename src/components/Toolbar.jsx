import React from 'react';
import { ELEMENT_TYPES } from '../circuit/index.js';

const barStyle = {
  padding: '10px 24px',
  borderBottom: '1px solid var(--border)',
  display: 'flex',
  gap: 8,
  flexWrap: 'wrap',
  alignItems: 'center',
};

const labelStyle = {
  fontSize: 11,
  color: 'var(--text-muted)',
  marginRight: 8,
};

function toolButtonStyle(active, color) {
  return {
    padding: '8px 14px',
    border: active ? `2px solid ${color || 'var(--text-primary)'}` : '2px solid transparent',
    borderRadius: 8,
    background: active ? 'var(--tool-active-bg)' : 'transparent',
    color: 'var(--text-primary)',
    cursor: 'pointer',
    fontSize: 13,
    fontFamily: 'var(--font-mono)',
    transition: 'all 0.15s',
  };
}

function modeButtonStyle(active) {
  return {
    padding: '6px 12px',
    border: '1px solid var(--border)',
    borderRadius: 6,
    background: active ? 'var(--tool-active-bg)' : 'transparent',
    color: active ? 'var(--text-primary)' : 'var(--text-muted)',
    cursor: 'pointer',
    fontSize: 12,
    fontFamily: 'var(--font-mono)',
  };
}

export default function Toolbar({
  mode,
  onSetMode,
  selectedTool,
  onSelectTool,
  connectFrom,
  drawingFromVertexId,
  placingGroundFor,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  showEdgeLabels,
  onToggleLabels,
  onResetView,
}) {
  const isWire = mode === 'wire';

  return (
    <div style={barStyle}>
      <span style={labelStyle}>MODE:</span>
      <div style={{ display: 'flex', gap: 0 }}>
        <button
          style={{ ...modeButtonStyle(isWire), borderRadius: '6px 0 0 6px' }}
          onClick={() => onSetMode('wire')}
          title="Lay down wires first, then drop components"
        >
          Wire
        </button>
        <button
          style={{ ...modeButtonStyle(!isWire), borderRadius: '0 6px 6px 0', borderLeft: 'none' }}
          onClick={() => onSetMode('schematic')}
          title="Place nodes, then connect them"
        >
          Legacy
        </button>
      </div>

      <span style={{ color: 'var(--border)', margin: '0 4px' }}>|</span>

      <span style={labelStyle}>TOOLS:</span>

      {isWire ? (
        <button
          style={toolButtonStyle(selectedTool === 'wire')}
          onClick={() => onSelectTool('wire')}
        >
          Wire
        </button>
      ) : (
        <button
          style={toolButtonStyle(selectedTool === 'node')}
          onClick={() => onSelectTool('node')}
        >
          Node
        </button>
      )}

      {Object.values(ELEMENT_TYPES).map((t) => (
        <button
          key={t.id}
          style={toolButtonStyle(selectedTool === t.id, t.color)}
          onClick={() => onSelectTool(t.id)}
        >
          <span style={{ color: t.color, marginRight: 4 }}>■</span> {t.label}
        </button>
      ))}

      {isWire && (
        <button
          style={toolButtonStyle(selectedTool === 'GND', '#9ca3af')}
          onClick={() => onSelectTool('GND')}
          title="Drop a ground marker on a wire — pins that node's φ to a constant"
        >
          <span style={{ marginRight: 4 }}>⏚</span> Ground
        </button>
      )}

      <span style={{ color: 'var(--border)', margin: '0 4px' }}>|</span>

      <button
        style={{ ...toolButtonStyle(false), opacity: canUndo ? 1 : 0.3 }}
        onClick={onUndo}
        disabled={!canUndo}
      >
        Undo
      </button>
      <button
        style={{ ...toolButtonStyle(false), opacity: canRedo ? 1 : 0.3 }}
        onClick={onRedo}
        disabled={!canRedo}
      >
        Redo
      </button>

      {!isWire && connectFrom !== null && (
        <span style={{ fontSize: 12, color: 'var(--accent-amber)' }}>Click target node…</span>
      )}
      {isWire && selectedTool === 'wire' && drawingFromVertexId === null && (
        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
          Click to start a wire — snaps to grid (hold Shift to free-place)
        </span>
      )}
      {isWire && selectedTool === 'wire' && drawingFromVertexId !== null && (
        <span style={{ fontSize: 12, color: 'var(--accent-amber)' }}>
          Click to extend · snap to a vertex to close · Shift = free
        </span>
      )}
      {isWire && (selectedTool === 'C' || selectedTool === 'L' || selectedTool === 'JJ') && (
        <span style={{ fontSize: 12, color: 'var(--accent-amber)' }}>
          Click anywhere on a wire — snaps to ¼, ⅓, ½, ⅔, ¾
        </span>
      )}
      {isWire && selectedTool === 'GND' && placingGroundFor === null && (
        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
          Click a wire or vertex to set the anchor — click an existing ⏚ to remove it
        </span>
      )}
      {isWire && selectedTool === 'GND' && placingGroundFor !== null && (
        <span style={{ fontSize: 12, color: 'var(--accent-amber)' }}>
          Click to place the ⏚ glyph — snaps to N/S/E/W (Shift = free), Esc to cancel
        </span>
      )}

      <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
        <button style={toolButtonStyle(false)} onClick={onToggleLabels}>
          {showEdgeLabels ? 'Hide labels' : 'Show labels'}
        </button>
        <button style={toolButtonStyle(false)} onClick={onResetView}>
          Fit view
        </button>
      </div>
    </div>
  );
}
