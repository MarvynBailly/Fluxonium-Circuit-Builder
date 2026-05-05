/**
 * Serialize circuit topology to a downloadable JSON file.
 *
 * Wire-mode exports preserve the full geometry (vertex positions,
 * wire-edge topology, component-edge endpoints) plus any user-set
 * node labels / grounds, so re-importing produces an identical-looking
 * diagram. Schematic-mode exports preserve node positions directly.
 */

import { adjacencyMatrix, capacitanceMatrix, formatSymbolicSum } from '../physics/hamiltonian.js';
import { COMPONENT_LENGTH, DEFAULT_GROUND_OFFSET } from '../wire/index.js';

/**
 * @param {Array} nodes - analysis-level nodes (electrical nodes)
 * @param {Array} edges - analysis-level edges
 * @param {Object} [extra]
 * @param {Object} [extra.wire]            - full wire model (wire mode)
 * @param {Array}  [extra.wireNodes]       - electrical-node array for label/ground carry
 * @param {Array}  [extra.schematicNodes]  - schematic nodes with x/y (schematic mode)
 * @param {Object} [extra.view]            - canvas view state (theme, edge-label toggle,
 *                                           pan, zoom) so a re-import reproduces the
 *                                           sender's framing and display options
 */
export function buildExportPayload(nodes, edges, extra = {}) {
  const adj = adjacencyMatrix(nodes, edges);
  const cap = capacitanceMatrix(nodes, edges);
  const capacitance = cap.cells.map((row) => row.map((cell) => formatSymbolicSum(cell)));

  const payload = {
    _meta: {
      generator: 'quantum-circuit-builder',
      version: '0.4.0',
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
      wires: extra.wire.wires.map((w) => ({ id: w.id, from: w.from, to: w.to })),
      components: extra.wire.components.map((c) => ({
        id: c.id,
        from: c.from,
        to: c.to,
        type: c.type,
        value: c.value,
        ...(c.userColor ? { color: c.color } : {}),
      })),
      grounds: (extra.wire.grounds ?? []).map((g) => ({
        id: g.id,
        vertex: g.vertexId,
        dx: g.dx ?? 0,
        dy: g.dy ?? 0,
      })),
      next_vertex_id: extra.wire.nextVertexId,
      next_wire_id: extra.wire.nextWireId,
      next_component_id: extra.wire.nextComponentId,
      next_ground_id: extra.wire.nextGroundId,
    };

    if (extra.wireNodes) {
      payload.node_overrides = extra.wireNodes
        .filter((n) => n.userLabel || n.userColor || n.isGround)
        .map((n) => {
          const anchor =
            n.vertexIds && n.vertexIds.length ? Math.min(...n.vertexIds) : null;
          return {
            anchor,
            label: n.userLabel ? n.label : undefined,
            color: n.userColor ? n.color : undefined,
            is_ground: n.isGround || undefined,
          };
        });
    }
  }

  if (extra.view) {
    const v = extra.view;
    payload.view = {
      theme: v.theme,
      show_edge_labels: v.showEdgeLabels,
      pan: v.pan ? { x: v.pan.x, y: v.pan.y } : undefined,
      zoom: v.zoom,
    };
  }

  return payload;
}

/**
 * Convert an old-format wire_geometry (segments + components-as-overlays)
 * into the new edge-based shape (wires + components-as-edges with their
 * own endpoint vertices). Components on a segment are converted left-to-
 * right into alternating wire / component edges.
 */
function convertOldWireGeometry(g) {
  const vertices = g.vertices.map((v) => ({ id: v.id, x: v.x, y: v.y }));
  let nextVertexId =
    g.next_vertex_id ??
    (vertices.length ? Math.max(...vertices.map((v) => v.id)) + 1 : 0);

  const newWires = [];
  const newComponents = [];
  let nextWireId = 0;
  let nextComponentId =
    g.next_component_id ??
    (g.components && g.components.length
      ? Math.max(
          ...g.components.map((c) => parseInt(String(c.id).slice(1), 10) || 0),
        ) + 1
      : 0);

  // Group old components by segment_id, sorted by t.
  const compsBySeg = new Map();
  for (const c of g.components || []) {
    if (!compsBySeg.has(c.segment_id)) compsBySeg.set(c.segment_id, []);
    compsBySeg.get(c.segment_id).push(c);
  }
  for (const list of compsBySeg.values()) list.sort((a, b) => a.t - b.t);

  const vById = new Map(vertices.map((v) => [v.id, v]));

  for (const seg of g.segments || []) {
    const a = vById.get(seg.from);
    const b = vById.get(seg.to);
    if (!a || !b) continue;
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const L = Math.hypot(dx, dy);
    const comps = compsBySeg.get(seg.id) || [];

    if (comps.length === 0) {
      newWires.push({ id: `w${nextWireId++}`, from: seg.from, to: seg.to });
      continue;
    }

    const halfT = L > 1e-6 ? Math.min(COMPONENT_LENGTH, L * 0.9) / 2 / L : 0.05;
    let leftVid = seg.from;
    let leftT = 0;
    for (let i = 0; i < comps.length; i++) {
      const c = comps[i];
      // Clip component bounds to not overlap neighbors.
      const minT = leftT + 1e-6;
      const maxT =
        i + 1 < comps.length ? (c.t + comps[i + 1].t) / 2 : 1;
      let t1 = Math.max(minT, c.t - halfT);
      let t2 = Math.min(maxT, c.t + halfT);
      if (t1 < 1e-3) t1 = 0;
      if (t2 > 1 - 1e-3) t2 = 1;

      let p1Id;
      if (t1 === 0) {
        p1Id = seg.from;
      } else {
        p1Id = nextVertexId++;
        vertices.push({ id: p1Id, x: a.x + t1 * dx, y: a.y + t1 * dy });
      }
      let p2Id;
      if (t2 === 1) {
        p2Id = seg.to;
      } else {
        p2Id = nextVertexId++;
        vertices.push({ id: p2Id, x: a.x + t2 * dx, y: a.y + t2 * dy });
      }

      // Wire piece from previous left endpoint to p1 (if non-trivial).
      if (leftVid !== p1Id) {
        newWires.push({ id: `w${nextWireId++}`, from: leftVid, to: p1Id });
      }
      newComponents.push({
        id: c.id || `c${nextComponentId++}`,
        from: p1Id,
        to: p2Id,
        type: c.type,
        value: c.value,
      });
      leftVid = p2Id;
      leftT = t2;
    }
    if (leftVid !== seg.to) {
      newWires.push({ id: `w${nextWireId++}`, from: leftVid, to: seg.to });
    }
  }

  return {
    vertices,
    wires: newWires,
    components: newComponents,
    grounds: [],
    nextVertexId,
    nextWireId,
    nextComponentId,
    nextGroundId: 0,
  };
}

function parseView(payload) {
  if (!payload?.view) return null;
  const v = payload.view;
  return {
    theme: v.theme,
    showEdgeLabels: v.show_edge_labels,
    pan: v.pan ? { x: v.pan.x, y: v.pan.y } : null,
    zoom: typeof v.zoom === 'number' ? v.zoom : null,
  };
}

/**
 * Reverse of buildExportPayload. Returns one of:
 *   { kind: 'wire', wire, nodeOverrides, view }
 *   { kind: 'schematic', nodes, edges, nextNodeId, nextEdgeId, view }
 *
 * `view` is the optional canvas view block (theme, edge-label toggle,
 * pan, zoom) — null when the payload doesn't carry one. Detects and
 * converts the old overlay-based wire format (segments +
 * components-with-segment_id) on the fly.
 */
export function parseImportPayload(payload) {
  const view = parseView(payload);
  if (payload?.wire_geometry) {
    const g = payload.wire_geometry;
    const isOldFormat =
      Array.isArray(g.segments) ||
      (g.components && g.components.some((c) => c.segment_id !== undefined));

    let wire;
    if (isOldFormat) {
      wire = convertOldWireGeometry(g);
    } else {
      const importedGrounds = (g.grounds || []).map((gr, i) => ({
        id: gr.id ?? `g${i}`,
        vertexId: gr.vertex ?? gr.vertexId,
        // Old exports predate the offset — fall back to the default
        // (south, one grid cell) so they render sensibly.
        dx: gr.dx ?? DEFAULT_GROUND_OFFSET.dx,
        dy: gr.dy ?? DEFAULT_GROUND_OFFSET.dy,
      }));
      wire = {
        vertices: g.vertices.map((v) => ({ id: v.id, x: v.x, y: v.y })),
        wires: (g.wires || []).map((w) => ({ id: w.id, from: w.from, to: w.to })),
        components: (g.components || []).map((c) => ({
          id: c.id,
          from: c.from,
          to: c.to,
          type: c.type,
          value: c.value,
          ...(c.color !== undefined ? { color: c.color, userColor: true } : {}),
        })),
        grounds: importedGrounds,
        nextVertexId:
          g.next_vertex_id ??
          (g.vertices.length ? Math.max(...g.vertices.map((v) => v.id)) + 1 : 0),
        nextWireId:
          g.next_wire_id ??
          (g.wires && g.wires.length
            ? Math.max(
                ...g.wires.map((w) => parseInt(String(w.id).slice(1), 10) || 0),
              ) + 1
            : 0),
        nextComponentId:
          g.next_component_id ??
          (g.components && g.components.length
            ? Math.max(
                ...g.components.map((c) => parseInt(String(c.id).slice(1), 10) || 0),
              ) + 1
            : 0),
        nextGroundId:
          g.next_ground_id ??
          (importedGrounds.length
            ? Math.max(
                ...importedGrounds.map((gr) => parseInt(String(gr.id).slice(1), 10) || 0),
              ) + 1
            : 0),
      };
    }

    // Backwards-compat: pre-grounds[] exports stored ground state on
    // per-node overrides. If the new array is missing, translate any
    // legacy is_ground flag into a ground on the override's anchor
    // vertex so old files don't lose their groundings.
    const overrides = (payload.node_overrides || []).filter((o) => o.anchor != null);
    if ((wire.grounds?.length ?? 0) === 0) {
      const legacy = overrides.filter((o) => o.is_ground && o.anchor != null);
      if (legacy.length > 0) {
        let next = wire.nextGroundId ?? 0;
        wire = {
          ...wire,
          grounds: legacy.map((o) => ({
            id: `g${next++}`,
            vertexId: o.anchor,
            dx: DEFAULT_GROUND_OFFSET.dx,
            dy: DEFAULT_GROUND_OFFSET.dy,
          })),
          nextGroundId: next,
        };
      }
    }

    return {
      kind: 'wire',
      wire,
      nodeOverrides: overrides,
      view,
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
    view,
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
