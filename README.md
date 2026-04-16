# Fluxonium Circuit Builder

An interactive web tool for building superconducting quantum circuit models and extracting the Hamiltonian parameters needed for lattice field theory simulation.

## Motivation

Large superconducting quantum circuits are difficult to analyze from first principles. [Lin et al. (2025)](https://arxiv.org/abs/2512.05851) introduced a lattice field theory approach that formulates circuit-QED as a path integral and extracts the many-body spectrum via Monte Carlo sampling. This tool provides the first step in that pipeline: going from a circuit schematic to the numerical Hamiltonian parameters that enter the lattice action.

## Features

- **Visual circuit editor** — drag-and-drop nodes; connect them with capacitors, inductors, and Josephson junctions
<!--- **Real-time Hamiltonian extraction** — capacitance matrix, charging energies, inductive energies, Josephson energies, and symbolic Hamiltonian update live as you edit-->
<!--- **Preset circuits** — load standard topologies (transmon, simple fluxonium, JJ-array fluxonium) with one click-->
- **JSON export** — download all Hamiltonian parameters in a structured format ready for a solver

## Quick start

```bash
git clone https://github.com/MarvynBailly/fluxonium-circuit-builder.git
cd fluxonium-circuit-builder
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

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
```
