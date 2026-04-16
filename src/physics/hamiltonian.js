/**
 * hamiltonian.js
 *
 * Given a circuit graph (nodes + edges), extract the capacitance matrix,
 * charging energies, inductive energies, Josephson energies, and the
 * adjacency matrix needed to write down the circuit-QED Hamiltonian.
 *
 * Notation and formulas follow Lin et al. (arXiv:2512.05851):
 *
 *   H  =  ½ Σ_xx' Q_x (C⁻¹)_xx' Q_x'  +  U(Φ)        [Eq. (4)]
 *      =  2 e² Σ_xx' n_x (C⁻¹)_xx' n_x'  +  U        [n_x = Q_x/(2e)]
 *
 * with U built from the inductive (½ E_L (Δφ)², E_L = φ_0²/L) and
 * Josephson (−E_J cos(Δφ)) potential terms of Eq. (1).
 *
 * Convention: energies are returned in GHz (i.e. E/h in units of 1e9 Hz).
 */

import { e as e_charge, h, phi0 } from './constants.js';
import { invertMatrix } from './linalg.js';

/**
 * @typedef {Object} Node
 * @property {number} id
 * @property {string} label
 * @property {boolean} isGround
 */

/**
 * @typedef {Object} Edge
 * @property {string} id
 * @property {number} from     - source node id
 * @property {number} to       - target node id
 * @property {'C'|'L'|'JJ'} type
 * @property {number} value    - C in fF, L in nH, EJ in GHz
 */

/**
 * Build the reduced capacitance matrix over non-ground nodes using
 * modified nodal analysis (MNA) stamping.
 *
 * @param {Node[]} nodes
 * @param {Edge[]} edges
 * @returns {{ matrix: number[][], nodeList: Node[], nodeIndex: Record<number,number> }}
 */
export function buildCapacitanceMatrix(nodes, edges) {
  const nonGround = nodes.filter((n) => !n.isGround).sort((a, b) => a.id - b.id);
  const idx = {};
  nonGround.forEach((n, i) => (idx[n.id] = i));
  const N = nonGround.length;
  const C = Array.from({ length: N }, () => Array(N).fill(0));

  for (const edge of edges) {
    if (edge.type !== 'C') continue;
    const C_SI = edge.value * 1e-15; // fF → F
    const fromGnd = nodes.find((n) => n.id === edge.from)?.isGround;
    const toGnd = nodes.find((n) => n.id === edge.to)?.isGround;

    if (!fromGnd && !toGnd) {
      const i = idx[edge.from];
      const j = idx[edge.to];
      if (i === undefined || j === undefined) continue;
      C[i][i] += C_SI;
      C[j][j] += C_SI;
      C[i][j] -= C_SI;
      C[j][i] -= C_SI;
    } else {
      const nonGndId = fromGnd ? edge.to : edge.from;
      const i = idx[nonGndId];
      if (i === undefined) continue;
      C[i][i] += C_SI;
    }
  }

  return { matrix: C, nodeList: nonGround, nodeIndex: idx };
}

/**
 * Compute diagonal charging energies E_C,i = e²/(2 C_ii) in GHz.
 *
 * This is the lumped single-mode definition (paper Eq. (19) and the text
 * below it: "E_C = e²/(2 C^b)"). For the full multi-mode kinetic term,
 * see paper Eqs. (4) and (20) — they use the inverse capacitance matrix,
 * not the diagonal of C itself.
 *
 * @param {number[][]} capMatrix
 * @returns {number[]}
 */
export function chargingEnergies(capMatrix) {
  return capMatrix.map((_, i) => {
    const Cii = capMatrix[i][i];
    if (Cii === 0) return 0;
    return (e_charge * e_charge) / (2 * Cii) / h / 1e9;
  });
}

/**
 * Compute the inverse capacitance matrix. Returns null if singular.
 *
 * @param {number[][]} capMatrix
 * @returns {number[][] | null}
 */
export function inverseCapacitanceMatrix(capMatrix) {
  return invertMatrix(capMatrix);
}

/**
 * Extract inductive energies E_L = φ_0² / L in GHz, where
 * φ_0 = ℏ/(2e) is the reduced flux quantum (paper Eq. (1) gives
 * the inductor Lagrangian (1/2L)(Φ_x − Φ_x')²; rewriting in
 * dimensionless phase φ = Φ/φ_0 yields ½ E_L (φ_x − φ_x')²
 * with E_L = φ_0²/L).
 *
 * @param {Node[]} nodes
 * @param {Edge[]} edges
 * @returns {{ from: number, to: number, fromLabel: string, toLabel: string, L_SI: number, EL_GHz: number, fromGround: boolean, toGround: boolean }[]}
 */
export function inductiveEnergies(nodes, edges) {
  return edges
    .filter((e) => e.type === 'L')
    .map((edge) => {
      const fn = nodes.find((n) => n.id === edge.from);
      const tn = nodes.find((n) => n.id === edge.to);
      const L_SI = edge.value * 1e-9; // nH → H
      const EL_GHz = (phi0 * phi0) / L_SI / h / 1e9;
      return {
        id: edge.id,
        from: edge.from,
        to: edge.to,
        fromLabel: fn?.label ?? '?',
        toLabel: tn?.label ?? '?',
        L_SI,
        EL_GHz,
        fromGround: fn?.isGround ?? false,
        toGround: tn?.isGround ?? false,
      };
    });
}

/**
 * Extract Josephson junction energies (already in GHz from user input).
 *
 * @param {Node[]} nodes
 * @param {Edge[]} edges
 * @returns {{ from: number, to: number, fromLabel: string, toLabel: string, EJ_GHz: number, fromGround: boolean, toGround: boolean }[]}
 */
export function josephsonEnergies(nodes, edges) {
  return edges
    .filter((e) => e.type === 'JJ')
    .map((edge) => {
      const fn = nodes.find((n) => n.id === edge.from);
      const tn = nodes.find((n) => n.id === edge.to);
      return {
        id: edge.id,
        from: edge.from,
        to: edge.to,
        fromLabel: fn?.label ?? '?',
        toLabel: tn?.label ?? '?',
        EJ_GHz: edge.value,
        fromGround: fn?.isGround ?? false,
        toGround: tn?.isGround ?? false,
      };
    });
}

/**
 * Build the full adjacency matrix (element count) over ALL nodes
 * (including ground), useful for topology checks.
 *
 * @param {Node[]} nodes
 * @param {Edge[]} edges
 * @returns {{ matrix: number[][], nodeList: Node[] }}
 */
export function adjacencyMatrix(nodes, edges) {
  const sorted = [...nodes].sort((a, b) => a.id - b.id);
  const idx = {};
  sorted.forEach((n, i) => (idx[n.id] = i));
  const N = sorted.length;
  const A = Array.from({ length: N }, () => Array(N).fill(0));

  for (const edge of edges) {
    const i = idx[edge.from];
    const j = idx[edge.to];
    if (i === undefined || j === undefined) continue;
    A[i][j]++;
    A[j][i]++;
  }

  return { matrix: A, nodeList: sorted };
}

/**
 * Bundle all extracted parameters into one object for export / serialization.
 *
 * @param {Node[]} nodes
 * @param {Edge[]} edges
 * @returns {Object}
 */
export function extractAll(nodes, edges) {
  const cap = buildCapacitanceMatrix(nodes, edges);
  const invCap = inverseCapacitanceMatrix(cap.matrix);
  const EC = chargingEnergies(cap.matrix);
  const EL = inductiveEnergies(nodes, edges);
  const EJ = josephsonEnergies(nodes, edges);
  const adj = adjacencyMatrix(nodes, edges);

  return {
    capacitanceMatrix: cap.matrix,
    inverseCapacitanceMatrix: invCap,
    nonGroundNodes: cap.nodeList,
    nodeIndex: cap.nodeIndex,
    chargingEnergies: EC,
    inductiveEnergies: EL,
    josephsonEnergies: EJ,
    adjacencyMatrix: adj.matrix,
    allNodes: adj.nodeList,
  };
}
