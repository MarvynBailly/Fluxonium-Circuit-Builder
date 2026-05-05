/**
 * Ground markers attached to wire vertices.
 *
 * A ground is a boundary condition (φ = const) on whichever electrical
 * node owns its vertex, not a two-terminal element. A node is grounded
 * iff any of its vertices appears in `wire.grounds`.
 *
 * Each entry also carries a (dx, dy) offset describing where the
 * ⏚ glyph hangs relative to the anchor vertex. Placement is two-click:
 * the first click sets the anchor (splitting a wire if needed); the
 * second click sets the offset, controlling which side of the wire the
 * glyph sits on and how far the stem extends.
 */

import { GRID, SNAP_RADIUS } from './constants.js';
import { snapToVertex, snapToWire } from './snap.js';
import { splitWireAt } from './wireOps.js';

/** Default offset when none is supplied (south, one grid cell). */
export const DEFAULT_GROUND_OFFSET = { dx: 0, dy: GRID };

const ensureGrounds = (wire) => ({
  ...wire,
  grounds: wire.grounds ?? [],
  nextGroundId: wire.nextGroundId ?? 0,
});

export function hasGround(wire, vertexId) {
  return (wire.grounds ?? []).some((g) => g.vertexId === vertexId);
}

export function addGround(wire, vertexId, dx = DEFAULT_GROUND_OFFSET.dx, dy = DEFAULT_GROUND_OFFSET.dy) {
  const w = ensureGrounds(wire);
  if (hasGround(w, vertexId)) return w;
  const id = `g${w.nextGroundId}`;
  return {
    ...w,
    grounds: [...w.grounds, { id, vertexId, dx, dy }],
    nextGroundId: w.nextGroundId + 1,
  };
}

export function removeGround(wire, groundId) {
  const w = ensureGrounds(wire);
  return { ...w, grounds: w.grounds.filter((g) => g.id !== groundId) };
}

export function removeGroundsForVertex(wire, vertexId) {
  const w = ensureGrounds(wire);
  return { ...w, grounds: w.grounds.filter((g) => g.vertexId !== vertexId) };
}

/**
 * First click of the two-click placement. Returns:
 *   { wire, vertexId, removed }
 *
 *   - vertexId: the anchor vertex to bind the ground to (or null if
 *     the click missed both a vertex and a wire — caller should ignore).
 *   - removed: true when the click landed on an already-grounded vertex,
 *     in which case the ground was toggled off and `wire` is the updated
 *     model. Caller should NOT enter placement mode.
 *   - wire: the (possibly mutated) wire model — a new vertex may have
 *     been created by splitting a wire under the cursor.
 */
export function beginGroundAt(wire, x, y) {
  const vid = snapToVertex(wire.vertices, x, y);
  if (vid !== null) {
    if (hasGround(wire, vid)) {
      return { wire: removeGroundsForVertex(wire, vid), vertexId: vid, removed: true };
    }
    return { wire, vertexId: vid, removed: false };
  }
  const hit = snapToWire(wire, x, y, SNAP_RADIUS);
  if (hit) {
    const r = splitWireAt(wire, hit.id, hit.t);
    return { wire: r.wire, vertexId: r.vertexId, removed: false };
  }
  return { wire, vertexId: null, removed: false };
}

/**
 * Snap a free (dx, dy) offset to the nearest cardinal direction with a
 * grid-multiple stem length (minimum one grid cell). Returns the
 * snapped offset. Pass `freeForm=true` to disable snapping.
 */
export function snapGroundOffset(dx, dy, freeForm = false) {
  if (freeForm) {
    if (dx === 0 && dy === 0) return { ...DEFAULT_GROUND_OFFSET };
    return { dx, dy };
  }
  const dist = Math.hypot(dx, dy);
  const cells = Math.max(1, Math.round(dist / GRID));
  const len = cells * GRID;
  if (dist === 0) return { ...DEFAULT_GROUND_OFFSET };
  if (Math.abs(dx) >= Math.abs(dy)) {
    return { dx: dx >= 0 ? len : -len, dy: 0 };
  }
  return { dx: 0, dy: dy >= 0 ? len : -len };
}

/**
 * Rewire the grounds array after a vertex merge: any ground attached
 * to `fromId` now points to `intoId`, and duplicate grounds on the
 * resulting vertex collapse to one.
 */
export function remapGroundsAfterMerge(wire, fromId, intoId) {
  const grounds = (wire.grounds ?? []).map((g) =>
    g.vertexId === fromId ? { ...g, vertexId: intoId } : g,
  );
  const seen = new Set();
  const deduped = [];
  for (const g of grounds) {
    if (seen.has(g.vertexId)) continue;
    seen.add(g.vertexId);
    deduped.push(g);
  }
  return { ...wire, grounds: deduped };
}
