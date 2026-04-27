import React from 'react';
import { ELEMENT_TYPES } from '../circuit/index.js';

const sectionHeader = (color, text) => (
  <div style={{ color, fontWeight: 600, marginBottom: 8, fontSize: 11, letterSpacing: 0.5 }}>
    {text}
  </div>
);

const baseInputStyle = {
  background: 'var(--bg-input)',
  border: '1px solid var(--border)',
  borderRadius: 4,
  padding: '4px 6px',
  fontFamily: 'var(--font-mono)',
  fontSize: 14,
  minWidth: 0,
  width: '100%',
};

const colorSwatchStyle = {
  width: 22,
  height: 22,
  padding: 0,
  border: '1px solid var(--border)',
  borderRadius: 4,
  background: 'transparent',
  cursor: 'pointer',
};

/**
 * Left-side panel listing every electrical node and component, with
 * matching coloring / labeling controls. Layout mirrors the right-side
 * HamiltonianPanel: sections with overflow-x scrolling and grid rows
 * that shrink gracefully (minmax(0, 1fr)) as the panel narrows.
 */
export default function NodeLabelsPanel({
  nodes,
  onUpdateNode,
  components,
  onUpdateComponent,
  width = 380,
  onResizeStart,
  highlightedNodeId = null,
  highlightedComponentId = null,
  onHighlightNode,
  onFocusItem,
  onBlurItem,
  onSetAllNodeColors,
  onSetAllComponentColorsOfType,
}) {
  const focusNode = (id) => onFocusItem?.('node', id);
  const focusComponent = (id) => onFocusItem?.('component', id);
  const blurItem = () => onBlurItem?.();
  return (
    <div
      style={{
        width,
        borderRight: '1px solid var(--border)',
        padding: 20,
        overflowY: 'auto',
        background: 'var(--bg-panel)',
        fontSize: 12,
        flexShrink: 0,
        position: 'relative',
      }}
    >
      <div
        onMouseDown={onResizeStart}
        title="Drag to resize"
        style={{
          position: 'absolute',
          top: 0,
          right: -3,
          width: 6,
          height: '100%',
          cursor: 'col-resize',
          zIndex: 10,
          background: 'transparent',
        }}
      />

      <div
        style={{
          fontWeight: 600,
          color: 'var(--accent-amber)',
          fontSize: 11,
          letterSpacing: 1,
          marginBottom: 16,
        }}
      >
        CIRCUIT LABELS
      </div>

      <section>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            marginBottom: 8,
          }}
        >
          <div
            style={{
              color: 'var(--text-secondary)',
              fontWeight: 600,
              fontSize: 11,
              letterSpacing: 0.5,
              flex: 1,
            }}
          >
            ELECTRICAL NODES
          </div>
          {onSetAllNodeColors && nodes.length > 0 && (
            <input
              type="color"
              value={nodes[0].color || '#888888'}
              onChange={(e) => onSetAllNodeColors(e.target.value)}
              title="Set color for all nodes"
              style={colorSwatchStyle}
            />
          )}
        </div>
        <div style={{ overflowX: 'auto' }}>
          {nodes.length === 0 ? (
            <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>
              No nodes yet. Lay down wires and components — nodes are detected automatically.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minWidth: 220 }}>
              {nodes.map((n) => {
                const isHighlighted = highlightedNodeId === n.id;
                return (
                <div
                  key={n.id}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '22px minmax(0, 1fr) auto',
                    alignItems: 'center',
                    gap: 6,
                    padding: '2px 4px',
                    borderRadius: 4,
                    background: isHighlighted ? 'var(--bg-input)' : 'transparent',
                    boxShadow: isHighlighted ? `inset 3px 0 0 ${n.color || 'var(--accent-blue)'}` : 'none',
                  }}
                >
                  {n.color !== undefined ? (
                    <input
                      type="color"
                      value={n.color}
                      onChange={(e) => onUpdateNode(n.id, { color: e.target.value })}
                      onFocus={() => focusNode(n.id)}
                      onBlur={blurItem}
                      title="Node color"
                      style={colorSwatchStyle}
                    />
                  ) : (
                    <span />
                  )}
                  <input
                    value={n.label}
                    onChange={(e) => onUpdateNode(n.id, { label: e.target.value })}
                    onFocus={() => focusNode(n.id)}
                    onBlur={blurItem}
                    placeholder="auto"
                    style={{
                      ...baseInputStyle,
                      color: n.userLabel ? 'var(--text-primary)' : 'var(--text-secondary)',
                      fontStyle: n.userLabel ? 'normal' : 'italic',
                    }}
                  />
                  <label
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4,
                      fontSize: 14,
                      color: 'var(--text-secondary)',
                      cursor: 'pointer',
                    }}
                    title="Mark as ground"
                  >
                    <input
                      type="checkbox"
                      checked={!!n.isGround}
                      onChange={(e) => onUpdateNode(n.id, { isGround: e.target.checked })}
                    />
                    ⏚
                  </label>
                </div>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {components && (
        <section style={{ marginTop: 20 }}>
          {sectionHeader('var(--text-secondary)', 'COMPONENTS')}
          {components.length === 0 ? (
            <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>
              No components yet. Pick C / L / JJ from the toolbar and click on a wire.
            </div>
          ) : (
            ['C', 'L', 'JJ'].map((typeKey) => {
              const ofType = components.filter((c) => c.type === typeKey);
              if (ofType.length === 0) return null;
              const info = ELEMENT_TYPES[typeKey];
              const groupColor = ofType[0].color || info.color;
              return (
                <div key={typeKey} style={{ marginTop: 12 }}>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      marginBottom: 6,
                    }}
                  >
                    <div
                      style={{
                        color: 'var(--text-muted)',
                        fontSize: 11,
                        letterSpacing: 0.5,
                        textTransform: 'uppercase',
                        flex: 1,
                      }}
                    >
                      {info.label}
                    </div>
                    {onSetAllComponentColorsOfType && (
                      <input
                        type="color"
                        value={groupColor}
                        onChange={(e) =>
                          onSetAllComponentColorsOfType(typeKey, e.target.value)
                        }
                        title={`Set color for all ${info.label.toLowerCase()}`}
                        style={colorSwatchStyle}
                      />
                    )}
                  </div>
                  <div style={{ overflowX: 'auto' }}>
                    <div
                      style={{ display: 'flex', flexDirection: 'column', gap: 8, minWidth: 220 }}
                    >
                      {ofType.map((c) => {
                        const color = c.color || info.color;
                        const isHighlighted = highlightedComponentId === c.id;
                        return (
                          <div
                            key={c.id}
                            style={{
                              display: 'grid',
                              gridTemplateColumns: 'auto 22px minmax(0, 1fr)',
                              alignItems: 'center',
                              gap: 6,
                              padding: '2px 4px',
                              borderRadius: 4,
                              background: isHighlighted ? 'var(--bg-input)' : 'transparent',
                              boxShadow: isHighlighted ? `inset 3px 0 0 ${color}` : 'none',
                            }}
                          >
                            <span
                              style={{
                                color: 'var(--text-muted)',
                                fontSize: 13,
                                minWidth: 24,
                                textAlign: 'right',
                              }}
                              title={info.label}
                            >
                              {info.symbol}
                            </span>
                            <input
                              type="color"
                              value={color}
                              onChange={(e) =>
                                onUpdateComponent(c.id, { color: e.target.value })
                              }
                              onFocus={() => focusComponent(c.id)}
                              onBlur={blurItem}
                              title="Component color"
                              style={colorSwatchStyle}
                            />
                            <input
                              value={String(c.value ?? '')}
                              onChange={(e) =>
                                onUpdateComponent(c.id, { value: e.target.value })
                              }
                              onFocus={() => focusComponent(c.id)}
                              onBlur={blurItem}
                              placeholder={`${info.symbol}_{i}`}
                              style={{ ...baseInputStyle, color: 'var(--text-primary)' }}
                            />
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </section>
      )}
    </div>
  );
}
