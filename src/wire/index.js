export {
  EMPTY_WIRE,
  SNAP_RADIUS,
  GRID,
  COMPONENT_LENGTH,
  FRACTIONS,
  NODE_PALETTE,
  DEFAULT_NODE_COLOR,
} from './constants.js';

export { projectPointOnSegment } from './segmentMath.js';

export {
  snapToGrid,
  snapFraction,
  snapToVertex,
  snapToWire,
  snapToComponent,
} from './snap.js';

export { addWire, deleteWire, splitWireAt } from './wireOps.js';

export {
  addVertex,
  deleteVertex,
  mergeVertices,
  canMergeVertices,
  gluCoincidentVertices,
  canMergeVertexIntoWire,
  mergeVertexIntoWire,
} from './vertexOps.js';

export {
  splitWireWithComponent,
  placeStandaloneComponent,
  removeComponent,
  setComponentType,
  setComponentValue,
  setComponentColor,
  moveComponentCenter,
  nextComponentSymbol,
} from './componentOps.js';

export { autoDetectNodes } from './electricalNodes.js';

export { computeHover } from './hover.js';

export { serializeSelection, pasteSelection, rotateSelection } from './clipboard.js';

export { WIRE_DEFAULT, WIRE_DEFAULT_ANALYSIS } from './defaults.js';
