import React from 'react';
import CircuitSymbol from './CircuitSymbol.jsx';
import SvgLatex from './SvgLatex.jsx';
import { ELEMENT_TYPES } from '../circuit/index.js';
import { COMPONENT_LENGTH } from '../wire/index.js';

const COMPONENT_LABEL_OFFSET = 28;
const NODE_LABEL_OFFSET = 26;
const VERTEX_RADIUS = 4;
const VERTEX_HOVER_RADIUS = 7;

/** Pick a label-offset direction for an electrical node so it doesn't
 *  sit on top of any wire leaving the node. We sum unit vectors of
 *  outgoing wires and place the label opposite the resultant. Falls
 *  back to "above" if there is no preferred direction. */
function nodeLabelDirection(node, wire) {
  const vById = new Map(wire.vertices.map((v) => [v.id, v]));

  // Phantom node (between two components on a single segment): place
  // perpendicular to that segment, biased upward.
  if (!node.vertexIds || node.vertexIds.length === 0) {
    if (node.phantomKey) {
      const parts = node.phantomKey.split(':');
      const c1 = wire.components.find((c) => c.id === parts[1]);
      if (c1) {
        const seg = wire.segments.find((s) => s.id === c1.segmentId);
        if (seg) {
          const a = vById.get(seg.from);
          const b = vById.get(seg.to);
          if (a && b) {
            const dx = b.x - a.x;
            const dy = b.y - a.y;
            const L = Math.hypot(dx, dy);
            if (L > 0) {
              let px = -dy / L;
              let py = dx / L;
              if (py > 0) {
                px = -px;
                py = -py;
              }
              return { x: px, y: py };
            }
          }
        }
      }
    }
    return { x: 0, y: -1 };
  }

  const vertexSet = new Set(node.vertexIds);
  let sx = 0;
  let sy = 0;
  for (const seg of wire.segments) {
    let from;
    let to;
    if (vertexSet.has(seg.from) && !vertexSet.has(seg.to)) {
      from = vById.get(seg.from);
      to = vById.get(seg.to);
    } else if (vertexSet.has(seg.to) && !vertexSet.has(seg.from)) {
      from = vById.get(seg.to);
      to = vById.get(seg.from);
    } else continue;
    if (!from || !to) continue;
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const L = Math.hypot(dx, dy);
    if (L < 1e-6) continue;
    sx += dx / L;
    sy += dy / L;
  }
  const sLen = Math.hypot(sx, sy);
  if (sLen < 1e-6) return { x: 0, y: -1 };
  return { x: -sx / sLen, y: -sy / sLen };
}

/**
 * Render the wire graph plus the hover preview. Wire pieces and
 * vertices are tinted with their electrical-node color; node labels
 * are drawn near each node centroid (or between flanking components
 * for phantom nodes).
 *
 * Click dispatch is handled at the canvas level using the parent's
 * hover state, so this layer just paints visuals (vertices alone get
 * mouse-down for drag).
 */
export default function WireLayer({
  wire,
  wireNodes = [],
  drawingFromVertexId,
  hover,
  selectedTool,
  selected,
  onVertexMouseDown,
  onComponentMouseDown,
  showLabels = true,
  zoom = 1,
  highlightedNodeId = null,
  highlightedComponentId = null,
  onHighlightNode,
  onHighlightComponent,
}) {
  const vById = new Map(wire.vertices.map((v) => [v.id, v]));
  const sById = new Map(wire.segments.map((s) => [s.id, s]));
  const drawingVertex = drawingFromVertexId !== null ? vById.get(drawingFromVertexId) : null;
  const isWireTool = selectedTool === 'wire';
  const isCompTool = selectedTool === 'C' || selectedTool === 'L' || selectedTool === 'JJ';

  // electrical-node lookups
  const vertexNodeId = new Map();
  const phantomNodeIdByKey = new Map();
  const nodeById = new Map();
  for (const n of wireNodes) {
    nodeById.set(n.id, n);
    if (n.vertexIds && n.vertexIds.length) {
      for (const vid of n.vertexIds) vertexNodeId.set(vid, n.id);
    }
    if (n.phantomKey) phantomNodeIdByKey.set(n.phantomKey, n.id);
  }
  const colorForNode = (id) => nodeById.get(id)?.color ?? 'var(--text-secondary)';

  // Inverse-zoom factor for keeping labels at constant on-screen size.
  const labelScale = 1 / Math.max(zoom, 0.0001);

  let target = null;
  if (hover) {
    if (hover.kind === 'vertex') {
      const v = vById.get(hover.id);
      if (v) target = { x: v.x, y: v.y };
    } else if (hover.x !== undefined) {
      target = { x: hover.x, y: hover.y };
    }
  }

  return (
    <g>
      {/* Wire segments — split into sub-pieces around components.
          Each sub-piece is colored by its electrical node. */}
      {wire.segments.map((s) => {
        const a = vById.get(s.from);
        const b = vById.get(s.to);
        if (!a || !b) return null;
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const L = Math.hypot(dx, dy);
        if (L < 1) return null;

        const compsOnSeg = wire.components
          .filter((c) => c.segmentId === s.id)
          .sort((p, q) => p.t - q.t);
        const halfLen = Math.min(COMPONENT_LENGTH, L * 0.9) / 2;
        const halfT = halfLen / L;

        const slots = [];
        if (compsOnSeg.length === 0) {
          slots.push({ t1: 0, t2: 1, nodeId: vertexNodeId.get(s.from) });
        } else {
          slots.push({
            t1: 0,
            t2: Math.max(0, compsOnSeg[0].t - halfT),
            nodeId: vertexNodeId.get(s.from),
          });
          for (let k = 1; k < compsOnSeg.length; k++) {
            const phantomKey = `gap:${compsOnSeg[k - 1].id}:${compsOnSeg[k].id}`;
            slots.push({
              t1: Math.min(1, compsOnSeg[k - 1].t + halfT),
              t2: Math.max(0, compsOnSeg[k].t - halfT),
              nodeId: phantomNodeIdByKey.get(phantomKey),
            });
          }
          slots.push({
            t1: Math.min(1, compsOnSeg[compsOnSeg.length - 1].t + halfT),
            t2: 1,
            nodeId: vertexNodeId.get(s.to),
          });
        }

        const isSelected = selected?.kind === 'wireSegment' && selected.id === s.id;
        const selectedSlot = isSelected ? selected.slotIndex : undefined;

        return (
          <g key={s.id} pointerEvents="none">
            {slots.map((slot, k) => {
              if (slot.t2 <= slot.t1) return null;
              const slotSelected =
                isSelected && (selectedSlot === undefined || selectedSlot === k);
              const slotHighlighted =
                highlightedNodeId !== null && slot.nodeId === highlightedNodeId;
              const stroke = slotSelected ? 'var(--accent-blue)' : colorForNode(slot.nodeId);
              const x1 = a.x + slot.t1 * dx;
              const y1 = a.y + slot.t1 * dy;
              const x2 = a.x + slot.t2 * dx;
              const y2 = a.y + slot.t2 * dy;
              return (
                <g key={k}>
                  {slotHighlighted && (
                    <line
                      x1={x1}
                      y1={y1}
                      x2={x2}
                      y2={y2}
                      stroke={stroke}
                      strokeWidth={9}
                      strokeLinecap="round"
                      opacity={0.35}
                    />
                  )}
                  <line
                    x1={x1}
                    y1={y1}
                    x2={x2}
                    y2={y2}
                    stroke={stroke}
                    strokeWidth={slotSelected ? 3 : slotHighlighted ? 3.5 : 2}
                  />
                </g>
              );
            })}
          </g>
        );
      })}

      {/* Components — overlaid on top of segment gaps */}
      {wire.components.map((c) => {
        const seg = sById.get(c.segmentId);
        if (!seg) return null;
        const a = vById.get(seg.from);
        const b = vById.get(seg.to);
        if (!a || !b) return null;
        const compsOnThisSeg = wire.components
          .filter((cc) => cc.segmentId === c.segmentId)
          .sort((p, q) => p.t - q.t);
        const compIdx = compsOnThisSeg.findIndex((cc) => cc.id === c.id);
        const leftNodeId =
          compIdx === 0
            ? vertexNodeId.get(seg.from)
            : phantomNodeIdByKey.get(
                `gap:${compsOnThisSeg[compIdx - 1].id}:${c.id}`,
              );
        const rightNodeId =
          compIdx === compsOnThisSeg.length - 1
            ? vertexNodeId.get(seg.to)
            : phantomNodeIdByKey.get(
                `gap:${c.id}:${compsOnThisSeg[compIdx + 1].id}`,
              );
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const L = Math.hypot(dx, dy);
        if (L < 1) return null;
        const ux = dx / L;
        const uy = dy / L;
        const cx = a.x + c.t * dx;
        const cy = a.y + c.t * dy;
        const half = Math.min(COMPONENT_LENGTH, L * 0.9) / 2;
        const x1 = cx - ux * half;
        const y1 = cy - uy * half;
        const x2 = cx + ux * half;
        const y2 = cy + uy * half;
        const isSelected = selected?.kind === 'wireComponent' && selected.id === c.id;
        const isHighlighted = highlightedComponentId === c.id;
        const info = ELEMENT_TYPES[c.type];
        const compColor = c.color || info.color;

        // Place label perpendicular to the wire, always biased upward
        // (smaller y) so labels never appear below the diagram. The label
        // text itself is never rotated.
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
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
                stroke={compColor}
                strokeWidth={14}
                strokeLinecap="round"
                opacity={0.4}
              />
            )}
            {isSelected && (
              <line
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
                stroke={compColor}
                strokeWidth={10}
                opacity={0.25}
              />
            )}
            <CircuitSymbol
              type={c.type}
              x1={x1}
              y1={y1}
              x2={x2}
              y2={y2}
              color={compColor}
              wireColor="var(--text-secondary)"
            />
            <circle cx={x1} cy={y1} r={3} fill={colorForNode(leftNodeId)} pointerEvents="none" />
            <circle cx={x2} cy={y2} r={3} fill={colorForNode(rightNodeId)} pointerEvents="none" />
            {onComponentMouseDown && !selectedTool && (
              <line
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
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
                onMouseDown={
                  onHighlightComponent ? (e) => e.stopPropagation() : undefined
                }
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

      {/* In-progress drawing line */}
      {isWireTool && drawingVertex && target && (
        <line
          x1={drawingVertex.x}
          y1={drawingVertex.y}
          x2={target.x}
          y2={target.y}
          stroke="var(--accent-amber)"
          strokeWidth={1.5}
          strokeDasharray="4 3"
          opacity={0.7}
          pointerEvents="none"
        />
      )}

      {/* Existing vertices (with drag handle) */}
      {wire.vertices.map((v) => {
        const isDrawingFrom = drawingFromVertexId === v.id;
        const isSelected = selected?.kind === 'wireVertex' && selected.id === v.id;
        const isHover = hover?.kind === 'vertex' && hover.id === v.id;
        const myNodeId = vertexNodeId.get(v.id);
        const isHighlighted = highlightedNodeId !== null && myNodeId === highlightedNodeId;
        const r = isDrawingFrom || isSelected || isHover ? VERTEX_HOVER_RADIUS : VERTEX_RADIUS;
        const fill = isDrawingFrom
          ? 'var(--accent-amber)'
          : isSelected
            ? 'var(--accent-blue)'
            : isHover
              ? 'var(--accent-amber)'
              : colorForNode(myNodeId);
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
            {isHighlighted && (
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

      {/* Electrical-node labels */}
      {wireNodes.map((n) => {
        if (!n.label) return null;
        const dir = nodeLabelDirection(n, wire);
        const lx = n.x + dir.x * NODE_LABEL_OFFSET;
        const ly = n.y + dir.y * NODE_LABEL_OFFSET;
        return (
          <g key={`label-${n.id}`}>
            <g
              transform={`translate(${lx},${ly}) scale(${labelScale})`}
              pointerEvents={onHighlightNode ? 'auto' : 'none'}
              style={onHighlightNode ? { cursor: 'pointer' } : undefined}
              onMouseDown={onHighlightNode ? (e) => e.stopPropagation() : undefined}
              onClick={
                onHighlightNode
                  ? (e) => {
                      e.stopPropagation();
                      onHighlightNode(n.id);
                    }
                  : undefined
              }
            >
              <SvgLatex
                text={`${n.isGround ? '⏚\\, ' : ''}${n.label}`}
                x={0}
                y={0}
                fontSize={16}
                color="var(--text-primary)"
                fontWeight={600}
              />
            </g>
          </g>
        );
      })}

      {/* Hover preview: ghost vertex (wire tool, on grid / free / mid-segment) */}
      {isWireTool &&
        hover &&
        (hover.kind === 'grid' || hover.kind === 'free' || hover.kind === 'segment') && (
          <g pointerEvents="none" opacity={0.85}>
            {hover.kind === 'grid' && (
              <>
                <line
                  x1={hover.x - 9}
                  y1={hover.y}
                  x2={hover.x + 9}
                  y2={hover.y}
                  stroke="var(--accent-amber)"
                  strokeWidth={1}
                  opacity={0.45}
                />
                <line
                  x1={hover.x}
                  y1={hover.y - 9}
                  x2={hover.x}
                  y2={hover.y + 9}
                  stroke="var(--accent-amber)"
                  strokeWidth={1}
                  opacity={0.45}
                />
              </>
            )}
            <circle
              cx={hover.x}
              cy={hover.y}
              r={5}
              fill="none"
              stroke="var(--accent-amber)"
              strokeWidth={1.5}
              strokeDasharray="2 2"
            />
          </g>
        )}

      {/* Hover preview: component on a wire segment */}
      {isCompTool && hover?.kind === 'componentOnSegment' && (
        <g pointerEvents="none">
          <g opacity={0.55}>
            <CircuitSymbol
              type={selectedTool}
              x1={hover.x - (hover.dirX * COMPONENT_LENGTH) / 2}
              y1={hover.y - (hover.dirY * COMPONENT_LENGTH) / 2}
              x2={hover.x + (hover.dirX * COMPONENT_LENGTH) / 2}
              y2={hover.y + (hover.dirY * COMPONENT_LENGTH) / 2}
            />
          </g>
          {hover.snapLabel && (
            <g
              transform={`translate(${hover.x + hover.dirY * 22}, ${hover.y - hover.dirX * 22})`}
            >
              <rect
                x={-15}
                y={-9}
                width={30}
                height={16}
                rx={4}
                fill="var(--bg-card)"
                stroke="var(--accent-blue)"
                strokeWidth={1}
              />
              <text
                x={0}
                y={3}
                textAnchor="middle"
                fontSize={10}
                fill="var(--accent-blue)"
                fontWeight={600}
              >
                {hover.snapLabel}
              </text>
            </g>
          )}
        </g>
      )}
    </g>
  );
}
