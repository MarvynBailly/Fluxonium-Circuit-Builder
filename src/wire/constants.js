/** Snap radius in pixels for vertex/wire/component hit-testing. */
export const SNAP_RADIUS = 14;

/** Grid spacing in pixels. */
export const GRID = 30;

/** Rendered length of a freshly-placed component, in pixels. */
export const COMPONENT_LENGTH = 60;

/** Fractions along a wire that components magnetically snap to. */
export const FRACTIONS = [1 / 4, 1 / 3, 1 / 2, 2 / 3, 3 / 4];

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

/** Empty wire model — useful as an initial state. */
export const EMPTY_WIRE = {
  vertices: [],
  wires: [],
  components: [],
  grounds: [],
  nextVertexId: 0,
  nextWireId: 0,
  nextComponentId: 0,
  nextGroundId: 0,
};
