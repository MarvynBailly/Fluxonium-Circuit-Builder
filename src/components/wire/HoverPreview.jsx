import React from 'react';
import CircuitSymbol from '../CircuitSymbol.jsx';
import { GroundGlyph } from './Grounds.jsx';
import { COMPONENT_LENGTH, snapGroundOffset } from '../../wire/index.js';

/** Render the hover preview overlays (in-progress wire line, ghost
 *  vertex, ghost component) based on the active tool and hover kind. */
export default function HoverPreview({
  wire,
  hover,
  selectedTool,
  drawingFromVertexId,
  placingGroundFor = null,
  cursor = null,
  shiftKey = false,
}) {
  const isWireTool = selectedTool === 'wire';
  const isCompTool = selectedTool === 'C' || selectedTool === 'L' || selectedTool === 'JJ';
  const isGroundTool = selectedTool === 'GND';

  let drawingVertex = null;
  if (drawingFromVertexId !== null) {
    drawingVertex = wire.vertices.find((v) => v.id === drawingFromVertexId) || null;
  }

  let target = null;
  if (hover) {
    if (hover.kind === 'vertex') {
      const v = wire.vertices.find((vv) => vv.id === hover.id);
      if (v) target = { x: v.x, y: v.y };
    } else if (hover.x !== undefined) {
      target = { x: hover.x, y: hover.y };
    }
  }

  return (
    <>
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

      {/* Wire-tool ghost vertex (grid / free / on-wire) */}
      {isWireTool &&
        hover &&
        (hover.kind === 'grid' || hover.kind === 'free' || hover.kind === 'wire') && (
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

      {/* Ground-tool ghost — anchor stage. Faded ring at the snap
          point on a vertex or wire, telling the user "click here to
          start placement". Off-wire/vertex clicks won't place
          anything, so we suppress the preview there. */}
      {isGroundTool && placingGroundFor === null && hover && (hover.kind === 'vertex' || hover.kind === 'wire') && target && (
        <g pointerEvents="none" opacity={0.7}>
          <circle
            cx={target.x}
            cy={target.y}
            r={6}
            fill="none"
            stroke="var(--accent-amber)"
            strokeWidth={1.5}
            strokeDasharray="2 2"
          />
        </g>
      )}

      {/* Ground-tool ghost — placement stage. The anchor is set; the
          cursor's offset (snapped to N/S/E/W unless Shift is held)
          drives a live preview of where the glyph will land. */}
      {isGroundTool && placingGroundFor !== null && cursor && (() => {
        const off = snapGroundOffset(
          cursor.x - placingGroundFor.x,
          cursor.y - placingGroundFor.y,
          shiftKey,
        );
        return (
          <GroundGlyph
            x={placingGroundFor.x}
            y={placingGroundFor.y}
            dx={off.dx}
            dy={off.dy}
            color="var(--accent-amber)"
            opacity={0.7}
          />
        );
      })()}

      {/* Component-tool ghost (over a wire = will split + insert; over
          empty space = will spawn standalone). */}
      {isCompTool && hover && (hover.kind === 'componentOnWire' || hover.kind === 'componentFree') && (
        <g pointerEvents="none" opacity={0.55}>
          <CircuitSymbol
            type={selectedTool}
            x1={hover.x - (hover.dirX * COMPONENT_LENGTH) / 2}
            y1={hover.y - (hover.dirY * COMPONENT_LENGTH) / 2}
            x2={hover.x + (hover.dirX * COMPONENT_LENGTH) / 2}
            y2={hover.y + (hover.dirY * COMPONENT_LENGTH) / 2}
          />
        </g>
      )}
    </>
  );
}
