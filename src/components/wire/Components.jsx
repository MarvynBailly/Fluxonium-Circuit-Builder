import React from 'react';
import CircuitSymbol from '../CircuitSymbol.jsx';
import SvgLatex from '../SvgLatex.jsx';
import { ELEMENT_TYPES } from '../../circuit/index.js';

const COMPONENT_LABEL_OFFSET = 28;
const TERMINAL_RADIUS = 3;

/** Render component edges (C/L/JJ) between their endpoint vertices. */
export default function Components({
  wire,
  vById,
  vertexNodeId,
  colorForNode,
  isSelected,
  selectedTool,
  highlightedComponentId,
  showLabels,
  labelScale,
  onComponentMouseDown,
  onHighlightComponent,
}) {
  return (
    <>
      {wire.components.map((c) => {
        const a = vById.get(c.from);
        const b = vById.get(c.to);
        if (!a || !b) return null;
        const leftNodeId = vertexNodeId.get(c.from);
        const rightNodeId = vertexNodeId.get(c.to);
        const compSelected = isSelected('wireComponent', c.id);
        const isHighlighted = highlightedComponentId === c.id;
        const info = ELEMENT_TYPES[c.type];
        const compColor = c.color || info.color;
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const L = Math.hypot(dx, dy);
        if (L < 1) return null;
        const ux = dx / L;
        const uy = dy / L;
        const cx = (a.x + b.x) / 2;
        const cy = (a.y + b.y) / 2;

        // Place label perpendicular to the component, biased upward.
        let px = -uy;
        let py = ux;
        if (py > 0 || (py === 0 && px < 0)) {
          px = -px;
          py = -py;
        }
        const lx = cx + px * COMPONENT_LABEL_OFFSET;
        const ly = cy + py * COMPONENT_LABEL_OFFSET;

        return (
          <g key={c.id} pointerEvents="none">
            {isHighlighted && (
              <line
                x1={a.x}
                y1={a.y}
                x2={b.x}
                y2={b.y}
                stroke={compColor}
                strokeWidth={14}
                strokeLinecap="round"
                opacity={0.4}
              />
            )}
            {compSelected && (
              <line
                x1={a.x}
                y1={a.y}
                x2={b.x}
                y2={b.y}
                stroke={compColor}
                strokeWidth={10}
                opacity={0.25}
              />
            )}
            <CircuitSymbol
              type={c.type}
              x1={a.x}
              y1={a.y}
              x2={b.x}
              y2={b.y}
              color={compColor}
              wireColor="var(--text-secondary)"
            />
            <circle
              cx={a.x}
              cy={a.y}
              r={TERMINAL_RADIUS}
              fill={colorForNode(leftNodeId)}
              pointerEvents="none"
            />
            <circle
              cx={b.x}
              cy={b.y}
              r={TERMINAL_RADIUS}
              fill={colorForNode(rightNodeId)}
              pointerEvents="none"
            />
            {onComponentMouseDown && !selectedTool && (
              <line
                x1={a.x}
                y1={a.y}
                x2={b.x}
                y2={b.y}
                stroke="transparent"
                strokeWidth={26}
                strokeLinecap="round"
                pointerEvents="stroke"
                style={{ cursor: 'grab' }}
                onMouseDown={(e) => onComponentMouseDown(c.id, e)}
              />
            )}
            {showLabels && c.value && (
              <g
                transform={`translate(${lx},${ly}) scale(${labelScale})`}
                pointerEvents={onHighlightComponent ? 'auto' : 'none'}
                style={onHighlightComponent ? { cursor: 'pointer' } : undefined}
                onMouseDown={onHighlightComponent ? (e) => e.stopPropagation() : undefined}
                onClick={
                  onHighlightComponent
                    ? (e) => {
                        e.stopPropagation();
                        onHighlightComponent(c.id);
                      }
                    : undefined
                }
              >
                <SvgLatex
                  text={String(c.value)}
                  x={0}
                  y={0}
                  fontSize={15}
                  color="var(--text-primary)"
                />
              </g>
            )}
          </g>
        );
      })}
    </>
  );
}
