import React, { useMemo } from 'react';
import katex from 'katex';

const LATEX_RE = /[\\_{^}]/;

/**
 * Render inline text with automatic LaTeX support (HTML context).
 *
 * If the text contains LaTeX-like characters, it is rendered through
 * KaTeX. Otherwise it passes through as plain text.
 */
export default function InlineLatex({ text, style }) {
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
    return <span style={style}>{text}</span>;
  }

  return <span style={style} dangerouslySetInnerHTML={{ __html: html }} />;
}
