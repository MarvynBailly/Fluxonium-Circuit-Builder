/**
 * Group wire vertices into electrical nodes and turn components into
 * edges.
 *
 * Rules:
 *   - Two vertices share an electrical node iff connected by a path of
 *     wire edges.
 *   - A vertex with no incident wire edges is *terminal-only* — it's
 *     just a component terminal until the user wires something to it,
 *     so it does not appear in the node list and components attached
 *     only to terminal-only vertices contribute no detected edge.
 */

import { DEFAULT_NODE_COLOR } from './constants.js';

/**
 * @param {{vertices, wires, components}} wire
 * @param {{nodes, edges}} [previous] prior auto-detect output;
 *   when supplied, labels and isGround are preserved for nodes whose
 *   identity (smallest-vertex anchor) is unchanged.
 * @returns {{ nodes, edges }}
 */
export function autoDetectNodes(wire, previous = null) {
  const { vertices, wires, components } = wire;
  const grounds = wire.grounds ?? [];
  // Vertices that the user has explicitly grounded — every electrical
  // node containing one of these is treated as static (φ̇ = 0).
  const groundedVertices = new Set(grounds.map((g) => g.vertexId));

  // Track which vertices are incident to at least one wire — these
  // are the "wired" vertices that become φ nodes. The rest are
  // terminal-only (component-only) and skipped.
  const wired = new Set();
  for (const w of wires) {
    wired.add(w.from);
    wired.add(w.to);
  }

  // Union-find over wired vertices via wire edges.
  const parent = new Map();
  vertices.forEach((v) => {
    if (wired.has(v.id)) parent.set(v.id, v.id);
  });
  const find = (id) => {
    let r = id;
    while (parent.get(r) !== r) r = parent.get(r);
    let cur = id;
    while (parent.get(cur) !== cur) {
      const nx = parent.get(cur);
      parent.set(cur, r);
      cur = nx;
    }
    return r;
  };
  const union = (a, b) => {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent.set(ra, rb);
  };
  for (const w of wires) union(w.from, w.to);

  // Carry-forward map: anchor vertex id → previous node entry. The
  // anchor is the smallest vertex id in the node — robust to the user
  // adding/removing other vertices in the same node.
  const prevByAnchor = new Map();
  if (previous && previous.nodes) {
    for (const pn of previous.nodes) {
      if (pn.vertexIds && pn.vertexIds.length) {
        const anchor = Math.min(...pn.vertexIds);
        prevByAnchor.set(anchor, pn);
      }
    }
  }

  // Build node skeletons.
  const usedLabels = new Set();
  const groups = new Map();
  for (const v of vertices) {
    if (!wired.has(v.id)) continue;
    const r = find(v.id);
    if (!groups.has(r)) groups.set(r, []);
    groups.get(r).push(v);
  }

  const nodes = [];
  const vertexNode = new Map();
  let nodeId = 0;
  const roots = [...groups.keys()].sort((a, b) => a - b);
  for (const r of roots) {
    const vs = groups.get(r);
    const cx = vs.reduce((acc, v) => acc + v.x, 0) / vs.length;
    const cy = vs.reduce((acc, v) => acc + v.y, 0) / vs.length;
    const vertexIds = vs.map((v) => v.id).sort((a, b) => a - b);
    const anchor = vertexIds[0];
    const carry = prevByAnchor.get(anchor);
    let label = null;
    let userLabel = false;
    if (carry?.userLabel && carry.label) {
      label = carry.label;
      userLabel = true;
      usedLabels.add(label);
    }
    const color = carry?.userColor ? carry.color : DEFAULT_NODE_COLOR;
    const isGround = vertexIds.some((vid) => groundedVertices.has(vid));
    nodes.push({
      id: nodeId,
      x: cx,
      y: cy,
      label,
      userLabel,
      color,
      userColor: !!carry?.userColor,
      isGround,
      vertexIds,
    });
    for (const vid of vertexIds) vertexNode.set(vid, nodeId);
    nodeId++;
  }

  // Component edges — only emitted when both endpoints land on
  // detected nodes. Components with a terminal-only endpoint are
  // floating and skipped.
  const edges = [];
  let edgeCounter = 0;
  for (const c of components) {
    const fromNode = vertexNode.get(c.from);
    const toNode = vertexNode.get(c.to);
    if (fromNode === undefined || toNode === undefined) continue;
    edges.push({
      id: `e${edgeCounter++}`,
      from: fromNode,
      to: toNode,
      type: c.type,
      value: c.value,
      sourceComponentId: c.id,
    });
  }

  // Auto-assign \phi_{k} labels to nodes without a user-set label.
  let autoIdx = 0;
  for (const n of nodes) {
    if (n.label) continue;
    while (usedLabels.has(`\\phi_{${autoIdx}}`)) autoIdx++;
    n.label = `\\phi_{${autoIdx}}`;
    usedLabels.add(n.label);
    autoIdx++;
  }

  return { nodes, edges };
}
