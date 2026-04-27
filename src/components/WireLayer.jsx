import React from 'react';
import Wires from './wire/Wires.jsx';
import Components from './wire/Components.jsx';
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
}) {
  const vById = new Map(wire.vertices.map((v) => [v.id, v]));

  // electrical-node lookups
  const vertexNodeId = new Map();
  const nodeById = new Map();
  for (const n of wireNodes) {
    nodeById.set(n.id, n);
    if (n.vertexIds) {
      for (const vid of n.vertexIds) vertexNodeId.set(vid, n.id);
    }
  }
  const colorForNode = (id) =>
    id === undefined ? 'var(--text-secondary)' : nodeById.get(id)?.color ?? 'var(--text-secondary)';

  // Selection lookup: stringified "kind:id" keys.
  const selectedKeys = new Set();
  for (const s of selection) {
    if (s.kind) selectedKeys.add(`${s.kind}:${s.id}`);
  }
  const isSelected = (kind, id) => selectedKeys.has(`${kind}:${id}`);

  // Inverse-zoom factor for keeping labels at constant on-screen size.
  const labelScale = 1 / Math.max(zoom, 0.0001);

  return (
    <g>
      <Wires
        wire={wire}
        vById={vById}
        vertexNodeId={vertexNodeId}
        colorForNode={colorForNode}
        isSelected={isSelected}
        highlightedNodeId={highlightedNodeId}
      />
      <Components
        wire={wire}
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
      <HoverPreview
        wire={wire}
        hover={hover}
        selectedTool={selectedTool}
        drawingFromVertexId={drawingFromVertexId}
      />
      <Vertices
        wire={wire}
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
        wire={wire}
        vById={vById}
        labelScale={labelScale}
        onHighlightNode={onHighlightNode}
      />
    </g>
  );
}
