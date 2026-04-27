/**
 * Wire-mode data model.
 *
 *   vertices   — wire turning-points (NOT electrical nodes)
 *   segments   — straight pure-wire connections between two vertices.
 *                Always type 'wire'. Removing a component does not
 *                affect any segment.
 *   components — { id, segmentId, t, type, value }. A component is an
 *                overlay drawn at parameter t∈[0,1] along its segment;
 *                it electrically breaks the wire while leaving the
 *                segment intact in the data model.
 *
 * autoDetectNodes() collapses purely-wire-connected vertices into single
 * electrical nodes via union-find (only wire segments WITHOUT components
 * count as wires for this purpose); each component becomes an edge
 * between the electrical nodes of its segment's two vertex endpoints.
 *
 * For now, at most one component per segment — adding a second to the
 * same segment replaces the first.
 */

import { ELEMENT_TYPES } from '../circuit/elementTypes.js';

export const SNAP_RADIUS = 14;
export const GRID = 30;
export const COMPONENT_LENGTH = 60;

/** Default color palette for auto-detected electrical nodes. */
export const NODE_PALETTE = [
  '#60a5fa',
  '#34d399',
  '#fbbf24',
  '#f472b6',
  '#a78bfa',
  '#fb923c',
  '#22d3ee',
  '#f87171',
];

/** Default color for newly detected electrical nodes. The user can
 *  override per-node from the labels panel. */
export const DEFAULT_NODE_COLOR = '#e6ebf2';

/** Fractions along a segment that components magnetically snap to. */
export const FRACTIONS = [
  { t: 1 / 4, label: '1/4' },
  { t: 1 / 3, label: '1/3' },
  { t: 1 / 2, label: '1/2' },
  { t: 2 / 3, label: '2/3' },
  { t: 3 / 4, label: '3/4' },
];

export const EMPTY_WIRE = {
  vertices: [],
  segments: [],
  components: [],
  nextVertexId: 0,
  nextSegmentId: 0,
  nextComponentId: 0,
};

export function snapToGrid(x, y, grid = GRID) {
  return { x: Math.round(x / grid) * grid, y: Math.round(y / grid) * grid };
}

/**
 * Snap a component's parameter t so one of its terminals coincides
 * with the segment's endpoint vertex, when t is within `tolPx` pixels
 * of that aligned position. Mirrors the half-length clamp used at
 * render time so the visible terminal lands exactly on the vertex.
 */
export function snapComponentEnd(t, segLength, tolPx = 14) {
  if (segLength < 1e-6) return t;
  const half = Math.min(COMPONENT_LENGTH, segLength * 0.9) / 2;
  const tA = half / segLength;
  const tB = 1 - half / segLength;
  const tol = tolPx / segLength;
  const dA = Math.abs(t - tA);
  const dB = Math.abs(t - tB);
  if (dA < tol && dA <= dB) return tA;
  if (dB < tol) return tB;
  return t;
}

export function snapFraction(t, tol = 0.06) {
  let best = null;
  for (const f of FRACTIONS) {
    const d = Math.abs(t - f.t);
    if (d < tol && (best === null || d < best.d)) best = { ...f, d };
  }
  return best ? { t: best.t, label: best.label } : { t, label: null };
}

export function snapToVertex(vertices, x, y, radius = SNAP_RADIUS) {
  let bestId = null;
  let bestD = radius;
  for (const v of vertices) {
    const d = Math.hypot(v.x - x, v.y - y);
    if (d < bestD) {
      bestD = d;
      bestId = v.id;
    }
  }
  return bestId;
}

export function snapToSegment(vertices, segments, x, y, radius = SNAP_RADIUS) {
  const byId = new Map(vertices.map((v) => [v.id, v]));
  let best = null;
  for (const s of segments) {
    const a = byId.get(s.from);
    const b = byId.get(s.to);
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
    if (best === null || d < best.d) {
      best = { id: s.id, t, d };
    }
  }
  if (!best || best.d > radius) return null;
  return best;
}

/**
 * Find the component whose rendered footprint (centered on its segment
 * at parameter t, length COMPONENT_LENGTH) is nearest to (x,y) — used
 * for hit-testing existing components for selection.
 */
export function snapToComponent(wire, x, y, radius = SNAP_RADIUS) {
  const vById = new Map(wire.vertices.map((v) => [v.id, v]));
  const sById = new Map(wire.segments.map((s) => [s.id, s]));
  let best = null;
  for (const c of wire.components) {
    const seg = sById.get(c.segmentId);
    if (!seg) continue;
    const a = vById.get(seg.from);
    const b = vById.get(seg.to);
    if (!a || !b) continue;
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const L = Math.hypot(dx, dy);
    if (L < 1) continue;
    const cx = a.x + c.t * dx;
    const cy = a.y + c.t * dy;
    const d = Math.hypot(x - cx, y - cy);
    if (d < COMPONENT_LENGTH / 2 + 4 && (best === null || d < best.d)) {
      best = { id: c.id, d };
    }
  }
  if (!best || best.d > Math.max(radius, COMPONENT_LENGTH / 2)) return null;
  return best;
}

export function addVertex(wire, x, y) {
  const id = wire.nextVertexId;
  return {
    wire: {
      ...wire,
      vertices: [...wire.vertices, { id, x, y }],
      nextVertexId: id + 1,
    },
    vertexId: id,
  };
}

export function addSegment(wire, fromId, toId) {
  if (fromId === toId) return wire;
  const dup = wire.segments.find(
    (s) => (s.from === fromId && s.to === toId) || (s.from === toId && s.to === fromId),
  );
  if (dup) return wire;
  const id = `s${wire.nextSegmentId}`;
  return {
    ...wire,
    segments: [...wire.segments, { id, from: fromId, to: toId }],
    nextSegmentId: wire.nextSegmentId + 1,
  };
}

export function deleteSegment(wire, segmentId) {
  return {
    ...wire,
    segments: wire.segments.filter((s) => s.id !== segmentId),
    components: wire.components.filter((c) => c.segmentId !== segmentId),
  };
}

/**
 * Delete a wire vertex without nuking its surroundings.
 *   degree 0: just remove.
 *   degree 1: remove vertex and its dangling segment, but only if that
 *             segment carries no component (otherwise we'd silently
 *             lose the component — refuse instead).
 *   degree 2: merge the two incident segments into one straight segment
 *             between the other endpoints; rescale t for any components
 *             on either side using physical distances so positions stay
 *             roughly where they were.
 *   degree >2 or any merge that would create a self-loop / duplicate
 *             segment: refuse (return the wire unchanged) to avoid
 *             surprising data loss.
 */
export function deleteVertex(wire, vertexId) {
  const incident = wire.segments.filter(
    (s) => s.from === vertexId || s.to === vertexId,
  );

  if (incident.length === 0) {
    return { ...wire, vertices: wire.vertices.filter((v) => v.id !== vertexId) };
  }

  if (incident.length === 1) {
    const s = incident[0];
    if (wire.components.some((c) => c.segmentId === s.id)) return wire;
    return {
      ...wire,
      vertices: wire.vertices.filter((v) => v.id !== vertexId),
      segments: wire.segments.filter((seg) => seg.id !== s.id),
    };
  }

  if (incident.length === 2) {
    const [s1, s2] = incident;
    const s1HasComp = wire.components.some((c) => c.segmentId === s1.id);
    const s2HasComp = wire.components.some((c) => c.segmentId === s2.id);
    // If both sides carry components, the vertex is the junction between
    // them — merging would visually slam the components together onto a
    // single straight segment. Keep the bend.
    if (s1HasComp && s2HasComp) return wire;
    const A = s1.from === vertexId ? s1.to : s1.from;
    const B = s2.from === vertexId ? s2.to : s2.from;
    if (A === B) return wire;
    const dup = wire.segments.find(
      (s) =>
        s.id !== s1.id &&
        s.id !== s2.id &&
        ((s.from === A && s.to === B) || (s.from === B && s.to === A)),
    );
    if (dup) return wire;

    const vById = new Map(wire.vertices.map((v) => [v.id, v]));
    const va = vById.get(A);
    const vv = vById.get(vertexId);
    const vb = vById.get(B);
    if (!va || !vv || !vb) return wire;
    const lenA = Math.hypot(va.x - vv.x, va.y - vv.y);
    const lenB = Math.hypot(vb.x - vv.x, vb.y - vv.y);
    const total = lenA + lenB;
    if (total < 1e-9) return wire;
    const mid = lenA / total;

    const newSegId = `s${wire.nextSegmentId}`;
    const newSeg = { id: newSegId, from: A, to: B };
    const newLen = Math.hypot(va.x - vb.x, va.y - vb.y);

    // s1 connects A and v. v sits at t=mid on the merged segment (A→B);
    // A is at t=0. So a component at param t on s1 is at fractional
    // distance from-v = (s1.from === v ? t : 1-t), and its merged-t is
    // mid - mid * (distance-from-v / lenA scaled), i.e. it lies in [0, mid].
    const remap = (c) => {
      if (c.segmentId === s1.id) {
        const distFromVOverLenA = s1.from === vertexId ? c.t : 1 - c.t;
        const tNew = mid * (1 - distFromVOverLenA);
        return { ...c, segmentId: newSegId, t: snapComponentEnd(tNew, newLen) };
      }
      if (c.segmentId === s2.id) {
        const distFromVOverLenB = s2.from === vertexId ? c.t : 1 - c.t;
        const tNew = mid + (1 - mid) * distFromVOverLenB;
        return { ...c, segmentId: newSegId, t: snapComponentEnd(tNew, newLen) };
      }
      return c;
    };

    return {
      ...wire,
      vertices: wire.vertices.filter((v) => v.id !== vertexId),
      segments: wire.segments
        .filter((s) => s.id !== s1.id && s.id !== s2.id)
        .concat([newSeg]),
      components: wire.components.map(remap),
      nextSegmentId: wire.nextSegmentId + 1,
    };
  }

  // Higher degrees: allow deletion only if no incident segment carries
  // a component — otherwise we'd silently lose data. With pure-wire
  // incidents, just remove the vertex and its segments; the rest of
  // the graph is untouched.
  const incidentIds = new Set(incident.map((s) => s.id));
  const incidentHasComp = wire.components.some((c) => incidentIds.has(c.segmentId));
  if (incidentHasComp) return wire;
  return {
    ...wire,
    vertices: wire.vertices.filter((v) => v.id !== vertexId),
    segments: wire.segments.filter((s) => !incidentIds.has(s.id)),
  };
}

/**
 * Insert a vertex at parameter t along the segment. The original
 * segment is replaced by two halves; any components on it are
 * reassigned to whichever half contains them, with t rescaled.
 * Returns { wire, vertexId }.
 */
export function splitSegmentAt(wire, segmentId, t) {
  const seg = wire.segments.find((s) => s.id === segmentId);
  if (!seg) return { wire, vertexId: null, halfAId: null, halfBId: null };
  const a = wire.vertices.find((v) => v.id === seg.from);
  const b = wire.vertices.find((v) => v.id === seg.to);
  if (!a || !b) return { wire, vertexId: null, halfAId: null, halfBId: null };
  const x = a.x + t * (b.x - a.x);
  const y = a.y + t * (b.y - a.y);
  const vid = wire.nextVertexId;
  const halfAId = `s${wire.nextSegmentId}`;
  const halfBId = `s${wire.nextSegmentId + 1}`;
  const halfA = { id: halfAId, from: seg.from, to: vid };
  const halfB = { id: halfBId, from: vid, to: seg.to };

  const newComponents = wire.components.map((c) => {
    if (c.segmentId !== segmentId) return c;
    if (c.t <= t) {
      return { ...c, segmentId: halfAId, t: t > 0 ? c.t / t : 0 };
    }
    return { ...c, segmentId: halfBId, t: t < 1 ? (c.t - t) / (1 - t) : 1 };
  });

  return {
    wire: {
      ...wire,
      vertices: [...wire.vertices, { id: vid, x, y }],
      segments: wire.segments.filter((s) => s.id !== segmentId).concat([halfA, halfB]),
      components: newComponents,
      nextVertexId: vid + 1,
      nextSegmentId: wire.nextSegmentId + 2,
    },
    vertexId: vid,
    halfAId,
    halfBId,
  };
}

/** Sorted components on a segment. */
export function componentsOnSegment(wire, segmentId) {
  return wire.components.filter((c) => c.segmentId === segmentId).sort((a, b) => a.t - b.t);
}

/** Which slot (0..N) of a segment with N sorted components a parameter t falls into. */
export function slotIndexForT(comps, t) {
  let i = 0;
  while (i < comps.length && t > comps[i].t) i++;
  return i;
}

/**
 * Delete just one wire piece between adjacent components on a segment
 * (or between a component and an endpoint), without touching the
 * components or the rest of the wire. The segment is split as needed
 * so that the slot becomes its own segment, then that segment is
 * removed. Components on the segment are preserved.
 */
export function deleteSegmentSlot(wire, segmentId, slotIndex) {
  const comps = componentsOnSegment(wire, segmentId);
  const N = comps.length;
  if (N === 0) return deleteSegment(wire, segmentId);

  let w = wire;
  let segId = segmentId;

  // Eps in original-segment t-space; small enough to not cross components,
  // large enough to land safely on the wire side of a component.
  const EPS = 1e-6;

  // Trim off everything to the right of slot first (so subsequent left-trim
  // indices don't shift). Skip if slot is the rightmost (no comp to its right).
  if (slotIndex < N) {
    const cutT = comps[slotIndex].t - EPS;
    const r = splitSegmentAt(w, segId, cutT);
    // halfA: contains the slot we want and everything before it.
    // halfB: starts with comps[slotIndex] and everything after — keep it.
    w = r.wire;
    segId = r.halfAId;
  }

  // Now segId is a segment whose rightmost piece is the slot to delete.
  if (slotIndex > 0) {
    const cs = componentsOnSegment(w, segId);
    if (cs.length === 0) {
      // No component on the left side either — fall through and delete whole.
    } else {
      const cutT = cs[cs.length - 1].t + EPS;
      if (cutT < 1) {
        const r = splitSegmentAt(w, segId, cutT);
        // halfA: everything up to and including the last component — keep.
        // halfB: the wire-only slot we want to delete.
        w = r.wire;
        segId = r.halfBId;
      }
    }
  }

  return deleteSegment(w, segId);
}

/** Generate a symbolic name like "C_{0}", "L_{1}", "E_J^{2}" that is
 *  not yet in use among existing components of any type. */
export function nextComponentSymbol(components, type) {
  const sym = ELEMENT_TYPES[type].symbol; // 'C' | 'L' | 'E_J'
  const used = new Set(components.map((c) => c.value));
  let k = 0;
  let candidate;
  do {
    candidate = type === 'JJ' ? `E_J^{${k}}` : `${sym}_{${k}}`;
    k++;
  } while (used.has(candidate));
  return candidate;
}

/**
 * Place a component on the given wire segment at parameter t. The
 * segment itself is unchanged — components are an overlay. Multiple
 * components on the same segment are allowed; auto-detect treats them
 * as in series, with phantom electrical nodes between adjacent ones.
 *
 * The component's `value` is a symbolic name (string), e.g. "C_{0}".
 */
export function placeComponentOnSegment(wire, segmentId, t, type) {
  const seg = wire.segments.find((s) => s.id === segmentId);
  if (!seg) return wire;
  const id = `c${wire.nextComponentId}`;
  const value = nextComponentSymbol(wire.components, type);
  return {
    ...wire,
    components: [...wire.components, { id, segmentId, t, type, value }],
    nextComponentId: wire.nextComponentId + 1,
  };
}

export function removeComponent(wire, componentId) {
  return { ...wire, components: wire.components.filter((c) => c.id !== componentId) };
}

export function setComponentType(wire, componentId, type) {
  return {
    ...wire,
    components: wire.components.map((c) =>
      c.id === componentId
        ? {
            ...c,
            type,
            value: ELEMENT_TYPES[type].defaultValue,
            ...(c.userColor ? {} : { color: undefined }),
          }
        : c,
    ),
  };
}

export function setComponentValue(wire, componentId, value) {
  return {
    ...wire,
    components: wire.components.map((c) => (c.id === componentId ? { ...c, value } : c)),
  };
}

export function setComponentPlacement(wire, componentId, segmentId, t) {
  const tClamped = Math.max(0, Math.min(1, t));
  return {
    ...wire,
    components: wire.components.map((c) =>
      c.id === componentId ? { ...c, segmentId, t: tClamped } : c,
    ),
  };
}

/**
 * Predicate: would `mergeVertices(wire, fromId, intoId)` be safe?
 *   - Both vertices must have at most one incident segment (degree ≤ 1).
 *   - No segment dropped by the merge (self-loops, duplicates) may
 *     carry a component — that would silently destroy data.
 */
export function canMergeVertices(wire, fromId, intoId) {
  if (fromId === intoId) return false;
  let fromDeg = 0;
  let intoDeg = 0;
  for (const s of wire.segments) {
    if (s.from === fromId || s.to === fromId) fromDeg++;
    if (s.from === intoId || s.to === intoId) intoDeg++;
  }
  if (fromDeg > 1 || intoDeg > 1) return false;

  const rewritten = wire.segments.map((s) => ({
    ...s,
    from: s.from === fromId ? intoId : s.from,
    to: s.to === fromId ? intoId : s.to,
  }));
  const dropped = new Set();
  const seenPairs = new Map();
  for (const s of rewritten) {
    if (s.from === s.to) {
      dropped.add(s.id);
      continue;
    }
    const lo = s.from < s.to ? s.from : s.to;
    const hi = s.from < s.to ? s.to : s.from;
    const key = `${lo}-${hi}`;
    if (seenPairs.has(key)) dropped.add(s.id);
    else seenPairs.set(key, s.id);
  }
  return !wire.components.some((c) => dropped.has(c.segmentId));
}

/**
 * Merge `fromId` into `intoId`: every segment that referenced `fromId`
 * now references `intoId`. Self-loops created by the merge are dropped
 * (along with any component sitting on them); duplicate parallel
 * segments are de-duplicated, keeping the first occurrence and any
 * components on it. The `fromId` vertex is removed.
 */
export function mergeVertices(wire, fromId, intoId) {
  if (fromId === intoId) return wire;
  const rewritten = wire.segments.map((s) => ({
    ...s,
    from: s.from === fromId ? intoId : s.from,
    to: s.to === fromId ? intoId : s.to,
  }));
  const droppedSegIds = new Set();
  const seenPairs = new Map();
  const uniqueSegs = [];
  for (const s of rewritten) {
    if (s.from === s.to) {
      droppedSegIds.add(s.id);
      continue;
    }
    const lo = s.from < s.to ? s.from : s.to;
    const hi = s.from < s.to ? s.to : s.from;
    const key = `${lo}-${hi}`;
    if (seenPairs.has(key)) {
      droppedSegIds.add(s.id);
    } else {
      seenPairs.set(key, s.id);
      uniqueSegs.push(s);
    }
  }
  const components = wire.components.filter((c) => !droppedSegIds.has(c.segmentId));
  return {
    ...wire,
    vertices: wire.vertices.filter((v) => v.id !== fromId),
    segments: uniqueSegs,
    components,
  };
}

/**
 * Place a stand-alone component centered at (x, y), oriented horizontally.
 * Creates two free wire vertices at the component's terminals and a
 * dedicated wire segment between them. Returns the new wire plus the
 * component id (so callers can select it).
 */
export function placeStandaloneComponent(wire, x, y, type) {
  const half = COMPONENT_LENGTH / 2;
  const vAId = wire.nextVertexId;
  const vBId = wire.nextVertexId + 1;
  const segId = `s${wire.nextSegmentId}`;
  const compId = `c${wire.nextComponentId}`;
  const value = nextComponentSymbol(wire.components, type);
  return {
    wire: {
      ...wire,
      vertices: [
        ...wire.vertices,
        { id: vAId, x: x - half, y },
        { id: vBId, x: x + half, y },
      ],
      segments: [...wire.segments, { id: segId, from: vAId, to: vBId }],
      components: [
        ...wire.components,
        { id: compId, segmentId: segId, t: 0.5, type, value },
      ],
      nextVertexId: vBId + 1,
      nextSegmentId: wire.nextSegmentId + 1,
      nextComponentId: wire.nextComponentId + 1,
    },
    componentId: compId,
  };
}

export function setComponentColor(wire, componentId, color) {
  return {
    ...wire,
    components: wire.components.map((c) =>
      c.id === componentId ? { ...c, color, userColor: true } : c,
    ),
  };
}

/**
 * Group wire vertices into electrical nodes and turn components into
 * edges. Rules:
 *   - Two vertices share an electrical node iff connected by a path of
 *     segments that carry no components.
 *   - A segment with N components in series creates N+1 electrical
 *     nodes along its length: the from-vertex's node, the to-vertex's
 *     node, and N−1 *phantom* nodes between adjacent components on
 *     that segment.
 *
 * @param {{vertices, segments, components}} wire
 * @param {{nodes:any[], edges:any[]}} [previous]  prior auto-detect output;
 *   when supplied, labels and isGround are preserved for nodes whose
 *   identity (vertex set, or phantom key) is unchanged.
 * @returns {{ nodes, edges }}
 */
export function autoDetectNodes(wire, previous = null) {
  const { vertices, segments, components } = wire;

  // Group components by segment, sort by t.
  const compsBySegment = new Map();
  for (const c of components) {
    if (!compsBySegment.has(c.segmentId)) compsBySegment.set(c.segmentId, []);
    compsBySegment.get(c.segmentId).push(c);
  }
  for (const list of compsBySegment.values()) list.sort((a, b) => a.t - b.t);

  // Union-find over vertices, only via segments with no components.
  const parent = new Map();
  vertices.forEach((v) => parent.set(v.id, v.id));
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
  for (const s of segments) {
    if (!compsBySegment.has(s.id)) union(s.from, s.to);
  }

  // Carry-forward maps. Anchor-based vertex key (smallest vertex id in
  // the node) lets user customizations survive the user adding /
  // removing other vertices in the same node. Phantom nodes key by
  // component-id-pair.
  const prevByAnchor = new Map();
  const prevByPhantomKey = new Map();
  if (previous && previous.nodes) {
    for (const pn of previous.nodes) {
      if (pn.vertexIds && pn.vertexIds.length) {
        const anchor = Math.min(...pn.vertexIds);
        prevByAnchor.set(anchor, pn);
      } else if (pn.phantomKey) {
        prevByPhantomKey.set(pn.phantomKey, pn);
      }
    }
  }

  // First pass: build node skeletons, with `label` left null when
  // there is no user-set carry to keep — those get auto-assigned in
  // the final pass after we know which labels are taken.
  const usedLabels = new Set();
  const nodes = [];
  let nodeId = 0;

  const groups = new Map();
  for (const v of vertices) {
    const r = find(v.id);
    if (!groups.has(r)) groups.set(r, []);
    groups.get(r).push(v);
  }

  const rootToNodeId = new Map();
  const roots = [...groups.keys()].sort((a, b) => a - b);
  for (const r of roots) {
    const vs = groups.get(r);
    const cx = vs.reduce((a, v) => a + v.x, 0) / vs.length;
    const cy = vs.reduce((a, v) => a + v.y, 0) / vs.length;
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
    nodes.push({
      id: nodeId,
      x: cx,
      y: cy,
      label,
      userLabel,
      color,
      userColor: !!carry?.userColor,
      isGround: !!carry?.isGround,
      vertexIds,
    });
    rootToNodeId.set(r, nodeId);
    nodeId++;
  }

  const vertexNode = new Map();
  for (const n of nodes) {
    for (const vid of n.vertexIds) vertexNode.set(vid, n.id);
  }

  const segById = new Map(segments.map((s) => [s.id, s]));
  const vertById = new Map(vertices.map((v) => [v.id, v]));
  let edgeCounter = 0;
  const edges = [];

  for (const [segmentId, comps] of compsBySegment) {
    const seg = segById.get(segmentId);
    if (!seg) continue;
    const vA = vertexNode.get(seg.from);
    const vB = vertexNode.get(seg.to);
    if (vA === undefined || vB === undefined) continue;
    const a = vertById.get(seg.from);
    const b = vertById.get(seg.to);

    let leftNodeId = vA;
    for (let k = 0; k < comps.length; k++) {
      const c = comps[k];
      let rightNodeId;
      if (k === comps.length - 1) {
        rightNodeId = vB;
      } else {
        const phantomKey = `gap:${c.id}:${comps[k + 1].id}`;
        const carry = prevByPhantomKey.get(phantomKey);
        const tMid = (c.t + comps[k + 1].t) / 2;
        let label = null;
        let userLabel = false;
        if (carry?.userLabel && carry.label) {
          label = carry.label;
          userLabel = true;
          usedLabels.add(label);
        }
        const color = carry?.userColor ? carry.color : DEFAULT_NODE_COLOR;
        nodes.push({
          id: nodeId,
          x: a.x + tMid * (b.x - a.x),
          y: a.y + tMid * (b.y - a.y),
          label,
          userLabel,
          color,
          userColor: !!carry?.userColor,
          isGround: !!carry?.isGround,
          vertexIds: [],
          phantomKey,
        });
        rightNodeId = nodeId;
        nodeId++;
      }
      edges.push({
        id: `e${edgeCounter++}`,
        from: leftNodeId,
        to: rightNodeId,
        type: c.type,
        value: c.value,
        sourceComponentId: c.id,
      });
      leftNodeId = rightNodeId;
    }
  }

  // Final pass: assign auto labels to nodes without a user-set label,
  // skipping any \phi_{k} that's already in use.
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
