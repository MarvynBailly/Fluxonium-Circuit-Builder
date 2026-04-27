import React, { useCallback, useEffect, useRef, useState } from 'react';

import HeaderBar from './components/HeaderBar.jsx';
import Toolbar from './components/Toolbar.jsx';
import CircuitEdge from './components/CircuitEdge.jsx';
import CircuitNode from './components/CircuitNode.jsx';
import WireLayer from './components/WireLayer.jsx';
import PropertiesPanel from './components/PropertiesPanel.jsx';
import WirePropertiesPanel from './components/WirePropertiesPanel.jsx';
import HamiltonianPanel from './components/HamiltonianPanel.jsx';
import NodeLabelsPanel from './components/NodeLabelsPanel.jsx';

import { ELEMENT_TYPES, downloadJSON, parseImportPayload } from './circuit/index.js';
import {
  EMPTY_WIRE,
  snapToVertex,
  snapToSegment,
  snapToComponent,
  snapToGrid,
  snapFraction,
  snapComponentEnd,
  addVertex as addWireVertex,
  addSegment as addWireSegment,
  deleteSegment as deleteWireSegment,
  deleteSegmentSlot as deleteWireSegmentSlot,
  deleteVertex as deleteWireVertex,
  splitSegmentAt as splitWireSegmentAt,
  componentsOnSegment,
  slotIndexForT,
  placeComponentOnSegment,
  placeStandaloneComponent,
  mergeVertices,
  canMergeVertices,
  removeComponent,
  setComponentType,
  setComponentValue,
  setComponentColor,
  setComponentPlacement,
  autoDetectNodes,
} from './wire/index.js';

/** Pick the next symbolic name "C_{k}" / "L_{k}" / "E_J^{k}" not yet
 *  used among the schematic-mode edges. */
function nextSchematicSymbol(edges, type) {
  const sym = ELEMENT_TYPES[type].symbol;
  const used = new Set(edges.map((e) => e.value));
  let k = 0;
  let candidate;
  do {
    candidate = type === 'JJ' ? `E_J^{${k}}` : `${sym}_{${k}}`;
    k++;
  } while (used.has(candidate));
  return candidate;
}

/** Nearest segment to (x, y) regardless of distance — used while dragging
 *  a component, so the component always lands on *some* wire. Returns
 *  { id, t } or null if there are no segments. */
function nearestSegment(wire, x, y) {
  const vById = new Map(wire.vertices.map((v) => [v.id, v]));
  let best = null;
  for (const s of wire.segments) {
    const a = vById.get(s.from);
    const b = vById.get(s.to);
    if (!a || !b) continue;
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len2 = dx * dx + dy * dy;
    if (len2 < 1e-9) continue;
    let t = ((x - a.x) * dx + (y - a.y) * dy) / len2;
    t = Math.max(0, Math.min(1, t));
    const px = a.x + t * dx;
    const py = a.y + t * dy;
    const d = Math.hypot(x - px, y - py);
    if (best === null || d < best.d) best = { id: s.id, t, d };
  }
  return best;
}

import example1 from '../example1.json';

import { useHistory } from './hooks/useHistory.js';
import { usePanZoom } from './hooks/usePanZoom.js';
import { useResizablePanel } from './hooks/useResizablePanel.js';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts.js';

/** Resolve which electrical-node sits in a given slot of a wire segment.
 *  Slot 0 belongs to the from-vertex's node; slot N (= number of components)
 *  belongs to the to-vertex's node; intermediate slots are phantom nodes
 *  keyed by the pair of flanking components. */
function nodeIdForSegmentSlot(wire, wireNodes, segmentId, slotIndex) {
  const seg = wire.segments.find((s) => s.id === segmentId);
  if (!seg) return null;
  const compsOnSeg = wire.components
    .filter((c) => c.segmentId === segmentId)
    .sort((p, q) => p.t - q.t);
  const idx = slotIndex ?? 0;
  if (idx === 0) {
    return wireNodes.find((n) => n.vertexIds?.includes(seg.from))?.id ?? null;
  }
  if (idx === compsOnSeg.length) {
    return wireNodes.find((n) => n.vertexIds?.includes(seg.to))?.id ?? null;
  }
  const key = `gap:${compsOnSeg[idx - 1].id}:${compsOnSeg[idx].id}`;
  return wireNodes.find((n) => n.phantomKey === key)?.id ?? null;
}

const WIRE_DEFAULT_PARSED = parseImportPayload(example1);
const WIRE_DEFAULT = WIRE_DEFAULT_PARSED.wire;
const WIRE_DEFAULT_ANALYSIS = autoDetectNodes(
  WIRE_DEFAULT,
  {
    nodes: (WIRE_DEFAULT_PARSED.nodeOverrides || []).map((o) => ({
      label: o.label,
      color: o.color,
      userLabel: !!o.label,
      userColor: !!o.color,
      isGround: !!o.is_ground,
      vertexIds: o.anchor != null ? [o.anchor] : [],
      phantomKey: o.phantom_key || undefined,
    })),
    edges: [],
  },
);

const SCHEMATIC_DEFAULT = {
  nodes: [
    { id: 0, x: 200, y: 200, label: '\\phi_{0}', isGround: true },
    { id: 1, x: 400, y: 120, label: '\\phi_{1}', isGround: false },
    { id: 2, x: 400, y: 280, label: '\\phi_{2}', isGround: false },
  ],
  edges: [
    { id: 'e0', from: 0, to: 1, type: 'JJ', value: 'E_J^{0}' },
    { id: 'e1', from: 1, to: 2, type: 'L', value: 'L_{0}' },
    { id: 'e2', from: 0, to: 2, type: 'C', value: 'C_{0}' },
  ],
  nextNodeId: 3,
  nextEdgeId: 3,
};

export default function App() {
  const [mode, setMode] = useState('wire');

  const [nodes, setNodes] = useState([]);
  const [edges, setEdges] = useState([]);

  const [wire, setWire] = useState(WIRE_DEFAULT);
  const [wireNodes, setWireNodes] = useState(WIRE_DEFAULT_ANALYSIS.nodes);
  const [wireEdges, setWireEdges] = useState(WIRE_DEFAULT_ANALYSIS.edges);
  const [drawingFromVertexId, setDrawingFromVertexId] = useState(null);
  const [hover, setHover] = useState(null);

  const [selected, setSelected] = useState(null);
  const [selectedTool, setSelectedTool] = useState(null);
  const [connectFrom, setConnectFrom] = useState(null);
  const [dragging, setDragging] = useState(null);
  const [draggingComponentId, setDraggingComponentId] = useState(null);
  const [theme, setTheme] = useState('dark');
  const [showEdgeLabels, setShowEdgeLabels] = useState(true);
  const [highlightedNodeId, setHighlightedNodeId] = useState(null);
  const [highlightedComponentId, setHighlightedComponentId] = useState(null);
  const [focusedItem, setFocusedItem] = useState(null);

  const handleHighlightNode = useCallback((id) => {
    setHighlightedNodeId(id);
    setHighlightedComponentId(null);
  }, []);

  const handleHighlightComponent = useCallback((id) => {
    setHighlightedComponentId(id);
    setHighlightedNodeId(null);
  }, []);

  const clearHighlights = useCallback(() => {
    setHighlightedNodeId(null);
    setHighlightedComponentId(null);
  }, []);

  const handleFocusItem = useCallback((kind, id) => {
    setFocusedItem({ kind, id });
  }, []);

  const handleBlurItem = useCallback(() => {
    setFocusedItem(null);
  }, []);

  const effectiveHighlightedNodeId =
    focusedItem?.kind === 'node' ? focusedItem.id : highlightedNodeId;
  const effectiveHighlightedComponentId =
    focusedItem?.kind === 'component' ? focusedItem.id : highlightedComponentId;

  const svgRef = useRef(null);
  const didDragRef = useRef(false);
  const nextNodeId = useRef(0);
  const nextEdgeId = useRef(0);

  const panZoom = usePanZoom(svgRef, { disabled: !!selectedTool });
  const panel = useResizablePanel();
  const leftPanel = useResizablePanel({ side: 'left' });

  const { undo, redo, canUndo, canRedo } = useHistory({
    nodes,
    edges,
    wire,
    wireNodes,
    wireEdges,
    dragging: dragging ?? draggingComponentId,
    setNodes,
    setEdges,
    setWire,
    setWireNodes,
    setWireEdges,
    onRestore: (s) => {
      setSelected(null);
      setDrawingFromVertexId(null);
      nextNodeId.current = s.nodes.length > 0 ? Math.max(...s.nodes.map((n) => n.id)) + 1 : 0;
      nextEdgeId.current =
        s.edges.length > 0
          ? Math.max(...s.edges.map((e) => parseInt(e.id.slice(1), 10))) + 1
          : 0;
    },
  });

  useEffect(() => {
    document.documentElement.classList.toggle('light', theme === 'light');
  }, [theme]);

  // ---- mode switch ----

  const handleSetMode = useCallback(
    (next) => {
      if (next === mode) return;
      setMode(next);
      setSelected(null);
      setConnectFrom(null);
      setDrawingFromVertexId(null);
      setHover(null);
      setSelectedTool(next === 'wire' ? 'wire' : null);
      if (next === 'schematic' && nodes.length === 0 && edges.length === 0) {
        setNodes(SCHEMATIC_DEFAULT.nodes);
        setEdges(SCHEMATIC_DEFAULT.edges);
        nextNodeId.current = SCHEMATIC_DEFAULT.nextNodeId;
        nextEdgeId.current = SCHEMATIC_DEFAULT.nextEdgeId;
      }
    },
    [mode, nodes.length, edges.length],
  );

  // ---- shared actions ----

  const clearCircuit = useCallback(() => {
    if (mode === 'wire') {
      setWire(EMPTY_WIRE);
      setWireNodes([]);
      setWireEdges([]);
      setDrawingFromVertexId(null);
      setSelectedTool('wire');
    } else {
      setNodes([]);
      setEdges([]);
      setConnectFrom(null);
      setSelectedTool(null);
      nextNodeId.current = 0;
      nextEdgeId.current = 0;
    }
    setSelected(null);
    setHover(null);
    panZoom.reset();
  }, [panZoom, mode]);

  const updateNode = useCallback((id, patch) => {
    setNodes((prev) => prev.map((n) => (n.id === id ? { ...n, ...patch } : n)));
  }, []);

  const updateEdge = useCallback((id, patch) => {
    setEdges((prev) => prev.map((e) => (e.id === id ? { ...e, ...patch } : e)));
  }, []);

  const updateWireNode = useCallback((id, patch) => {
    const augmented = { ...patch };
    if (patch.label !== undefined) {
      augmented.userLabel = patch.label.length > 0;
    }
    if (patch.color !== undefined) {
      augmented.userColor = true;
    }
    setWireNodes((prev) => prev.map((n) => (n.id === id ? { ...n, ...augmented } : n)));
  }, []);

  const setAllNodeColors = useCallback((color) => {
    setWireNodes((prev) => prev.map((n) => ({ ...n, color, userColor: true })));
  }, []);

  const setAllComponentColorsOfType = useCallback((typeKey, color) => {
    setWire((w) => ({
      ...w,
      components: w.components.map((c) => (c.type === typeKey ? { ...c, color } : c)),
    }));
  }, []);

  const deleteSelected = useCallback(() => {
    if (!selected) return;
    if (selected.type === 'edge') {
      setEdges((prev) => prev.filter((e) => e.id !== selected.id));
    } else if (selected.type === 'node') {
      setEdges((prev) => prev.filter((e) => e.from !== selected.id && e.to !== selected.id));
      setNodes((prev) => prev.filter((n) => n.id !== selected.id));
    } else if (selected.kind === 'wireComponent') {
      setWire((w) => removeComponent(w, selected.id));
    } else if (selected.kind === 'wireSegment') {
      if (selected.slotIndex !== undefined) {
        setWire((w) => deleteWireSegmentSlot(w, selected.id, selected.slotIndex));
      } else {
        setWire((w) => deleteWireSegment(w, selected.id));
      }
    } else if (selected.kind === 'wireVertex') {
      setWire((w) => deleteWireVertex(w, selected.id));
    }
    setSelected(null);
  }, [selected]);

  const handleSelectTool = useCallback((toolId) => {
    setSelectedTool((prev) => (prev === toolId ? null : toolId));
    setConnectFrom(null);
    setDrawingFromVertexId(null);
    setHover(null);
  }, []);

  const handleEscape = useCallback(() => {
    if (drawingFromVertexId !== null) {
      setDrawingFromVertexId(null);
    } else if (selectedTool) {
      setSelectedTool(null);
      setConnectFrom(null);
    } else if (selected) {
      setSelected(null);
    }
  }, [selectedTool, selected, drawingFromVertexId]);

  useKeyboardShortcuts({
    undo,
    redo,
    onEscape: handleEscape,
    onDelete: deleteSelected,
  });

  // ---- wire-mode hover dispatch ----

  /**
   * Resolve the cursor position to a "what would happen if you click here"
   * descriptor. Hover priority: existing vertex → existing segment →
   * grid-snap (or free placement when shift is held).
   */
  const computeHover = useCallback(
    (pt, shiftKey) => {
      if (mode !== 'wire') return null;
      const verts = wire.vertices;
      const segs = wire.segments;
      const vById = new Map(verts.map((v) => [v.id, v]));
      const sById = new Map(segs.map((s) => [s.id, s]));

      const vid = snapToVertex(verts, pt.x, pt.y);
      if (vid !== null) {
        const v = vById.get(vid);
        return { kind: 'vertex', id: vid, x: v.x, y: v.y };
      }

      // No tool — prefer existing components for selection.
      if (!selectedTool) {
        const compHit = snapToComponent(wire, pt.x, pt.y);
        if (compHit) return { kind: 'component', id: compHit.id };
      }

      const segHit = snapToSegment(verts, segs, pt.x, pt.y);

      if (selectedTool === 'wire') {
        if (segHit) {
          const s = sById.get(segHit.id);
          const a = vById.get(s.from);
          const b = vById.get(s.to);
          const dx = b.x - a.x;
          const dy = b.y - a.y;
          const len2 = dx * dx + dy * dy;
          let tFinal = segHit.t;
          // Default: prefer a grid intersection that lies on (or near) the
          // segment so wire crossings land cleanly on the grid. Shift skips
          // this and uses the raw cursor projection.
          if (!shiftKey && len2 > 1e-9) {
            const g = snapToGrid(pt.x, pt.y);
            const tg = ((g.x - a.x) * dx + (g.y - a.y) * dy) / len2;
            if (tg >= 0 && tg <= 1) {
              const px = a.x + tg * dx;
              const py = a.y + tg * dy;
              if (Math.hypot(g.x - px, g.y - py) < 12) {
                tFinal = tg;
              }
            }
          }
          return {
            kind: 'segment',
            segmentId: segHit.id,
            t: tFinal,
            slotIndex: slotIndexForT(componentsOnSegment(wire, segHit.id), tFinal),
            x: a.x + tFinal * dx,
            y: a.y + tFinal * dy,
          };
        }
        if (shiftKey) return { kind: 'free', x: pt.x, y: pt.y };
        const g = snapToGrid(pt.x, pt.y);
        return { kind: 'grid', x: g.x, y: g.y };
      }

      if (selectedTool === 'C' || selectedTool === 'L' || selectedTool === 'JJ') {
        if (!segHit) return null;
        const s = sById.get(segHit.id);
        const a = vById.get(s.from);
        const b = vById.get(s.to);
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const L = Math.hypot(dx, dy);
        // End-snap (terminal-on-vertex) wins over fraction-snap when in range.
        const tEnd = snapComponentEnd(segHit.t, L);
        const f = tEnd !== segHit.t
          ? { t: tEnd, label: 'end' }
          : snapFraction(segHit.t);
        const tFinal = f.t;
        return {
          kind: 'componentOnSegment',
          segmentId: segHit.id,
          t: tFinal,
          x: a.x + tFinal * dx,
          y: a.y + tFinal * dy,
          dirX: L > 0 ? dx / L : 1,
          dirY: L > 0 ? dy / L : 0,
          snapLabel: f.label,
        };
      }

      // No tool, no component hit — fall back to segment for selection.
      if (segHit) {
        const s = sById.get(segHit.id);
        const a = vById.get(s.from);
        const b = vById.get(s.to);
        return {
          kind: 'segment',
          segmentId: segHit.id,
          t: segHit.t,
          slotIndex: slotIndexForT(componentsOnSegment(wire, segHit.id), segHit.t),
          x: a.x + segHit.t * (b.x - a.x),
          y: a.y + segHit.t * (b.y - a.y),
        };
      }
      return null;
    },
    [mode, selectedTool, wire],
  );

  const handleWireClick = useCallback(
    (pt, shiftKey) => {
      const h = computeHover(pt, shiftKey);

      if (selectedTool === 'wire') {
        let nextWire = wire;
        let targetVertexId = null;
        let snappedToExistingVertex = false;

        if (h?.kind === 'vertex') {
          targetVertexId = h.id;
          snappedToExistingVertex = true;
        } else if (h?.kind === 'segment') {
          const r = splitWireSegmentAt(nextWire, h.segmentId, h.t);
          nextWire = r.wire;
          targetVertexId = r.vertexId;
        } else {
          const x = h?.x ?? pt.x;
          const y = h?.y ?? pt.y;
          const r = addWireVertex(nextWire, x, y);
          nextWire = r.wire;
          targetVertexId = r.vertexId;
        }

        if (drawingFromVertexId === null) {
          setWire(nextWire);
          setDrawingFromVertexId(targetVertexId);
        } else if (targetVertexId === drawingFromVertexId) {
          setWire(nextWire);
          setDrawingFromVertexId(null);
        } else {
          nextWire = addWireSegment(nextWire, drawingFromVertexId, targetVertexId, 'wire');
          setWire(nextWire);
          // Snap to an existing vertex closes the chain; everything else
          // continues from the new vertex so the user can keep drawing.
          setDrawingFromVertexId(snappedToExistingVertex ? null : targetVertexId);
        }
        return;
      }

      if (selectedTool === 'C' || selectedTool === 'L' || selectedTool === 'JJ') {
        if (h?.kind === 'componentOnSegment') {
          setWire((w) => placeComponentOnSegment(w, h.segmentId, h.t, selectedTool));
        } else {
          // No segment under the cursor — drop a standalone component
          // with two free terminal vertices. Snap to grid unless shift.
          const base = shiftKey ? pt : snapToGrid(pt.x, pt.y);
          setWire((w) => placeStandaloneComponent(w, base.x, base.y, selectedTool).wire);
        }
        return;
      }

      // No tool — selection / deselection.
      if (h?.kind === 'vertex') {
        setSelected({ kind: 'wireVertex', id: h.id });
        const owner = wireNodes.find((n) => n.vertexIds?.includes(h.id));
        if (owner) handleHighlightNode(owner.id);
        else clearHighlights();
      } else if (h?.kind === 'component') {
        setSelected({ kind: 'wireComponent', id: h.id });
        handleHighlightComponent(h.id);
      } else if (h?.kind === 'segment') {
        setSelected({ kind: 'wireSegment', id: h.segmentId, slotIndex: h.slotIndex });
        const nodeId = nodeIdForSegmentSlot(wire, wireNodes, h.segmentId, h.slotIndex);
        if (nodeId != null) handleHighlightNode(nodeId);
        else clearHighlights();
      } else {
        setSelected(null);
        clearHighlights();
      }
    },
    [
      computeHover,
      selectedTool,
      wire,
      wireNodes,
      drawingFromVertexId,
      handleHighlightNode,
      handleHighlightComponent,
      clearHighlights,
    ],
  );

  // Auto-rerun electrical-node detection on every wire change. Uses a
  // ref for the previous result so the effect doesn't depend on
  // wireNodes/wireEdges (which would loop).
  const prevAnalysisRef = useRef({ nodes: [], edges: [] });
  useEffect(() => {
    prevAnalysisRef.current = { nodes: wireNodes, edges: wireEdges };
  }, [wireNodes, wireEdges]);

  useEffect(() => {
    const result = autoDetectNodes(wire, prevAnalysisRef.current);
    setWireNodes(result.nodes);
    setWireEdges(result.edges);
  }, [wire]);

  const handleImportFile = useCallback(
    async (file) => {
      let payload;
      try {
        const text = await file.text();
        payload = JSON.parse(text);
      } catch (err) {
        alert(`Could not parse JSON: ${err.message}`);
        return;
      }
      let parsed;
      try {
        parsed = parseImportPayload(payload);
      } catch (err) {
        alert(`Could not import circuit: ${err.message}`);
        return;
      }

      setSelected(null);
      setConnectFrom(null);
      setDrawingFromVertexId(null);
      setHover(null);

      if (parsed.kind === 'wire') {
        setMode('wire');
        setSelectedTool('wire');
        setWire(parsed.wire);
        // Apply user node overrides via autoDetectNodes' carry-forward by
        // synthesizing a fake "previous" snapshot.
        const previousNodes = parsed.nodeOverrides.map((o) => ({
          label: o.label,
          color: o.color,
          userLabel: !!o.label,
          userColor: !!o.color,
          isGround: !!o.is_ground,
          vertexIds: o.anchor != null ? [o.anchor] : [],
          phantomKey: o.phantom_key || undefined,
        }));
        const result = autoDetectNodes(parsed.wire, { nodes: previousNodes, edges: [] });
        setWireNodes(result.nodes);
        setWireEdges(result.edges);
      } else {
        setMode('schematic');
        setSelectedTool(null);
        setNodes(parsed.nodes);
        setEdges(parsed.edges);
        nextNodeId.current = parsed.nextNodeId;
        nextEdgeId.current = parsed.nextEdgeId;
      }
    },
    [],
  );

  const onSetComponentType = useCallback((componentId, type) => {
    setWire((w) => setComponentType(w, componentId, type));
  }, []);

  const onSetComponentValue = useCallback((componentId, value) => {
    setWire((w) => setComponentValue(w, componentId, value));
  }, []);

  const onUpdateComponent = useCallback((componentId, patch) => {
    setWire((w) => {
      let next = w;
      if (patch.value !== undefined) next = setComponentValue(next, componentId, patch.value);
      if (patch.color !== undefined) next = setComponentColor(next, componentId, patch.color);
      if (patch.type !== undefined) next = setComponentType(next, componentId, patch.type);
      return next;
    });
  }, []);

  // ---- schematic-mode handlers ----

  const onSchematicCanvasClick = useCallback(
    (pt) => {
      if (selectedTool === 'node') {
        const id = nextNodeId.current++;
        setNodes((prev) => [
          ...prev,
          { id, x: pt.x, y: pt.y, label: `\\phi_{${id}}`, isGround: false },
        ]);
        return;
      }
      setSelected(null);
      setConnectFrom(null);
    },
    [selectedTool],
  );

  const onSchematicNodeClick = useCallback(
    (nodeId, e) => {
      e.stopPropagation();
      if (didDragRef.current) {
        didDragRef.current = false;
        return;
      }
      if (selectedTool && selectedTool !== 'node') {
        if (connectFrom === null) {
          setConnectFrom(nodeId);
        } else if (connectFrom !== nodeId) {
          const id = `e${nextEdgeId.current++}`;
          setEdges((prev) => [
            ...prev,
            {
              id,
              from: connectFrom,
              to: nodeId,
              type: selectedTool,
              value: nextSchematicSymbol(prev, selectedTool),
            },
          ]);
          setConnectFrom(null);
        }
        return;
      }
      setSelected({ type: 'node', id: nodeId });
    },
    [selectedTool, connectFrom],
  );

  const onSchematicNodeMouseDown = useCallback((nodeId, e) => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    setDragging(nodeId);
  }, []);

  const onSchematicEdgeClick = useCallback((edgeId, e) => {
    e.stopPropagation();
    setSelected({ type: 'edge', id: edgeId });
  }, []);

  // ---- canvas-level events ----

  const onCanvasClick = useCallback(
    (e) => {
      if (panZoom.didPanRef.current) {
        panZoom.didPanRef.current = false;
        return;
      }
      if (didDragRef.current) {
        didDragRef.current = false;
        return;
      }
      const pt = panZoom.svgPoint(e);
      if (mode === 'wire') {
        handleWireClick(pt, e.shiftKey);
        return;
      }
      // Schematic: only handle background hits; nodes/edges have their own onClick.
      if (e.target !== svgRef.current && e.target.tagName !== 'rect') return;
      onSchematicCanvasClick(pt);
    },
    [mode, panZoom, handleWireClick, onSchematicCanvasClick],
  );

  const onMouseMove = useCallback(
    (e) => {
      if (panel.isResizing() || leftPanel.isResizing()) return;
      if (panZoom.processMove(e)) return;

      const pt = panZoom.svgPoint(e);

      if (dragging !== null) {
        didDragRef.current = true;
        if (mode === 'wire') {
          const base = e.shiftKey ? pt : snapToGrid(pt.x, pt.y);
          setWire((w) => {
            // Snap visually onto another vertex when within radius and
            // the resulting merge would be safe (both ends free, no
            // component lost). The graph stays separate until mouseup.
            const others = w.vertices.filter((v) => v.id !== dragging);
            const overId = snapToVertex(others, base.x, base.y);
            const canSnap = overId !== null && canMergeVertices(w, dragging, overId);
            const target = canSnap ? others.find((v) => v.id === overId) : base;
            return {
              ...w,
              vertices: w.vertices.map((v) =>
                v.id === dragging ? { ...v, x: target.x, y: target.y } : v,
              ),
            };
          });
        } else {
          setNodes((prev) =>
            prev.map((n) => (n.id === dragging ? { ...n, x: pt.x, y: pt.y } : n)),
          );
        }
        return;
      }

      if (draggingComponentId !== null) {
        didDragRef.current = true;
        const hit = nearestSegment(wire, pt.x, pt.y);
        if (hit) {
          let tFinal;
          if (e.shiftKey) {
            tFinal = hit.t;
          } else {
            const seg = wire.segments.find((s) => s.id === hit.id);
            const a = wire.vertices.find((v) => v.id === seg.from);
            const b = wire.vertices.find((v) => v.id === seg.to);
            const Lseg = a && b ? Math.hypot(b.x - a.x, b.y - a.y) : 0;
            const tEnd = snapComponentEnd(hit.t, Lseg);
            tFinal = tEnd !== hit.t ? tEnd : snapFraction(hit.t).t;
          }
          setWire((w) => setComponentPlacement(w, draggingComponentId, hit.id, tFinal));
        }
        return;
      }

      if (mode === 'wire') {
        setHover(computeHover(pt, e.shiftKey));
      }
    },
    [dragging, draggingComponentId, wire, panZoom, panel, leftPanel, mode, computeHover],
  );

  const onMouseUp = useCallback(() => {
    panZoom.endPan();
    if (dragging !== null && mode === 'wire') {
      const draggedId = dragging;
      setWire((w) => {
        const dv = w.vertices.find((v) => v.id === draggedId);
        if (!dv) return w;
        const overlap = w.vertices.find(
          (v) => v.id !== draggedId && Math.hypot(v.x - dv.x, v.y - dv.y) < 0.5,
        );
        if (!overlap) return w;
        if (!canMergeVertices(w, draggedId, overlap.id)) return w;
        setSelected({ kind: 'wireVertex', id: overlap.id });
        return mergeVertices(w, draggedId, overlap.id);
      });
    }
    setDragging(null);
    setDraggingComponentId(null);
  }, [panZoom, dragging, mode]);

  const onMouseLeave = useCallback(() => {
    panZoom.endPan();
    setDragging(null);
    setDraggingComponentId(null);
    setHover(null);
  }, [panZoom]);

  const onCanvasDoubleClick = useCallback(
    (e) => {
      if (mode !== 'wire') return;
      const pt = panZoom.svgPoint(e);
      const segHit = snapToSegment(wire.vertices, wire.segments, pt.x, pt.y);
      if (!segHit) return;
      // Avoid double-clicking right on top of an existing vertex.
      if (snapToVertex(wire.vertices, pt.x, pt.y) !== null) return;
      e.stopPropagation();
      const r = splitWireSegmentAt(wire, segHit.id, segHit.t);
      setWire(r.wire);
      if (r.vertexId !== null) {
        setSelected({ kind: 'wireVertex', id: r.vertexId });
      }
    },
    [mode, panZoom, wire],
  );

  const onContextMenu = useCallback((e) => {
    e.preventDefault();
    setSelectedTool(null);
    setConnectFrom(null);
    setDrawingFromVertexId(null);
    setHover(null);
  }, []);

  const onWireVertexMouseDown = useCallback(
    (vertexId, e) => {
      if (e.button !== 0) return;
      e.preventDefault();
      e.stopPropagation();
      setDragging(vertexId);
      setSelected({ kind: 'wireVertex', id: vertexId });
      setHover(null);
      const owner = wireNodes.find((n) => n.vertexIds?.includes(vertexId));
      if (owner) handleHighlightNode(owner.id);
      else clearHighlights();
    },
    [wireNodes, handleHighlightNode, clearHighlights],
  );

  const onWireComponentMouseDown = useCallback(
    (componentId, e) => {
      if (e.button !== 0) return;
      if (selectedTool) return;
      e.preventDefault();
      e.stopPropagation();
      setDraggingComponentId(componentId);
      setSelected({ kind: 'wireComponent', id: componentId });
      setHover(null);
      handleHighlightComponent(componentId);
    },
    [selectedTool, handleHighlightComponent],
  );

  // ---- render ----

  const isWireMode = mode === 'wire';
  const analysisNodes = isWireMode ? wireNodes : nodes;
  const analysisEdges = isWireMode ? wireEdges : edges;
  const analysisUpdater = isWireMode ? updateWireNode : updateNode;

  return (
    <div style={{ width: '100%', height: '100vh', display: 'flex', flexDirection: 'column' }}>
      <HeaderBar
        onClear={clearCircuit}
        onExport={() =>
          downloadJSON(
            analysisNodes,
            analysisEdges,
            isWireMode ? { wire, wireNodes } : { schematicNodes: nodes },
          )
        }
        onImport={handleImportFile}
      />

      <Toolbar
        mode={mode}
        onSetMode={handleSetMode}
        selectedTool={selectedTool}
        onSelectTool={handleSelectTool}
        connectFrom={connectFrom}
        drawingFromVertexId={drawingFromVertexId}
        canUndo={canUndo}
        canRedo={canRedo}
        onUndo={undo}
        onRedo={redo}
        showEdgeLabels={showEdgeLabels}
        onToggleLabels={() => setShowEdgeLabels((v) => !v)}
        onResetView={() => panZoom.fitToNodes(isWireMode ? wire.vertices : nodes)}
      />

      <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
        <NodeLabelsPanel
          nodes={analysisNodes}
          onUpdateNode={analysisUpdater}
          components={isWireMode ? wire.components : undefined}
          onUpdateComponent={isWireMode ? onUpdateComponent : undefined}
          width={leftPanel.width}
          onResizeStart={leftPanel.onResizeStart}
          highlightedNodeId={isWireMode ? effectiveHighlightedNodeId : null}
          highlightedComponentId={isWireMode ? effectiveHighlightedComponentId : null}
          onHighlightNode={isWireMode ? handleHighlightNode : undefined}
          onFocusItem={isWireMode ? handleFocusItem : undefined}
          onBlurItem={isWireMode ? handleBlurItem : undefined}
          onSetAllNodeColors={isWireMode ? setAllNodeColors : undefined}
          onSetAllComponentColorsOfType={isWireMode ? setAllComponentColorsOfType : undefined}
        />

        <div style={{ flex: 1, position: 'relative' }}>
          <svg
            ref={svgRef}
            width="100%"
            height="100%"
            style={{
              background: 'var(--bg-secondary)',
              cursor: selectedTool ? 'crosshair' : 'default',
            }}
            onMouseDown={(e) => {
              if (document.activeElement && document.activeElement !== document.body) {
                document.activeElement.blur();
              }
              panZoom.onCanvasMouseDown(e);
            }}
            onClick={onCanvasClick}
            onDoubleClick={onCanvasDoubleClick}
            onContextMenu={onContextMenu}
            onMouseMove={onMouseMove}
            onMouseUp={onMouseUp}
            onMouseLeave={onMouseLeave}
          >
            <defs>
              <pattern
                id="grid"
                width="30"
                height="30"
                patternUnits="userSpaceOnUse"
                patternTransform={`translate(${panZoom.pan.x},${panZoom.pan.y}) scale(${panZoom.zoom})`}
              >
                <path
                  d="M 30 0 L 0 0 0 30"
                  fill="none"
                  stroke="var(--grid-line)"
                  strokeWidth="0.5"
                />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#grid)" />

            <g transform={`translate(${panZoom.pan.x},${panZoom.pan.y}) scale(${panZoom.zoom})`}>
              {isWireMode ? (
                <WireLayer
                  wire={wire}
                  wireNodes={wireNodes}
                  drawingFromVertexId={drawingFromVertexId}
                  hover={hover}
                  selectedTool={selectedTool}
                  selected={selected}
                  onVertexMouseDown={onWireVertexMouseDown}
                  onComponentMouseDown={onWireComponentMouseDown}
                  showLabels={showEdgeLabels}
                  zoom={panZoom.zoom}
                  highlightedNodeId={effectiveHighlightedNodeId}
                  highlightedComponentId={effectiveHighlightedComponentId}
                  onHighlightNode={handleHighlightNode}
                  onHighlightComponent={handleHighlightComponent}
                />
              ) : (
                <>
                  {edges.map((edge) => {
                    const from = nodes.find((n) => n.id === edge.from);
                    const to = nodes.find((n) => n.id === edge.to);
                    if (!from || !to) return null;
                    return (
                      <CircuitEdge
                        key={edge.id}
                        edge={edge}
                        from={from}
                        to={to}
                        isSelected={selected?.type === 'edge' && selected.id === edge.id}
                        showLabel={showEdgeLabels}
                        onClick={onSchematicEdgeClick}
                      />
                    );
                  })}
                  {nodes.map((node) => (
                    <CircuitNode
                      key={node.id}
                      node={node}
                      isSelected={selected?.type === 'node' && selected.id === node.id}
                      isSource={connectFrom === node.id}
                      hasToolActive={!!selectedTool}
                      onClick={onSchematicNodeClick}
                      onMouseDown={onSchematicNodeMouseDown}
                    />
                  ))}
                </>
              )}
            </g>
          </svg>

          {isWireMode ? (
            <WirePropertiesPanel
              selected={selected}
              wire={wire}
              onSetComponentType={onSetComponentType}
              onSetComponentValue={onSetComponentValue}
              onDelete={deleteSelected}
            />
          ) : (
            <PropertiesPanel
              selected={selected}
              nodes={nodes}
              edges={edges}
              onUpdateNode={updateNode}
              onUpdateEdge={updateEdge}
              onDelete={deleteSelected}
            />
          )}
        </div>

        <HamiltonianPanel
          nodes={analysisNodes}
          edges={analysisEdges}
          width={panel.width}
          onResizeStart={panel.onResizeStart}
        />
      </div>
    </div>
  );
}
