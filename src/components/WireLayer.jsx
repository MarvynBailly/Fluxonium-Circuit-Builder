import React, { useMemo } from 'react';
import Wires from './wire/Wires.jsx';
import Components from './wire/Components.jsx';
import Grounds from './wire/Grounds.jsx';
import Vertices from './wire/Vertices.jsx';
import NodeLabels from './wire/NodeLabels.jsx';
import HoverPreview from './wire/HoverPreview.jsx';

/**
 * Render the wire graph plus the hover preview. Wire and component
 * edges are tinted with their electrical-node color; node labels are
 * drawn near each node centroid. Click dispatch is handled at the
 * canvas level using the parent's hover state, so this layer paints
 * visuals (vertices and component bodies have mouse-down handlers
 * for drag).
 *
 * `selection` is the multi-selection array; an internal lookup is
 * built once so subcomponents can do O(1) selected-checks.
 *
 * Lookup maps and the small helper closures are memoized so each child
 * sees stable prop references — combined with React.memo on the
 * children, this skips re-rendering the ~150-component SVG tree on
 * unrelated state changes (hover, drag of an unrelated vertex, etc.).
 */
export default function WireLayer({
  wire,
  wireNodes = [],
  drawingFromVertexId,
  hover,
  selectedTool,
  selection = [],
  onVertexMouseDown,
  onComponentMouseDown,
  showLabels = true,
  zoom = 1,
  highlightedNodeId = null,
  highlightedComponentId = null,
  onHighlightNode,
  onHighlightComponent,
  placingGroundFor = null,
  cursor = null,
  shiftKey = false,
}) {
  const vById = useMemo(
    () => new Map(wire.vertices.map((v) => [v.id, v])),
    [wire.vertices],
  );

  const { vertexNodeId, nodeById } = useMemo(() => {
    const vmap = new Map();
    const nmap = new Map();
    for (const n of wireNodes) {
      nmap.set(n.id, n);
      if (n.vertexIds) {
        for (const vid of n.vertexIds) vmap.set(vid, n.id);
      }
    }
    return { vertexNodeId: vmap, nodeById: nmap };
  }, [wireNodes]);

  const colorForNode = useMemo(
    () => (id) =>
      id === undefined
        ? 'var(--text-secondary)'
        : nodeById.get(id)?.color ?? 'var(--text-secondary)',
    [nodeById],
  );

  const selectedKeys = useMemo(() => {
    const set = new Set();
    for (const s of selection) {
      if (s.kind) set.add(`${s.kind}:${s.id}`);
    }
    return set;
  }, [selection]);
  const isSelected = useMemo(
    () => (kind, id) => selectedKeys.has(`${kind}:${id}`),
    [selectedKeys],
  );

  // Inverse-zoom factor for keeping labels at constant on-screen size.
  const labelScale = 1 / Math.max(zoom, 0.0001);

  return (
    <g>
      <Wires
        wires={wire.wires}
        vById={vById}
        vertexNodeId={vertexNodeId}
        colorForNode={colorForNode}
        isSelected={isSelected}
        highlightedNodeId={highlightedNodeId}
      />
      <Components
        components={wire.components}
        vById={vById}
        vertexNodeId={vertexNodeId}
        colorForNode={colorForNode}
        isSelected={isSelected}
        selectedTool={selectedTool}
        highlightedComponentId={highlightedComponentId}
        showLabels={showLabels}
        labelScale={labelScale}
        onComponentMouseDown={onComponentMouseDown}
        onHighlightComponent={onHighlightComponent}
      />
      <Grounds
        grounds={wire.grounds ?? []}
        vById={vById}
        vertexNodeId={vertexNodeId}
        colorForNode={colorForNode}
      />
      <HoverPreview
        wire={wire}
        hover={hover}
        selectedTool={selectedTool}
        drawingFromVertexId={drawingFromVertexId}
        placingGroundFor={placingGroundFor}
        cursor={cursor}
        shiftKey={shiftKey}
      />
      <Vertices
        vertices={wire.vertices}
        vertexNodeId={vertexNodeId}
        colorForNode={colorForNode}
        drawingFromVertexId={drawingFromVertexId}
        isSelected={isSelected}
        hover={hover}
        selectedTool={selectedTool}
        highlightedNodeId={highlightedNodeId}
        onVertexMouseDown={onVertexMouseDown}
      />
      <NodeLabels
        wireNodes={wireNodes}
        wires={wire.wires}
        vById={vById}
        labelScale={labelScale}
        onHighlightNode={onHighlightNode}
      />
    </g>
  );
}
