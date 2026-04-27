# Quantum Circuit Builder

An interactive web tool for building superconducting quantum circuit models and extracting the Hamiltonian parameters needed for lattice field theory simulation.

**Try it live:** [Quantum Circuit Builder](https://marvyn.com/Quantum-Circuit-Builder/)

## Motivation

Large superconducting quantum circuits are difficult to analyze from first principles. [Lin et al. (2025)](https://arxiv.org/abs/2512.05851) introduced a lattice field theory approach that formulates circuit-QED as a path integral and extracts the many-body spectrum via Monte Carlo sampling. This tool provides the first step in that pipeline: going from a circuit schematic to the numerical Hamiltonian parameters that enter the lattice action.

## Features

- **Two editing modes** — *Wire mode* lets you lay down wires on a 30 px grid and either drop components onto a wire (the wire is split and the component spliced in) or drop standalone components in empty space. *Legacy mode* keeps the original node-first workflow for quick abstract topologies.
- **Unified edge graph** — wires and components are both first-class edges in the same graph. A component owns its two endpoint vertices; you can drag those endpoints to change orientation and length, drag the body to translate, or pull it off a wire entirely.
- **Auto-detected electrical nodes** — in wire mode you never place nodes; the editor runs union-find over the wire graph and derives them in real time. A vertex with no incident wire stays a "terminal" and doesn't enter the φ list until you wire it up.
- **Smart vertex deletion** — *Delete* drops the wires meeting at a vertex (components stay, with disconnected terminals). *Merge into wire* folds a degree-2 corner into a single straight wire.
- **Wire-separation invariant** — two components can never share a vertex; the system inserts a (possibly zero-length) wire between adjacent component endpoints so the shared electrical node is always visible.
- **Stable identity across edits** — user-set labels, colors, and ground flags survive unrelated topology changes. Auto-assigned `\phi_k` labels reflow around them.
- **Symbolic component values** — capacitors, inductors, and junctions hold LaTeX strings (`C_0`, `E_J^1`, ...). The capacitance and adjacency matrices are rendered symbolically.
- **Snap ergonomics** — magnetic grid snap for vertices and standalone components, magnetic 1/4 / 1/3 / 1/2 / 2/3 / 3/4 fraction snap when placing or sliding a component along a wire, and a universal Shift override to break either snap.
- **Hover-driven previews** — a single `computeHover()` resolves the cursor to a descriptor that drives both the ghost preview and the click handler, so what you see is always what you'll get.
- **Pan, zoom, fit-view**, and independently resizable left/right panels.
- **Undo/redo** (`Ctrl+Z` / `Ctrl+Shift+Z` / `Ctrl+Y`) covering both modes, with drag-coalesced history.
- **JSON import/export** — round-trips full wire geometry plus user overrides; one format covers both modes, and the import path auto-converts the older overlay-based wire format on the fly.

See `blog.html` and `blog2.html` for the design notes behind the original editor and the wire-first rebuild.

## Building from source

```bash
git clone https://github.com/MarvynBailly/Quantum-Circuit-Builder.git
cd Quantum-Circuit-Builder
npm install
npm run dev
```

## Usage

### Wire mode (default)

1. **Lay wires** — pick the Wire tool and click grid intersections to drop vertices. Click an existing wire to branch from it (a vertex is inserted at the click point); click an existing vertex to connect to it. Hold `Shift` to place off-grid.
2. **Drop components** — pick `C`, `L`, or `JJ`. Click on a wire to split it and insert the component (the cursor magnetically snaps to 1/4, 1/3, 1/2, 2/3, or 3/4 along the wire); click empty space to drop a standalone component with two free terminals.
3. **Move components** — with no tool selected, drag a component endpoint to change its orientation/length, or drag its body to translate. Over a wire it slides along (with fraction snap); pulled away it free-translates with grid snap. Hold `Shift` for free-form placement.
4. **Edit a vertex** — select it and choose *Delete* (drops incident wires; components keep their endpoints) or *Merge into wire* (collapses a degree-2 corner into one straight wire).
5. **Edit identity** — the left panel lists every auto-detected electrical node. Rename it (LaTeX), recolor it, or mark it as ground.
6. **Edit values** — click a component to open the right-side properties panel and rename its symbolic value.
7. **Read the physics** — the right panel shows the adjacency and capacitance matrices, regenerated symbolically as you edit.

### Legacy mode

1. **Add nodes** — Node tool, click the canvas.
2. **Connect** — pick `C` / `L` / `JJ`, click a source node, click a target node.
3. **Drag** — with no tool selected, drag to reposition.

### Shortcuts

| Key | Action |
|---|---|
| `Ctrl+Z` / `Ctrl+Shift+Z` / `Ctrl+Y` | Undo / redo |
| `Esc` | Clear active tool, then deselect |
| `Delete` / `Backspace` | Remove current selection |
| `Shift` (held) | Break grid / fraction snap |
| Right-click | Drop active tool |
| Middle-click drag / wheel | Pan / zoom |

## Project layout

```
src/
├── App.jsx                     # root component, state + canvas event dispatch
├── wire/                       # wire-mode data model (no React deps)
│   ├── constants.js            # SNAP_RADIUS, GRID, COMPONENT_LENGTH, FRACTIONS, ...
│   ├── segmentMath.js          # projectPointOnSegment
│   ├── snap.js                 # snapToGrid / Fraction / Vertex / Wire / Component
│   ├── wireOps.js              # addWire, deleteWire, splitWireAt
│   ├── vertexOps.js            # addVertex, deleteVertex, merge / glue / fold-into-wire
│   ├── componentOps.js         # placement, edits, drag, symbol generator
│   ├── electricalNodes.js      # autoDetectNodes (union-find via wires)
│   ├── hover.js                # computeHover — cursor → click descriptor
│   ├── defaults.js             # default circuit (loaded from example1.json)
│   └── index.js                # barrel re-exports
├── circuit/                    # cross-mode shared bits
│   ├── elementTypes.js         # C / L / JJ definitions
│   ├── exportJSON.js           # serializer + old-format loader
│   ├── presets.js              # transmon / fluxonium templates
│   ├── defaults.js             # default schematic
│   └── symbolGenerators.js     # next free C_k / L_k / E_J^k
├── physics/                    # pure-functions, no React
│   ├── constants.js
│   ├── linalg.js
│   └── hamiltonian.js
├── components/                 # React UI
│   ├── HeaderBar / Toolbar / HamiltonianPanel / NodeLabelsPanel / ...
│   ├── WireLayer.jsx           # SVG renderer coordinator (wire mode)
│   └── wire/                   # WireLayer subcomponents
│       ├── Wires.jsx
│       ├── Components.jsx
│       ├── Vertices.jsx
│       ├── NodeLabels.jsx
│       └── HoverPreview.jsx
└── hooks/                      # useHistory, usePanZoom, useResizablePanel, useKeyboardShortcuts
```

## Exported JSON format

```json
{
  "_meta": { "generator": "quantum-circuit-builder", "version": "0.3.0" },
  "nodes": [{ "id": 0, "label": "\\phi_0", "is_ground": true }],
  "edges": [{ "from": 0, "to": 1, "type": "JJ", "value": "E_J^{0}", "unit": "GHz" }],
  "adjacency_matrix": [[0, 1], [1, 0]],
  "wire_geometry": {
    "vertices":   [{ "id": 0, "x": 120, "y": 240 }],
    "wires":      [{ "id": "w0", "from": 0, "to": 2 }],
    "components": [{ "id": "c0", "from": 2, "to": 3, "type": "JJ", "value": "E_J^{0}" }]
  },
  "node_overrides": [
    { "anchor": 0, "label": "\\phi_g", "is_ground": true }
  ]
}
```

`wire_geometry` and `node_overrides` are present only for wire-mode exports. Legacy exports include `node_positions` instead. Import auto-detects which format it received and transparently converts the older overlay-based geometry (`segments` + `segment_id`) to the new edge graph.
