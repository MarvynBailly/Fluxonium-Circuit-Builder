/**
 * Serialize circuit topology to a downloadable JSON file.
 *
 * Wire-mode exports preserve the full geometry (vertex positions,
 * segment topology, component placements) plus any user-set node
 * labels / grounds, so re-importing produces an identical-looking
 * diagram. Schematic-mode exports preserve node positions directly.
 */

import { adjacencyMatrix, capacitanceMatrix, formatSymbolicSum } from '../physics/hamiltonian.js';

/**
 * @param {Array} nodes - analysis-level nodes (electrical nodes)
 * @param {Array} edges - analysis-level edges
 * @param {Object} [extra]
 * @param {Object} [extra.wire]            - full wire model (wire mode)
 * @param {Array}  [extra.wireNodes]       - electrical-node array for label/ground carry
 * @param {Array}  [extra.schematicNodes]  - schematic nodes with x/y (schematic mode)
 */
export function buildExportPayload(nodes, edges, extra = {}) {
  const adj = adjacencyMatrix(nodes, edges);
  const cap = capacitanceMatrix(nodes, edges);
  const capacitance = cap.cells.map((row) => row.map((cell) => formatSymbolicSum(cell)));

  const payload = {
    _meta: {
      generator: 'fluxonium-circuit-builder',
      version: '0.2.0',
      exported_at: new Date().toISOString(),
      description: 'Circuit topology exported from an interactive circuit graph.',
    },
    nodes: nodes.map((n) => ({
      id: n.id,
      label: n.label,
      is_ground: !!n.isGround,
    })),
    edges: edges.map((e) => ({
      id: e.id,
      from: e.from,
      to: e.to,
      type: e.type,
      value: e.value,
      unit: e.type === 'C' ? 'fF' : e.type === 'L' ? 'nH' : 'GHz',
    })),
    adjacency_matrix: adj.matrix,
    capacitance_matrix: {
      node_order: cap.nodeList.map((n) => n.id),
      cells: capacitance,
    },
  };

  if (extra.schematicNodes) {
    payload.node_positions = extra.schematicNodes.map((n) => ({
      id: n.id,
      x: n.x,
      y: n.y,
    }));
  }

  if (extra.wire) {
    payload.wire_geometry = {
      vertices: extra.wire.vertices.map((v) => ({ id: v.id, x: v.x, y: v.y })),
      segments: extra.wire.segments.map((s) => ({ id: s.id, from: s.from, to: s.to })),
      components: extra.wire.components.map((c) => ({
        id: c.id,
        segment_id: c.segmentId,
        t: c.t,
        type: c.type,
        value: c.value,
      })),
      next_vertex_id: extra.wire.nextVertexId,
      next_segment_id: extra.wire.nextSegmentId,
      next_component_id: extra.wire.nextComponentId,
    };

    if (extra.wireNodes) {
      payload.node_overrides = extra.wireNodes
        .filter((n) => n.userLabel || n.userColor || n.isGround)
        .map((n) => {
          const anchor =
            n.vertexIds && n.vertexIds.length ? Math.min(...n.vertexIds) : null;
          return {
            anchor,
            phantom_key: n.phantomKey || null,
            label: n.userLabel ? n.label : undefined,
            color: n.userColor ? n.color : undefined,
            is_ground: n.isGround || undefined,
          };
        });
    }
  }

  return payload;
}

/**
 * Reverse of buildExportPayload. Returns one of:
 *   { kind: 'wire', wire, nodeOverrides }
 *   { kind: 'schematic', nodes, edges, nextNodeId, nextEdgeId }
 */
export function parseImportPayload(payload) {
  if (payload?.wire_geometry) {
    const g = payload.wire_geometry;
    const wire = {
      vertices: g.vertices.map((v) => ({ id: v.id, x: v.x, y: v.y })),
      segments: g.segments.map((s) => ({ id: s.id, from: s.from, to: s.to })),
      components: g.components.map((c) => ({
        id: c.id,
        segmentId: c.segment_id,
        t: c.t,
        type: c.type,
        value: c.value,
      })),
      nextVertexId:
        g.next_vertex_id ?? (g.vertices.length ? Math.max(...g.vertices.map((v) => v.id)) + 1 : 0),
      nextSegmentId:
        g.next_segment_id ??
        (g.segments.length
          ? Math.max(...g.segments.map((s) => parseInt(String(s.id).slice(1), 10) || 0)) + 1
          : 0),
      nextComponentId:
        g.next_component_id ??
        (g.components.length
          ? Math.max(...g.components.map((c) => parseInt(String(c.id).slice(1), 10) || 0)) + 1
          : 0),
    };
    return {
      kind: 'wire',
      wire,
      nodeOverrides: payload.node_overrides || [],
    };
  }

  // Schematic. Use node_positions if present; otherwise fall back to a circle.
  const positionsById = new Map();
  if (payload.node_positions) {
    for (const p of payload.node_positions) positionsById.set(p.id, { x: p.x, y: p.y });
  }
  const N = payload.nodes.length;
  const center = { x: 480, y: 320 };
  const radius = 180;
  const nodes = payload.nodes.map((n, i) => {
    const p = positionsById.get(n.id);
    const a = (i / Math.max(N, 1)) * 2 * Math.PI - Math.PI / 2;
    return {
      id: n.id,
      x: p ? p.x : center.x + radius * Math.cos(a),
      y: p ? p.y : center.y + radius * Math.sin(a),
      label: n.label,
      isGround: !!n.is_ground,
    };
  });
  const edges = payload.edges.map((e) => ({
    id: e.id,
    from: e.from,
    to: e.to,
    type: e.type,
    value: e.value,
  }));
  return {
    kind: 'schematic',
    nodes,
    edges,
    nextNodeId: nodes.length ? Math.max(...nodes.map((n) => n.id)) + 1 : 0,
    nextEdgeId: edges.length
      ? Math.max(...edges.map((e) => parseInt(String(e.id).slice(1), 10) || 0)) + 1
      : 0,
  };
}

/**
 * Trigger a browser download of the JSON payload.
 */
export function downloadJSON(nodes, edges, extra, filename = 'circuit-topology.json') {
  const payload = buildExportPayload(nodes, edges, extra);
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
