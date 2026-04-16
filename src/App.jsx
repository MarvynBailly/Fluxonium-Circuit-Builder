import React, { useState, useRef, useCallback, useEffect } from 'react';
import CircuitSymbol from './components/CircuitSymbol.jsx';
import SvgLatex from './components/SvgLatex.jsx';
import PropertiesPanel from './components/PropertiesPanel.jsx';
import HamiltonianPanel from './components/HamiltonianPanel.jsx';
import { ELEMENT_TYPES, downloadJSON } from './circuit/index.js';

const DEFAULT_CIRCUIT = {
  nodes: [
    { id: 0, x: 200, y: 200, label: '\\phi_{0}', isGround: true },
    { id: 1, x: 400, y: 120, label: '\\phi_{1}', isGround: false },
    { id: 2, x: 400, y: 280, label: '\\phi_{2}', isGround: false },
  ],
  edges: [
    { id: 'e0', from: 0, to: 1, type: 'JJ', value: 8.0 },
    { id: 'e1', from: 1, to: 2, type: 'L', value: 300 },
    { id: 'e2', from: 0, to: 2, type: 'C', value: 5.0 },
  ],
  nextNodeId: 3,
  nextEdgeId: 3,
};

export default function App() {
  const [nodes, setNodes] = useState(DEFAULT_CIRCUIT.nodes);
  const [edges, setEdges] = useState(DEFAULT_CIRCUIT.edges);
  const [selectedTool, setSelectedTool] = useState(null);
  const [connectFrom, setConnectFrom] = useState(null);
  const [dragging, setDragging] = useState(null);
  const [selected, setSelected] = useState(null);
  const [theme, setTheme] = useState('dark');
  const [showEdgeLabels, setShowEdgeLabels] = useState(true);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [panelWidth, setPanelWidth] = useState(380);
  const panelResizeInfo = useRef(null);
  const svgRef = useRef(null);
  const nextNodeId = useRef(DEFAULT_CIRCUIT.nextNodeId);
  const nextEdgeId = useRef(DEFAULT_CIRCUIT.nextEdgeId);
  const panInfo = useRef(null);
  const didPan = useRef(false);

  // ---- undo / redo history ----
  const historyRef = useRef({
    stack: [{ nodes: DEFAULT_CIRCUIT.nodes.map((n) => ({ ...n })), edges: DEFAULT_CIRCUIT.edges.map((e) => ({ ...e })) }],
    index: 0,
  });
  const skipHistoryRef = useRef(false);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  const syncHistoryButtons = useCallback(() => {
    const h = historyRef.current;
    setCanUndo(h.index > 0);
    setCanRedo(h.index < h.stack.length - 1);
  }, []);

  useEffect(() => {
    if (skipHistoryRef.current) { skipHistoryRef.current = false; syncHistoryButtons(); return; }
    if (dragging !== null) return;
    const h = historyRef.current;
    const cur = h.stack[h.index];
    if (cur && JSON.stringify(cur.nodes) === JSON.stringify(nodes) && JSON.stringify(cur.edges) === JSON.stringify(edges)) return;
    h.stack = h.stack.slice(0, h.index + 1);
    h.stack.push({ nodes: nodes.map((n) => ({ ...n })), edges: edges.map((e) => ({ ...e })) });
    h.index = h.stack.length - 1;
    if (h.stack.length > 100) { h.stack.shift(); h.index--; }
    syncHistoryButtons();
  }, [nodes, edges, dragging, syncHistoryButtons]);

  const undo = useCallback(() => {
    const h = historyRef.current;
    if (h.index <= 0) return;
    h.index--;
    skipHistoryRef.current = true;
    const s = h.stack[h.index];
    setNodes(s.nodes.map((n) => ({ ...n })));
    setEdges(s.edges.map((e) => ({ ...e })));
    setSelected(null);
    nextNodeId.current = s.nodes.length > 0 ? Math.max(...s.nodes.map((n) => n.id)) + 1 : 0;
    nextEdgeId.current = s.edges.length > 0 ? Math.max(...s.edges.map((e) => parseInt(e.id.slice(1), 10))) + 1 : 0;
    syncHistoryButtons();
  }, [syncHistoryButtons]);

  const redo = useCallback(() => {
    const h = historyRef.current;
    if (h.index >= h.stack.length - 1) return;
    h.index++;
    skipHistoryRef.current = true;
    const s = h.stack[h.index];
    setNodes(s.nodes.map((n) => ({ ...n })));
    setEdges(s.edges.map((e) => ({ ...e })));
    setSelected(null);
    nextNodeId.current = s.nodes.length > 0 ? Math.max(...s.nodes.map((n) => n.id)) + 1 : 0;
    nextEdgeId.current = s.edges.length > 0 ? Math.max(...s.edges.map((e) => parseInt(e.id.slice(1), 10))) + 1 : 0;
    syncHistoryButtons();
  }, [syncHistoryButtons]);

  useEffect(() => {
    document.documentElement.classList.toggle('light', theme === 'light');
  }, [theme]);

  const clearCircuit = useCallback(() => {
    setNodes([]);
    setEdges([]);
    setSelected(null);
    setConnectFrom(null);
    setSelectedTool(null);
    nextNodeId.current = 0;
    nextEdgeId.current = 0;
    setPan({ x: 0, y: 0 });
    setZoom(1);
  }, []);

  const resetView = useCallback(() => {
    if (nodes.length === 0) { setPan({ x: 0, y: 0 }); setZoom(1); return; }
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const xs = nodes.map((n) => n.x);
    const ys = nodes.map((n) => n.y);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    const pad = 80;
    const contentW = maxX - minX + pad * 2 || 1;
    const contentH = maxY - minY + pad * 2 || 1;
    const newZoom = Math.min(rect.width / contentW, rect.height / contentH, 2);
    const cx = (minX + maxX) / 2;
    const cy = (minY + maxY) / 2;
    setPan({ x: rect.width / 2 - cx * newZoom, y: rect.height / 2 - cy * newZoom });
    setZoom(newZoom);
  }, [nodes]);

  // ---- helpers ----
  const svgPoint = useCallback((e) => {
    const rect = svgRef.current.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left - pan.x) / zoom,
      y: (e.clientY - rect.top - pan.y) / zoom,
    };
  }, [pan, zoom]);

  // ---- pan / zoom ----
  const onCanvasMouseDown = useCallback(
    (e) => {
      const isBackground = e.target === svgRef.current || e.target.tagName === 'rect';
      if (e.button === 1 || (e.button === 0 && isBackground && !selectedTool)) {
        e.preventDefault();
        didPan.current = false;
        panInfo.current = {
          startX: e.clientX,
          startY: e.clientY,
          startPanX: pan.x,
          startPanY: pan.y,
        };
      }
    },
    [selectedTool, pan],
  );

  const onWheel = useCallback(
    (e) => {
      e.preventDefault();
      const rect = svgRef.current.getBoundingClientRect();
      const sx = e.clientX - rect.left;
      const sy = e.clientY - rect.top;
      const wx = (sx - pan.x) / zoom;
      const wy = (sy - pan.y) / zoom;
      const factor = e.deltaY < 0 ? 1.04 : 1 / 1.04;
      const newZoom = Math.min(Math.max(zoom * factor, 0.1), 10);
      setPan({ x: sx - wx * newZoom, y: sy - wy * newZoom });
      setZoom(newZoom);
    },
    [pan, zoom],
  );

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    svg.addEventListener('wheel', onWheel, { passive: false });
    return () => svg.removeEventListener('wheel', onWheel);
  }, [onWheel]);

  // ---- canvas click ----
  const onCanvasClick = useCallback(
    (e) => {
      if (didPan.current) { didPan.current = false; return; }
      if (e.target !== svgRef.current && e.target.tagName !== 'rect') return;
      if (selectedTool === 'node') {
        const pt = svgPoint(e);
        const id = nextNodeId.current++;
        setNodes((prev) => [...prev, { id, x: pt.x, y: pt.y, label: `\\phi_{${id}}`, isGround: false }]);
        return;
      }
      setSelected(null);
      setConnectFrom(null);
    },
    [selectedTool, svgPoint],
  );

  // ---- node interaction ----
  const onNodeClick = useCallback(
    (nodeId, e) => {
      e.stopPropagation();
      if (selectedTool && selectedTool !== 'node') {
        if (connectFrom === null) {
          setConnectFrom(nodeId);
        } else if (connectFrom !== nodeId) {
          const def = ELEMENT_TYPES[selectedTool];
          const id = `e${nextEdgeId.current++}`;
          setEdges((prev) => [...prev, { id, from: connectFrom, to: nodeId, type: selectedTool, value: def.defaultValue }]);
          setConnectFrom(null);
        }
        return;
      }
      setSelected({ type: 'node', id: nodeId });
    },
    [selectedTool, connectFrom],
  );

  const onNodeMouseDown = useCallback(
    (nodeId, e) => {
      if (selectedTool) return;
      e.preventDefault();
      e.stopPropagation();
      setDragging(nodeId);
    },
    [selectedTool],
  );

  // ---- edge interaction ----
  const onEdgeClick = useCallback((edgeId, e) => {
    e.stopPropagation();
    setSelected({ type: 'edge', id: edgeId });
  }, []);

  // ---- panel resize ----
  const onPanelResizeStart = useCallback(
    (e) => {
      e.preventDefault();
      e.stopPropagation();
      panelResizeInfo.current = { startX: e.clientX, startWidth: panelWidth };
    },
    [panelWidth],
  );

  useEffect(() => {
    const onMove = (e) => {
      if (!panelResizeInfo.current) return;
      const dx = e.clientX - panelResizeInfo.current.startX;
      const next = panelResizeInfo.current.startWidth - dx;
      setPanelWidth(Math.min(Math.max(next, 240), 900));
    };
    const onUp = () => { panelResizeInfo.current = null; };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, []);

  // ---- drag / pan move ----
  const onMouseMove = useCallback(
    (e) => {
      if (panelResizeInfo.current) return;
      if (panInfo.current) {
        const dx = e.clientX - panInfo.current.startX;
        const dy = e.clientY - panInfo.current.startY;
        if (Math.abs(dx) > 3 || Math.abs(dy) > 3) didPan.current = true;
        setPan({ x: panInfo.current.startPanX + dx, y: panInfo.current.startPanY + dy });
        return;
      }
      if (dragging === null) return;
      const pt = svgPoint(e);
      setNodes((prev) => prev.map((n) => (n.id === dragging ? { ...n, x: pt.x, y: pt.y } : n)));
    },
    [dragging, svgPoint],
  );
  const onMouseUp = useCallback(() => {
    panInfo.current = null;
    setDragging(null);
  }, []);

  // ---- update helpers ----
  const updateNode = useCallback((id, patch) => {
    setNodes((prev) => prev.map((n) => (n.id === id ? { ...n, ...patch } : n)));
  }, []);
  const updateEdge = useCallback((id, patch) => {
    setEdges((prev) => prev.map((e) => (e.id === id ? { ...e, ...patch } : e)));
  }, []);

  // ---- delete ----
  const deleteSelected = useCallback(() => {
    if (!selected) return;
    if (selected.type === 'edge') {
      setEdges((prev) => prev.filter((e) => e.id !== selected.id));
    } else {
      setEdges((prev) => prev.filter((e) => e.from !== selected.id && e.to !== selected.id));
      setNodes((prev) => prev.filter((n) => n.id !== selected.id));
    }
    setSelected(null);
  }, [selected]);

  useEffect(() => {
    const handler = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        e.preventDefault();
        if (e.shiftKey) redo(); else undo();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'y') {
        e.preventDefault();
        redo();
        return;
      }
      if (e.key === 'Escape') {
        if (selectedTool) { setSelectedTool(null); setConnectFrom(null); }
        else if (selected) { setSelected(null); }
        return;
      }
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (e.target.tagName === 'INPUT') return;
        deleteSelected();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [deleteSelected, selectedTool, selected, undo, redo]);

  // ---- tool button style ----
  const toolBtn = (active, color) => ({
    padding: '8px 14px',
    border: active ? `2px solid ${color || 'var(--text-primary)'}` : '2px solid transparent',
    borderRadius: 8,
    background: active ? 'var(--tool-active-bg)' : 'transparent',
    color: 'var(--text-primary)',
    cursor: 'pointer',
    fontSize: 13,
    fontFamily: 'var(--font-mono)',
    transition: 'all 0.15s',
  });

  return (
    <div style={{ width: '100%', height: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <header
        style={{
          padding: '14px 24px',
          borderBottom: '1px solid var(--border)',
          display: 'flex',
          alignItems: 'center',
          gap: 16,
          flexWrap: 'wrap',
        }}
      >
        <div style={{ fontSize: 15, fontWeight: 700, letterSpacing: 1, color: 'var(--accent-amber)' }}>
          FLUXONIUM CIRCUIT BUILDER
        </div>
        <button
          onClick={clearCircuit}
          style={{
            marginLeft: 'auto',
            padding: '6px 14px',
            background: 'transparent',
            border: '1px solid var(--border)',
            borderRadius: 6,
            color: 'var(--text-secondary)',
            fontSize: 12,
            cursor: 'pointer',
            fontFamily: 'inherit',
          }}
        >
          Clear
        </button>
        <button
          onClick={() => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))}
          style={{
            padding: '6px 14px',
            background: 'transparent',
            border: '1px solid var(--border)',
            borderRadius: 6,
            color: 'var(--text-secondary)',
            fontSize: 12,
            cursor: 'pointer',
            fontFamily: 'inherit',
          }}
        >
          {theme === 'dark' ? 'Light mode' : 'Dark mode'}
        </button>
        <button
          onClick={() => downloadJSON(nodes, edges)}
          style={{
            padding: '6px 14px',
            background: 'var(--accent-amber)',
            border: 'none',
            borderRadius: 6,
            color: '#000',
            fontWeight: 600,
            fontSize: 12,
            cursor: 'pointer',
            fontFamily: 'inherit',
          }}
        >
          ↓ Export JSON
        </button>
      </header>

      {/* Toolbar */}
      <div
        style={{
          padding: '10px 24px',
          borderBottom: '1px solid var(--border)',
          display: 'flex',
          gap: 8,
          flexWrap: 'wrap',
          alignItems: 'center',
        }}
      >
        <span style={{ fontSize: 11, color: 'var(--text-muted)', marginRight: 8 }}>TOOLS:</span>
        <button style={toolBtn(selectedTool === 'node')} onClick={() => setSelectedTool(selectedTool === 'node' ? null : 'node')}>
          ⊕ Node
        </button>
        {Object.values(ELEMENT_TYPES).map((t) => (
          <button
            key={t.id}
            style={toolBtn(selectedTool === t.id, t.color)}
            onClick={() => {
              setSelectedTool(selectedTool === t.id ? null : t.id);
              setConnectFrom(null);
            }}
          >
            <span style={{ color: t.color, marginRight: 4 }}>■</span> {t.label}
          </button>
        ))}
        <span style={{ color: 'var(--border)', margin: '0 4px' }}>|</span>
        <button style={{ ...toolBtn(false), opacity: canUndo ? 1 : 0.3 }} onClick={undo} disabled={!canUndo}>
          Undo
        </button>
        <button style={{ ...toolBtn(false), opacity: canRedo ? 1 : 0.3 }} onClick={redo} disabled={!canRedo}>
          Redo
        </button>
        {connectFrom !== null && (
          <span style={{ fontSize: 12, color: 'var(--accent-amber)' }}>Click target node…</span>
        )}
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
          <button
            style={toolBtn(false)}
            onClick={() => setShowEdgeLabels((v) => !v)}
          >
            {showEdgeLabels ? 'Hide labels' : 'Show labels'}
          </button>
          <button style={toolBtn(false)} onClick={resetView}>
            Fit view
          </button>
        </div>
      </div>

      {/* Main area */}
      <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
        {/* SVG Canvas */}
        <div style={{ flex: 1, position: 'relative' }}>
          <svg
            ref={svgRef}
            width="100%"
            height="100%"
            style={{ background: 'var(--bg-secondary)', cursor: selectedTool ? 'crosshair' : 'default' }}
            onMouseDown={onCanvasMouseDown}
            onClick={onCanvasClick}
            onMouseMove={onMouseMove}
            onMouseUp={onMouseUp}
            onMouseLeave={onMouseUp}
          >
            <defs>
              <pattern
                id="grid"
                width="30"
                height="30"
                patternUnits="userSpaceOnUse"
                patternTransform={`translate(${pan.x},${pan.y}) scale(${zoom})`}
              >
                <path d="M 30 0 L 0 0 0 30" fill="none" stroke="var(--grid-line)" strokeWidth="0.5" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#grid)" />

            <g transform={`translate(${pan.x},${pan.y}) scale(${zoom})`}>
            {/* Edges */}
            {edges.map((edge) => {
              const fn = nodes.find((n) => n.id === edge.from);
              const tn = nodes.find((n) => n.id === edge.to);
              if (!fn || !tn) return null;
              const isSelected = selected?.type === 'edge' && selected.id === edge.id;
              const info = ELEMENT_TYPES[edge.type];
              const mx = (fn.x + tn.x) / 2;
              const my = (fn.y + tn.y) / 2;
              const dx = tn.x - fn.x;
              const dy = tn.y - fn.y;
              const len = Math.sqrt(dx * dx + dy * dy);
              // Offset label perpendicular to the wire so it never overlaps
              let labelX = mx;
              let labelY = my - 22;
              if (len > 1) {
                let px = -dy / len;
                let py = dx / len;
                if (py > 0 || (py === 0 && px < 0)) { px = -px; py = -py; }
                labelX = mx + px * 22;
                labelY = my + py * 22;
              }
              // Rotate label to align with wire, but never upside-down
              const rawAngle = (Math.atan2(dy, dx) * 180) / Math.PI;
              let textAngle = rawAngle;
              if (textAngle > 90) textAngle -= 180;
              if (textAngle < -90) textAngle += 180;
              return (
                <g key={edge.id} onClick={(e) => onEdgeClick(edge.id, e)} style={{ cursor: 'pointer' }}>
                  {/* Wider invisible hit area for easier clicking */}
                  <line x1={fn.x} y1={fn.y} x2={tn.x} y2={tn.y} stroke="transparent" strokeWidth={14} />
                  {isSelected && (
                    <line x1={fn.x} y1={fn.y} x2={tn.x} y2={tn.y} stroke={info.color} strokeWidth={8} opacity={0.2} />
                  )}
                  <CircuitSymbol type={edge.type} x1={fn.x} y1={fn.y} x2={tn.x} y2={tn.y} />
                  {showEdgeLabels && (
                    <g transform={`translate(${labelX},${labelY}) rotate(${textAngle})`}>
                      <SvgLatex
                        text={`${info.symbol} = ${edge.value}\\text{ ${info.unit}}`}
                        x={0}
                        y={0}
                        fontSize={11}
                        color="var(--text-primary)"
                      />
                    </g>
                  )}
                </g>
              );
            })}

            {/* Nodes */}
            {nodes.map((node) => {
              const isSelected = selected?.type === 'node' && selected.id === node.id;
              const isSource = connectFrom === node.id;
              return (
                <g
                  key={node.id}
                  onClick={(e) => onNodeClick(node.id, e)}
                  onMouseDown={(e) => onNodeMouseDown(node.id, e)}
                  style={{ cursor: selectedTool ? 'pointer' : 'grab' }}
                >
                  {isSelected && (
                    <circle cx={node.x} cy={node.y} r={22} fill="none" stroke="var(--accent-blue)" strokeWidth={2} strokeDasharray="4 2" />
                  )}
                  {isSource && (
                    <circle cx={node.x} cy={node.y} r={24} fill="none" stroke="var(--accent-amber)" strokeWidth={2} opacity={0.7}>
                      <animate attributeName="r" values="20;26;20" dur="1s" repeatCount="indefinite" />
                    </circle>
                  )}
                  <circle
                    cx={node.x}
                    cy={node.y}
                    r={16}
                    fill={node.isGround ? 'var(--node-ground-fill)' : 'var(--node-fill)'}
                    stroke={node.isGround ? 'var(--text-primary)' : 'var(--text-secondary)'}
                    strokeWidth={node.isGround ? 2.5 : 2}
                  />
                  {node.isGround && (
                    <>
                      <line x1={node.x - 11} y1={node.y + 18} x2={node.x + 11} y2={node.y + 18} stroke="var(--text-primary)" strokeWidth={3} strokeLinecap="round" />
                      <line x1={node.x - 7} y1={node.y + 23} x2={node.x + 7} y2={node.y + 23} stroke="var(--text-primary)" strokeWidth={2.5} strokeLinecap="round" />
                      <line x1={node.x - 3} y1={node.y + 28} x2={node.x + 3} y2={node.y + 28} stroke="var(--text-primary)" strokeWidth={2} strokeLinecap="round" />
                    </>
                  )}
                  <SvgLatex
                    text={node.label}
                    x={node.x}
                    y={node.y}
                    fontSize={12}
                    color="var(--text-primary)"
                    fontWeight={600}
                  />
                </g>
              );
            })}
            </g>
          </svg>

          <PropertiesPanel
            selected={selected}
            nodes={nodes}
            edges={edges}
            onUpdateNode={updateNode}
            onUpdateEdge={updateEdge}
            onDelete={deleteSelected}
          />
        </div>

        {/* Right panel */}
        <HamiltonianPanel
          nodes={nodes}
          edges={edges}
          width={panelWidth}
          onResizeStart={onPanelResizeStart}
        />
      </div>
    </div>
  );
}
