/**
 * Definitions for the three circuit element types supported by the builder.
 */
export const ELEMENT_TYPES = {
  C: {
    id: 'C',
    label: 'Capacitor',
    color: '#a78bfa',
    unit: 'fF',
    defaultValue: 5.0,
    symbol: 'C',
  },
  L: {
    id: 'L',
    label: 'Inductor',
    color: '#10b981',
    unit: 'nH',
    defaultValue: 300,
    symbol: 'L',
  },
  JJ: {
    id: 'JJ',
    label: 'Josephson Junction',
    color: '#f59e0b',
    unit: 'GHz',
    defaultValue: 8.0,
    symbol: 'E_J',
  },
};
