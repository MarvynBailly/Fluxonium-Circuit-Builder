/** Vertex operations: add, delete (orphan policy), merge, fold-into-wire. */

import { remapGroundsAfterMerge, removeGroundsForVertex } from './groundOps.js';
import { addWire } from './wireOps.js';

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

/**
 * Delete a vertex without refusing on degree.
 *   - Incident wire edges are removed (a wire that loses its endpoint
 *     serves no purpose; the components it linked become disconnected).
 *   - Incident component edges keep the component intact: the missing
 *     endpoint is replaced by a fresh orphan vertex at the deleted
 *     position so the component stays visible and editable.
 */
export function deleteVertex(wire, vertexId) {
  const dv = wire.vertices.find((v) => v.id === vertexId);
  if (!dv) return wire;

  const wires = wire.wires.filter(
    (w) => w.from !== vertexId && w.to !== vertexId,
  );

  const newVertices = wire.vertices.filter((v) => v.id !== vertexId);
  let nextId = wire.nextVertexId;
  const orphan = () => {
    const id = nextId++;
    newVertices.push({ id, x: dv.x, y: dv.y });
    return id;
  };
  const components = wire.components.map((c) => {
    const fromHit = c.from === vertexId;
    const toHit = c.to === vertexId;
    if (!fromHit && !toHit) return c;
    return {
      ...c,
      from: fromHit ? orphan() : c.from,
      to: toHit ? orphan() : c.to,
    };
  });

  const result = {
    ...wire,
    vertices: newVertices,
    wires,
    components,
    nextVertexId: nextId,
  };
  return removeGroundsForVertex(result, vertexId);
}

/**
 * Merge `fromId` into `intoId`: every edge that referenced `fromId`
 * now references `intoId`. Self-loops created by the merge are dropped
 * (along with any component sitting on them); duplicate parallel
 * wires are de-duplicated. The `fromId` vertex is removed.
 */
export function mergeVertices(wire, fromId, intoId) {
  if (fromId === intoId) return wire;

  const rewriteWires = wire.wires.map((w) => ({
    ...w,
    from: w.from === fromId ? intoId : w.from,
    to: w.to === fromId ? intoId : w.to,
  }));
  const seenWirePairs = new Map();
  const wires = [];
  for (const w of rewriteWires) {
    if (w.from === w.to) continue;
    const lo = w.from < w.to ? w.from : w.to;
    const hi = w.from < w.to ? w.to : w.from;
    const key = `${lo}-${hi}`;
    if (seenWirePairs.has(key)) continue;
    seenWirePairs.set(key, w.id);
    wires.push(w);
  }

  const components = wire.components
    .map((c) => ({
      ...c,
      from: c.from === fromId ? intoId : c.from,
      to: c.to === fromId ? intoId : c.to,
    }))
    .filter((c) => c.from !== c.to);

  const merged = {
    ...wire,
    vertices: wire.vertices.filter((v) => v.id !== fromId),
    wires,
    components,
  };
  return remapGroundsAfterMerge(merged, fromId, intoId);
}

/** Predicate: would `mergeVertices(wire, fromId, intoId)` lose data? */
export function canMergeVertices(wire, fromId, intoId) {
  if (fromId === intoId) return false;
  return true;
}

/** Count component edges incident to `vertexId`. */
function componentDegree(wire, vertexId) {
  let n = 0;
  for (const c of wire.components) {
    if (c.from === vertexId || c.to === vertexId) n++;
  }
  return n;
}

/**
 * Two vertices coincide and are about to be glued together. The system
 * enforces that no vertex hosts two component endpoints — there must
 * always be a wire (possibly zero-length) between adjacent components.
 * If a plain merge would violate that, link the two vertices with a
 * wire instead, so each component keeps its own endpoint vertex.
 */
export function gluCoincidentVertices(wire, fromId, intoId) {
  if (fromId === intoId) return wire;
  const totalComponents = componentDegree(wire, fromId) + componentDegree(wire, intoId);
  if (totalComponents >= 2) {
    return addWire(wire, fromId, intoId);
  }
  return mergeVertices(wire, fromId, intoId);
}

/**
 * Predicate: can `vertexId` be merged into the surrounding wire path?
 * True only for the simple "remove a corner" case — exactly two
 * incident wire edges, no incident components.
 */
export function canMergeVertexIntoWire(wire, vertexId) {
  let wireDeg = 0;
  let otherA = null;
  let otherB = null;
  for (const w of wire.wires) {
    if (w.from === vertexId) {
      wireDeg++;
      if (otherA === null) otherA = w.to;
      else otherB = w.to;
    } else if (w.to === vertexId) {
      wireDeg++;
      if (otherA === null) otherA = w.from;
      else otherB = w.from;
    }
  }
  if (wireDeg !== 2) return false;
  if (componentDegree(wire, vertexId) !== 0) return false;
  if (otherA === otherB) return false;
  return true;
}

/**
 * Merge a degree-2 wire vertex into a single wire between its two
 * neighbors, dropping the vertex. Caller should check
 * `canMergeVertexIntoWire` first; otherwise this is a no-op.
 */
export function mergeVertexIntoWire(wire, vertexId) {
  if (!canMergeVertexIntoWire(wire, vertexId)) return wire;
  const incident = wire.wires.filter(
    (w) => w.from === vertexId || w.to === vertexId,
  );
  const a = incident[0].from === vertexId ? incident[0].to : incident[0].from;
  const b = incident[1].from === vertexId ? incident[1].to : incident[1].from;
  const incidentIds = new Set(incident.map((w) => w.id));
  const newWireId = `w${wire.nextWireId}`;
  const merged = {
    ...wire,
    vertices: wire.vertices.filter((v) => v.id !== vertexId),
    wires: wire.wires
      .filter((w) => !incidentIds.has(w.id))
      .concat([{ id: newWireId, from: a, to: b }]),
    nextWireId: wire.nextWireId + 1,
  };
  // The folded vertex is gone — drop any ground that was attached to it.
  return removeGroundsForVertex(merged, vertexId);
}
