import React from 'react';

const VERTEX_RADIUS = 4;
const VERTEX_HOVER_RADIUS = 7;
const TERMINAL_RADIUS = 3;

/** Render every vertex. Wired vertices take their electrical-node color;
 *  terminal-only vertices (no incident wires) render as small neutral dots. */
export default function Vertices({
  wire,
  vertexNodeId,
  colorForNode,
  drawingFromVertexId,
  isSelected,
  hover,
  selectedTool,
  highlightedNodeId,
  onVertexMouseDown,
}) {
  return (
    <>
      {wire.vertices.map((v) => {
        const isDrawingFrom = drawingFromVertexId === v.id;
        const vertexSelected = isSelected('wireVertex', v.id);
        const isHover = hover?.kind === 'vertex' && hover.id === v.id;
        const myNodeId = vertexNodeId.get(v.id);
        const isWired = myNodeId !== undefined;
        const isHighlighted = highlightedNodeId !== null && myNodeId === highlightedNodeId;
        const baseR = isWired ? VERTEX_RADIUS : TERMINAL_RADIUS;
        const r = isDrawingFrom || vertexSelected || isHover ? VERTEX_HOVER_RADIUS : baseR;
        const fill = isDrawingFrom
          ? 'var(--accent-amber)'
          : vertexSelected
            ? 'var(--accent-blue)'
            : isHover
              ? 'var(--accent-amber)'
              : isWired
                ? colorForNode(myNodeId)
                : 'var(--text-secondary)';
        const cursor = selectedTool ? 'pointer' : 'grab';
        return (
          <g key={v.id}>
            <circle
              cx={v.x}
              cy={v.y}
              r={Math.max(r, 10)}
              fill="transparent"
              onMouseDown={onVertexMouseDown ? (e) => onVertexMouseDown(v.id, e) : undefined}
              style={{ cursor }}
            />
            {isHighlighted && isWired && (
              <circle
                cx={v.x}
                cy={v.y}
                r={r + 5}
                fill={colorForNode(myNodeId)}
                opacity={0.35}
                pointerEvents="none"
              />
            )}
            <circle cx={v.x} cy={v.y} r={r} fill={fill} pointerEvents="none" />
          </g>
        );
      })}
    </>
  );
}
