# Fluxonium Circuit Builder

An interactive web tool for building superconducting quantum circuit models and extracting the Hamiltonian parameters needed for lattice field theory simulation.

**Try it live:** [marvyn.com/Fluxonium-Circuit-Builder](https://marvyn.com/Fluxonium-Circuit-Builder/)

## Motivation

Large superconducting quantum circuits are difficult to analyze from first principles. [Lin et al. (2025)](https://arxiv.org/abs/2512.05851) introduced a lattice field theory approach that formulates circuit-QED as a path integral and extracts the many-body spectrum via Monte Carlo sampling. This tool provides the first step in that pipeline: going from a circuit schematic to the numerical Hamiltonian parameters that enter the lattice action.

## Features

- **Visual circuit editor** — drag-and-drop nodes; connect them with capacitors, inductors, and Josephson junctions
- **JSON export** — download all Hamiltonian parameters in a structured format ready for a solver

## Building from source

If you'd like to run the tool locally, clone the repo and start the dev server using:

```bash
git clone https://github.com/MarvynBailly/Fluxonium-Circuit-Builder.git
cd Fluxonium-Circuit-Builder
npm install
npm run dev
```

## Usage

1. **Add nodes** — select the Node tool and click the canvas
2. **Connect elements** — select a component type (Capacitor / Inductor / Josephson Junction), click a source node, then click a target node
3. **Edit values** — click any node or element to open the properties panel
4. **Drag nodes** — with no tool selected, drag to reposition
5. **Delete** — select an element and press Delete or click ✕
6. **Export** — click "↓ Export JSON" to download the current Hamiltonian parameters

## Exported JSON format

```json
{
  "_meta": { "generator": "fluxonium-circuit-builder", "version": "0.1.0" },
  "nodes": [{ "id": 0, "label": "0", "is_ground": true }, ...],
  "edges": [{ "from": 0, "to": 1, "type": "JJ", "value": 8.0, "unit": "GHz" }, ...],
  "adjacency_matrix": [[...]]
}
