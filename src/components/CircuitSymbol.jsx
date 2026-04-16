import React from 'react';

/**
 * Renders an SVG schematic symbol for a circuit element between two points.
 *
 * @param {{ type: 'C'|'L'|'JJ', x1: number, y1: number, x2: number, y2: number }} props
 */
export default function CircuitSymbol({ type, x1, y1, x2, y2 }) {
  const mx = (x1 + x2) / 2;
  const my = (y1 + y2) / 2;
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.sqrt(dx * dx + dy * dy);
  const angle = (Math.atan2(dy, dx) * 180) / Math.PI;

  if (type === 'C') {
    const gap = 6;
    const plateH = 14;
    return (
      <g transform={`translate(${mx},${my}) rotate(${angle})`}>
        <line x1={-len / 2} y1={0} x2={-gap} y2={0} stroke="var(--wire-color)" strokeWidth={2} />
        <line x1={-gap} y1={-plateH} x2={-gap} y2={plateH} stroke="#a78bfa" strokeWidth={3} />
        <line x1={gap} y1={-plateH} x2={gap} y2={plateH} stroke="#a78bfa" strokeWidth={3} />
        <line x1={gap} y1={0} x2={len / 2} y2={0} stroke="var(--wire-color)" strokeWidth={2} />
      </g>
    );
  }

  if (type === 'L') {
    const coils = 4;
    const cw = (len * 0.5) / coils;
    let d = `M ${-len * 0.25} 0 `;
    for (let i = 0; i < coils; i++) {
      const sx = -len * 0.25 + i * cw;
      d += `C ${sx + cw * 0.25} -14, ${sx + cw * 0.75} -14, ${sx + cw} 0 `;
    }
    return (
      <g transform={`translate(${mx},${my}) rotate(${angle})`}>
        <line x1={-len / 2} y1={0} x2={-len * 0.25} y2={0} stroke="var(--wire-color)" strokeWidth={2} />
        <path d={d} fill="none" stroke="#10b981" strokeWidth={2.5} />
        <line x1={len * 0.25} y1={0} x2={len / 2} y2={0} stroke="var(--wire-color)" strokeWidth={2} />
      </g>
    );
  }

  // Josephson junction — cross symbol
  const sz = 10;
  return (
    <g transform={`translate(${mx},${my}) rotate(${angle})`}>
      <line x1={-len / 2} y1={0} x2={-sz} y2={0} stroke="var(--wire-color)" strokeWidth={2} />
      <line x1={-sz} y1={-sz} x2={sz} y2={sz} stroke="#f59e0b" strokeWidth={2.5} />
      <line x1={-sz} y1={sz} x2={sz} y2={-sz} stroke="#f59e0b" strokeWidth={2.5} />
      <line x1={sz} y1={0} x2={len / 2} y2={0} stroke="var(--wire-color)" strokeWidth={2} />
    </g>
  );
}
