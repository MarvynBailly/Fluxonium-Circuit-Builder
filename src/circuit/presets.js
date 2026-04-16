/**
 * Preset circuit topologies that users can load as starting points.
 * Each preset returns { nodes, edges }.
 */

export const PRESETS = {
  fluxonium_simple: {
    name: 'Fluxonium (simple)',
    description: 'Single JJ shunted by a superinductance and capacitor',
    build: () => ({
      nodes: [
        { id: 0, x: 200, y: 200, label: '0', isGround: true },
        { id: 1, x: 400, y: 120, label: '1', isGround: false },
        { id: 2, x: 400, y: 280, label: '2', isGround: false },
      ],
      edges: [
        { id: 'e0', from: 0, to: 1, type: 'JJ', value: 8.0 },
        { id: 'e1', from: 1, to: 2, type: 'L', value: 300 },
        { id: 'e2', from: 0, to: 2, type: 'C', value: 5.0 },
      ],
    }),
  },

  transmon: {
    name: 'Transmon',
    description: 'Single JJ shunted by a large capacitor',
    build: () => ({
      nodes: [
        { id: 0, x: 250, y: 250, label: '0', isGround: true },
        { id: 1, x: 450, y: 250, label: '1', isGround: false },
      ],
      edges: [
        { id: 'e0', from: 0, to: 1, type: 'JJ', value: 15.0 },
        { id: 'e1', from: 0, to: 1, type: 'C', value: 65.0 },
      ],
    }),
  },

  fluxonium_array: {
    name: 'Fluxonium (JJ array)',
    description: 'Fluxonium with superinductance modeled as a 4-junction array',
    build: () => {
      const nodes = [
        { id: 0, x: 120, y: 200, label: '0', isGround: true },
        { id: 1, x: 280, y: 100, label: '1', isGround: false },
        { id: 2, x: 400, y: 100, label: '2', isGround: false },
        { id: 3, x: 520, y: 100, label: '3', isGround: false },
        { id: 4, x: 640, y: 100, label: '4', isGround: false },
        { id: 5, x: 640, y: 300, label: '5', isGround: false },
      ];
      const EJ_array = 4.0; // GHz per array junction
      const C_array = 2.0; // fF per array junction
      const edges = [
        // Main JJ
        { id: 'e0', from: 0, to: 1, type: 'JJ', value: 8.0 },
        // Shunt capacitor
        { id: 'e1', from: 0, to: 5, type: 'C', value: 5.0 },
        // Array junctions
        { id: 'e2', from: 1, to: 2, type: 'JJ', value: EJ_array },
        { id: 'e3', from: 2, to: 3, type: 'JJ', value: EJ_array },
        { id: 'e4', from: 3, to: 4, type: 'JJ', value: EJ_array },
        { id: 'e5', from: 4, to: 5, type: 'JJ', value: EJ_array },
        // Array capacitances
        { id: 'e6', from: 1, to: 2, type: 'C', value: C_array },
        { id: 'e7', from: 2, to: 3, type: 'C', value: C_array },
        { id: 'e8', from: 3, to: 4, type: 'C', value: C_array },
        { id: 'e9', from: 4, to: 5, type: 'C', value: C_array },
      ];
      return { nodes, edges };
    },
  },

  empty: {
    name: 'Empty',
    description: 'Blank canvas with a single ground node',
    build: () => ({
      nodes: [{ id: 0, x: 300, y: 250, label: 'GND', isGround: true }],
      edges: [],
    }),
  },
};
