/**
 * Serialize circuit topology to a downloadable JSON file.
 *
 * The output includes:
 *   - nodes: full node list with ground flags
 *   - edges: raw edge list with types and values
 *   - adjacency_matrix: element count between all nodes
 */

import { adjacencyMatrix } from '../physics/hamiltonian.js';

/**
 * Build a plain object suitable for JSON.stringify.
 */
export function buildExportPayload(nodes, edges) {
  const adj = adjacencyMatrix(nodes, edges);

  return {
    _meta: {
      generator: 'fluxonium-circuit-builder',
      version: '0.1.0',
      exported_at: new Date().toISOString(),
      description:
        'Circuit topology exported from an interactive circuit graph.',
    },
    nodes: nodes.map((n) => ({
      id: n.id,
      label: n.label,
      is_ground: n.isGround,
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
  };
}

/**
 * Trigger a browser download of the JSON payload.
 */
export function downloadJSON(nodes, edges, filename = 'circuit-topology.json') {
  const payload = buildExportPayload(nodes, edges);
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
