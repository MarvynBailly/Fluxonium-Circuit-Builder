/**
 * Selection clipboard ops — serialize / paste / rotate a subgraph
 * out of the wire model.
 *
 * A selection is an array of {kind, id} entries where kind is one of
 * 'wireVertex' | 'wire' | 'wireComponent'. When serializing, vertex
 * endpoints referenced by any selected wire or component are
 * automatically included in the snapshot, so the pasted subgraph is
 * always self-contained.
 */

import { nextComponentSymbol } from './componentOps.js';

/**
 * Compute the induced subgraph for a selection:
 *   - Vertices in the selection.
 *   - Endpoints of selected wires / components (auto-included).
 *   - Any wire / component whose both endpoints fall inside the
 *     resulting vertex set (auto-included), so picking a region
 *     by shift-clicking its vertices grabs the connections too.
 */
function vertexClosure(wire, selection) {
  const vSet = new Set();
  const wSet = new Set();
  const cSet = new Set();
  for (const item of selection) {
    if (item.kind === 'wireVertex') vSet.add(item.id);
    else if (item.kind === 'wire') wSet.add(item.id);
    else if (item.kind === 'wireComponent') cSet.add(item.id);
  }
  for (const w of wire.wires) {
    if (wSet.has(w.id)) {
      vSet.add(w.from);
      vSet.add(w.to);
    }
  }
  for (const c of wire.components) {
    if (cSet.has(c.id)) {
      vSet.add(c.from);
      vSet.add(c.to);
    }
  }
  for (const w of wire.wires) {
    if (!wSet.has(w.id) && vSet.has(w.from) && vSet.has(w.to)) wSet.add(w.id);
  }
  for (const c of wire.components) {
    if (!cSet.has(c.id) && vSet.has(c.from) && vSet.has(c.to)) cSet.add(c.id);
  }
  return { vSet, wSet, cSet };
}

/**
 * Snapshot the selection into a self-contained subgraph. Positions
 * are stored in the original coordinate space; the caller applies
 * translation at paste time.
 */
export function serializeSelection(wire, selection) {
  const { vSet, wSet, cSet } = vertexClosure(wire, selection);
  return {
    vertices: wire.vertices.filter((v) => vSet.has(v.id)).map((v) => ({ ...v })),
    wires: wire.wires.filter((w) => wSet.has(w.id)).map((w) => ({ ...w })),
    components: wire.components.filter((c) => cSet.has(c.id)).map((c) => ({ ...c })),
    grounds: (wire.grounds ?? [])
      .filter((g) => vSet.has(g.vertexId))
      .map((g) => ({ vertexId: g.vertexId, dx: g.dx ?? 0, dy: g.dy ?? 0 })),
  };
}

/**
 * Paste a clipboard snapshot into a wire model. All ids are
 * regenerated; component values get fresh symbolic names so they
 * don't collide with existing or other freshly-pasted ones; vertex
 * positions are translated by (dx, dy).
 *
 * Returns { wire, selection } — the updated wire and the new
 * selection array describing the pasted items.
 */
export function pasteSelection(wire, clip, dx, dy) {
  const vIdMap = new Map();
  let nextV = wire.nextVertexId;
  const newVertices = clip.vertices.map((v) => {
    const id = nextV++;
    vIdMap.set(v.id, id);
    return { id, x: v.x + dx, y: v.y + dy };
  });

  let nextW = wire.nextWireId;
  const newWires = clip.wires.map((w) => {
    const id = `w${nextW++}`;
    return { id, from: vIdMap.get(w.from), to: vIdMap.get(w.to) };
  });

  let nextC = wire.nextComponentId;
  // Track allocated symbols incrementally so two pasted components of
  // the same type don't both grab the same next free symbol.
  let allComps = wire.components.slice();
  const newComponents = clip.components.map((c) => {
    const id = `c${nextC++}`;
    const value = nextComponentSymbol(allComps, c.type);
    const built = {
      id,
      from: vIdMap.get(c.from),
      to: vIdMap.get(c.to),
      type: c.type,
      value,
      ...(c.userColor ? { color: c.color, userColor: true } : {}),
    };
    allComps.push(built);
    return built;
  });

  let nextG = wire.nextGroundId ?? 0;
  const newGrounds = (clip.grounds ?? []).map((g) => ({
    id: `g${nextG++}`,
    vertexId: vIdMap.get(g.vertexId),
    dx: g.dx ?? 0,
    dy: g.dy ?? 0,
  }));

  const selection = [
    ...newVertices.map((v) => ({ kind: 'wireVertex', id: v.id })),
    ...newWires.map((w) => ({ kind: 'wire', id: w.id })),
    ...newComponents.map((c) => ({ kind: 'wireComponent', id: c.id })),
  ];

  return {
    wire: {
      ...wire,
      vertices: [...wire.vertices, ...newVertices],
      wires: [...wire.wires, ...newWires],
      components: [...wire.components, ...newComponents],
      grounds: [...(wire.grounds ?? []), ...newGrounds],
      nextVertexId: nextV,
      nextWireId: nextW,
      nextComponentId: nextC,
      nextGroundId: nextG,
    },
    selection,
  };
}

/**
 * Mirror the vertices touched by the selection across an axis through
 * their centroid. `axis` is 'horizontal' (flip left-right) or
 * 'vertical' (flip top-bottom). Wires/components follow because they
 * reference the same vertex ids.
 */
export function mirrorSelection(wire, selection, axis = 'horizontal') {
  const { vSet } = vertexClosure(wire, selection);
  if (vSet.size === 0) return wire;
  const moving = wire.vertices.filter((v) => vSet.has(v.id));
  const cx = moving.reduce((a, v) => a + v.x, 0) / moving.length;
  const cy = moving.reduce((a, v) => a + v.y, 0) / moving.length;
  return {
    ...wire,
    vertices: wire.vertices.map((v) => {
      if (!vSet.has(v.id)) return v;
      return {
        ...v,
        x: axis === 'horizontal' ? 2 * cx - v.x : v.x,
        y: axis === 'vertical' ? 2 * cy - v.y : v.y,
      };
    }),
  };
}

/**
 * Rotate the vertices touched by the selection (directly or via
 * incident selected wires/components) around their centroid by
 * `angleRad`. Wires and components follow because they reference
 * the same vertex ids. Other vertices stay put.
 */
export function rotateSelection(wire, selection, angleRad) {
  const { vSet } = vertexClosure(wire, selection);
  if (vSet.size === 0) return wire;
  const moving = wire.vertices.filter((v) => vSet.has(v.id));
  const cx = moving.reduce((a, v) => a + v.x, 0) / moving.length;
  const cy = moving.reduce((a, v) => a + v.y, 0) / moving.length;
  const cos = Math.cos(angleRad);
  const sin = Math.sin(angleRad);
  return {
    ...wire,
    vertices: wire.vertices.map((v) => {
      if (!vSet.has(v.id)) return v;
      const dx = v.x - cx;
      const dy = v.y - cy;
      return {
        ...v,
        x: cx + dx * cos - dy * sin,
        y: cy + dx * sin + dy * cos,
      };
    }),
  };
}
