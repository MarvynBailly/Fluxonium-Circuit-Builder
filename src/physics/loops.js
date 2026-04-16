/**
 * loops.js
 *
 * Find independent flux loops in a circuit and label them so each can
 * carry its own external flux φ_ext,n.
 *
 * A "flux loop" is a closed loop made entirely of *inductive* branches
 * (inductors and Josephson junctions). Capacitors are insulators and
 * cannot form fluxoid-quantized loops, so they are excluded from the
 * loop-finding subgraph. The number of independent flux loops is the
 * first Betti number of the L+JJ subgraph,
 *
 *     L  =  E_LJ  −  V_LJ  +  C_LJ
 *
 * where E_LJ is the number of L/JJ edges, V_LJ the number of distinct
 * nodes touched by them, and C_LJ the number of connected components
 * (with all ground nodes merged into one rail, since they are physically
 * the same node).
 *
 * For each independent loop, fluxoid quantization (Lin et al., Eq. (20)
 * and the discussion of θ_0 + Σ θ_x + φ_ext ≡ 2π n on p. 5) constrains
 * the sum of branch phases around the loop. We use the standard gauge
 * in which the entire flux offset is attached to a single chord branch
 * — the non-tree edge that closes the fundamental cycle. The other
 * branches in the loop carry no explicit flux; their phase drops are
 * already determined by the node variables on the spanning tree.
 *
 * Algorithm: build a spanning forest of the L+JJ subgraph by BFS. Every
 * non-tree edge ("chord") closes exactly one fundamental cycle, found
 * by walking from each chord endpoint up to the lowest common ancestor
 * in the tree. This produces a basis of L = (#chords) independent loops.
 */

/**
 * @typedef {Object} LoopStep
 * @property {string} edgeId
 * @property {number} from
 * @property {number} to
 *
 * @typedef {Object} Loop
 * @property {number}     index         1-based loop number for display (φ_ext,index)
 * @property {string}     key           Stable canonical id (sorted edge ids joined)
 * @property {string}     chordEdgeId   Edge that closes the loop; carries φ_ext
 * @property {string[]}   edgeIds       Sorted unique edge ids in the loop
 * @property {LoopStep[]} traversal     Edges in cyclic order with traversal sense
 * @property {number[]}   nodeSequence  Canonical node ids visited around the cycle
 */

/**
 * Find a fundamental cycle basis of the inductive (L+JJ) subgraph.
 *
 * @param {Array} nodes - all circuit nodes (each with id, isGround)
 * @param {Array} edges - all circuit edges (each with id, from, to, type)
 * @returns {Loop[]}
 */
export function findFluxLoops(nodes, edges) {
  // Collapse all ground nodes into a single canonical id, since they share
  // the same physical ground rail and any loop that "passes through ground"
  // really passes through one node.
  const groundIds = new Set(nodes.filter((n) => n.isGround).map((n) => n.id));
  const groundRep = groundIds.size > 0 ? Math.min(...groundIds) : null;
  const canon = (id) => (groundIds.has(id) ? groundRep : id);

  // Restrict to flux-carrying edges. Drop self-loops on a single node
  // (no physical meaning, only arises from UI mishaps).
  const fluxEdges = edges.filter(
    (e) => (e.type === 'L' || e.type === 'JJ') && canon(e.from) !== canon(e.to),
  );
  if (fluxEdges.length === 0) return [];

  // Adjacency list, keyed by canonical node id.
  const adj = new Map();
  const touch = (id) => {
    if (!adj.has(id)) adj.set(id, []);
  };
  for (const edge of fluxEdges) {
    const a = canon(edge.from);
    const b = canon(edge.to);
    touch(a);
    touch(b);
    adj.get(a).push({ neighbor: b, edge });
    adj.get(b).push({ neighbor: a, edge });
  }

  // BFS spanning forest. parent[node] = { parentNode, edge, depth }
  // (root nodes have parentNode = null).
  const parent = new Map();
  const treeEdgeIds = new Set();
  for (const start of adj.keys()) {
    if (parent.has(start)) continue;
    parent.set(start, { parentNode: null, edge: null, depth: 0 });
    const queue = [start];
    while (queue.length > 0) {
      const u = queue.shift();
      for (const { neighbor, edge } of adj.get(u)) {
        if (treeEdgeIds.has(edge.id)) continue; // edge already used in tree
        if (parent.has(neighbor)) continue; // node reached by another route
        parent.set(neighbor, {
          parentNode: u,
          edge,
          depth: parent.get(u).depth + 1,
        });
        treeEdgeIds.add(edge.id);
        queue.push(neighbor);
      }
    }
  }

  // Chords = flux edges that are not part of the spanning forest.
  const chords = fluxEdges.filter((e) => !treeEdgeIds.has(e.id));

  // Each chord defines exactly one fundamental cycle.
  return chords.map((chord, i) => {
    const traversal = traceCycle(chord, parent, canon);
    const edgeIds = [...new Set(traversal.map((s) => s.edgeId))].sort();
    const nodeSequence = traversal.map((s) => s.from);
    return {
      index: i + 1,
      key: edgeIds.join('|'),
      chordEdgeId: chord.id,
      edgeIds,
      traversal,
      nodeSequence,
    };
  });
}

/**
 * Walk both endpoints of `chord` up the spanning tree to their lowest
 * common ancestor, then close the cycle with the chord. Returns the
 * cyclic edge sequence starting at chord.from.
 */
function traceCycle(chord, parent, canon) {
  let a = canon(chord.from);
  let b = canon(chord.to);

  const aPath = []; // u → LCA, in walk order
  const bPath = []; // v → LCA, recorded in v→LCA order; will be reversed

  let da = parent.get(a).depth;
  let db = parent.get(b).depth;

  // Equalise depths first.
  while (da > db) {
    const p = parent.get(a);
    aPath.push({ edgeId: p.edge.id, from: a, to: p.parentNode });
    a = p.parentNode;
    da--;
  }
  while (db > da) {
    const p = parent.get(b);
    bPath.push({ edgeId: p.edge.id, from: b, to: p.parentNode });
    b = p.parentNode;
    db--;
  }

  // Walk both up together until they meet at the LCA.
  while (a !== b) {
    const pa = parent.get(a);
    aPath.push({ edgeId: pa.edge.id, from: a, to: pa.parentNode });
    a = pa.parentNode;
    const pb = parent.get(b);
    bPath.push({ edgeId: pb.edge.id, from: b, to: pb.parentNode });
    b = pb.parentNode;
  }

  // a === b is the LCA. Build the cyclic order
  //     chord.from → … → LCA → … → chord.to → chord.from
  const cycle = [];
  // u → LCA (aPath as recorded)
  cycle.push(...aPath);
  // LCA → v: reverse bPath and flip from/to so each step reads LCA-side → v-side.
  for (let i = bPath.length - 1; i >= 0; i--) {
    const step = bPath[i];
    cycle.push({ edgeId: step.edgeId, from: step.to, to: step.from });
  }
  // v → u via chord (chord stored as from→to, we traverse to→from to close).
  cycle.push({ edgeId: chord.id, from: canon(chord.to), to: canon(chord.from) });

  return cycle;
}
