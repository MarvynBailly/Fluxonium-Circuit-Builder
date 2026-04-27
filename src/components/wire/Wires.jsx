import React from 'react';

/** Render the wire edges, tinted by their electrical-node color. */
export default function Wires({ wire, vById, vertexNodeId, colorForNode, isSelected, highlightedNodeId }) {
  return (
    <>
      {wire.wires.map((w) => {
        const a = vById.get(w.from);
        const b = vById.get(w.to);
        if (!a || !b) return null;
        const nodeId = vertexNodeId.get(w.from);
        const wireSelected = isSelected('wire', w.id);
        const isHighlighted = highlightedNodeId !== null && nodeId === highlightedNodeId;
        const stroke = wireSelected ? 'var(--accent-blue)' : colorForNode(nodeId);
        const sw = wireSelected ? 3 : isHighlighted ? 3.5 : 2;
        return (
          <g key={w.id} pointerEvents="none">
            {isHighlighted && (
              <line
                x1={a.x}
                y1={a.y}
                x2={b.x}
                y2={b.y}
                stroke={stroke}
                strokeWidth={9}
                strokeLinecap="round"
                opacity={0.35}
              />
            )}
            <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={stroke} strokeWidth={sw} />
          </g>
        );
      })}
    </>
  );
}
