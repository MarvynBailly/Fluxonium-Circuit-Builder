import React, { useMemo } from 'react';
import katex from 'katex';

const LATEX_RE = /[\\_{^}]/;

/**
 * Render a text label inside SVG, with automatic LaTeX support.
 *
 * If the text contains LaTeX-like characters (\, _, ^, {, }),
 * it is rendered through KaTeX inside a <foreignObject>.
 * Otherwise it renders as a plain SVG <text> element.
 *
 * @param {string}  text      - Label string (plain text or LaTeX math)
 * @param {number}  x         - Center x position
 * @param {number}  y         - Center y position
 * @param {number}  fontSize  - Font size in px
 * @param {string}  color     - CSS color
 * @param {number}  fontWeight
 */
export default function SvgLatex({
  text,
  x,
  y,
  fontSize = 12,
  color = 'var(--text-primary)',
  fontWeight = 400,
}) {
  const isLatex = LATEX_RE.test(text);

  const html = useMemo(() => {
    if (!isLatex) return null;
    try {
      return katex.renderToString(text, {
        throwOnError: false,
        displayMode: false,
      });
    } catch {
      return null;
    }
  }, [text, isLatex]);

  if (!isLatex || html === null) {
    return (
      <text
        x={x}
        y={y + fontSize * 0.35}
        textAnchor="middle"
        fill={color}
        fontSize={fontSize}
        fontWeight={fontWeight}
        fontFamily="var(--font-mono)"
        style={{ pointerEvents: 'none' }}
      >
        {text}
      </text>
    );
  }

  const w = 120;
  const h = 32;

  return (
    <foreignObject
      x={x - w / 2}
      y={y - h / 2}
      width={w}
      height={h}
      style={{ overflow: 'visible', pointerEvents: 'none' }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          width: '100%',
          height: '100%',
          color,
          fontSize,
          pointerEvents: 'none',
        }}
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </foreignObject>
  );
}
