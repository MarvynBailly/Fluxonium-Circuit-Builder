import React from 'react';

const DEFAULT_STEM = 30;

/**
 * Reusable schematic-ground glyph: a stem from the anchor vertex out to
 * the chosen offset, then three shrinking horizontal bars at the stem's
 * far end, perpendicular to the stem direction.
 *
 * The whole glyph is drawn in a frame translated to the anchor and
 * rotated so the stem points along the requested (dx, dy). In the
 * canonical frame the stem points "south" (+y), bars at y = L, L+4,
 * L+8 — that way the rotation handles every direction uniformly.
 */
export function GroundGlyph({ x, y, dx = 0, dy = DEFAULT_STEM, color = 'currentColor', strokeWidth = 1.5, opacity = 1 }) {
  const L = Math.hypot(dx, dy) || DEFAULT_STEM;
  // Rotate so the canonical "south" axis aligns with (dx, dy).
  const angleDeg = (Math.atan2(dy, dx) * 180) / Math.PI - 90;
  return (
    <g transform={`translate(${x},${y}) rotate(${angleDeg})`} opacity={opacity}>
      <line x1={0} y1={0} x2={0} y2={L} stroke={color} strokeWidth={strokeWidth} />
      <line x1={-9} y1={L} x2={9} y2={L} stroke={color} strokeWidth={strokeWidth} />
      <line x1={-6} y1={L + 4} x2={6} y2={L + 4} stroke={color} strokeWidth={strokeWidth} />
      <line x1={-3} y1={L + 8} x2={3} y2={L + 8} stroke={color} strokeWidth={strokeWidth} />
    </g>
  );
}

/** Render every ground in the wire model, tinted with the owning node's color. */
function Grounds({ grounds = [], vById, vertexNodeId, colorForNode }) {
  return (
    <g pointerEvents="none">
      {grounds.map((g) => {
        const v = vById.get(g.vertexId);
        if (!v) return null;
        const nodeId = vertexNodeId.get(g.vertexId);
        return (
          <GroundGlyph
            key={g.id}
            x={v.x}
            y={v.y}
            dx={g.dx ?? 0}
            dy={g.dy ?? DEFAULT_STEM}
            color={colorForNode(nodeId)}
          />
        );
      })}
    </g>
  );
}

export default React.memo(Grounds);
