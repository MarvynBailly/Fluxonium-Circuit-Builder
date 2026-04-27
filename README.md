# Fluxonium Circuit Builder

An interactive web tool for building superconducting quantum circuit models and extracting the Hamiltonian parameters needed for lattice field theory simulation.

**Try it live:** [Quantum Circuit Builder](https://marvyn.com/Quantum-Circuit-Builder/)

## Motivation

Large superconducting quantum circuits are difficult to analyze from first principles. [Lin et al. (2025)](https://arxiv.org/abs/2512.05851) introduced a lattice field theory approach that formulates circuit-QED as a path integral and extracts the many-body spectrum via Monte Carlo sampling. This tool provides the first step in that pipeline: going from a circuit schematic to the numerical Hamiltonian parameters that enter the lattice action.

## Features

- **Two editing modes** — *Wire mode* lets you lay down wires on a 30 px grid and drop components on top of them, the way schematics are actually drawn. *Legacy mode* keeps the original node-first workflow for quick abstract topologies.
- **Auto-detected electrical nodes** — in wire mode you never place nodes; the editor runs union-find over the wire graph and derives them in real time, with phantom nodes inserted between series components.
- **Stable identity across edits** — user-set labels, colors, and ground flags survive unrelated topology changes. Auto-assigned `\phi_k` labels reflow around them.
- **Symbolic component values** — capacitors, inductors, and junctions hold LaTeX strings (`C_0`, `E_J^1`, ...). The capacitance and adjacency matrices are rendered symbolically.
- **Snap ergonomics** — magnetic grid snap, magnetic 1/4–3/4 fraction snaps for component placement, and a universal Shift override to break either snap.
- **Hover-driven previews** — a single `computeHover()` resolves the cursor to a descriptor that drives both the ghost preview and the click handler, so what you see is always what you'll get.
- **Pan, zoom, fit-view**, and independently resizable left/right panels.
- **Undo/redo** (`Ctrl+Z` / `Ctrl+Shift+Z` / `Ctrl+Y`) covering both modes, with drag-coalesced history.
- **JSON import/export** — round-trips full wire geometry plus user overrides; one format covers both modes.

See `blog.html` and `blog2.html` for the design notes behind the original editor and the wire-first rebuild.

## Building from source

```bash
git clone https://github.com/MarvynBailly/Fluxonium-Circuit-Builder.git
cd Fluxonium-Circuit-Builder
npm install
npm run dev
```

## Usage

### Wire mode (default)

1. **Lay wires** — pick the Wire tool and click grid intersections to drop vertices. Click an existing segment to branch from it; click an existing vertex to connect to it. Hold `Shift` to place off-grid.
2. **Drop components** — pick `C`, `L`, or `JJ` and click on a segment. The cursor magnetically snaps to 1/4, 1/3, 1/2, 2/3, or 3/4 along the segment.
3. **Edit identity** — the left panel lists every auto-detected electrical node. Rename it (LaTeX), recolor it, or mark it as ground.
4. **Edit values** — click a component to open the right-side properties panel and rename its symbolic value.
5. **Read the physics** — the right panel shows the adjacency and capacitance matrices, regenerated symbolically as you edit.

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

## Exported JSON format

```json
{
  "_meta": { "generator": "fluxonium-circuit-builder", "version": "0.2.0" },
  "nodes": [{ "id": 0, "label": "\\phi_0", "is_ground": true }],
  "edges": [{ "from": 0, "to": 1, "type": "JJ", "value": "E_J^{0}", "unit": "GHz" }],
  "adjacency_matrix": [[0, 1], [1, 0]],
  "wire_geometry": {
    "vertices":   [{ "id": 0, "x": 120, "y": 240 }],
    "segments":   [{ "id": "s0", "from": 0, "to": 1 }],
    "components": [{ "id": "c0", "segment_id": "s0", "t": 0.5, "type": "JJ", "value": "E_J^{0}" }]
  },
  "node_overrides": [
    { "anchor": 0, "label": "\\phi_g", "is_ground": true }
  ]
}
```

`wire_geometry` and `node_overrides` are present only for wire-mode exports. Legacy exports include `node_positions` instead. Import auto-detects which format it received.
