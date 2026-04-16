/**
 * Invert a square matrix via Gauss-Jordan elimination.
 * Returns null if the matrix is singular.
 *
 * @param {number[][]} matrix - Square matrix
 * @returns {number[][] | null}
 */
export function invertMatrix(matrix) {
  const n = matrix.length;
  if (n === 0) return null;

  // Build augmented matrix [A | I]
  const aug = matrix.map((row, i) =>
    [...row, ...Array.from({ length: n }, (_, j) => (i === j ? 1 : 0))]
  );

  for (let col = 0; col < n; col++) {
    // Partial pivoting
    let maxRow = col;
    for (let row = col + 1; row < n; row++) {
      if (Math.abs(aug[row][col]) > Math.abs(aug[maxRow][col])) {
        maxRow = row;
      }
    }
    [aug[col], aug[maxRow]] = [aug[maxRow], aug[col]];

    const pivot = aug[col][col];
    if (Math.abs(pivot) < 1e-15) return null; // Singular

    // Scale pivot row
    for (let j = 0; j < 2 * n; j++) aug[col][j] /= pivot;

    // Eliminate column
    for (let row = 0; row < n; row++) {
      if (row === col) continue;
      const factor = aug[row][col];
      for (let j = 0; j < 2 * n; j++) {
        aug[row][j] -= factor * aug[col][j];
      }
    }
  }

  return aug.map((row) => row.slice(n));
}

/**
 * Compute the determinant of a square matrix via LU decomposition.
 *
 * @param {number[][]} matrix
 * @returns {number}
 */
export function determinant(matrix) {
  const n = matrix.length;
  if (n === 0) return 1;
  if (n === 1) return matrix[0][0];
  if (n === 2) return matrix[0][0] * matrix[1][1] - matrix[0][1] * matrix[1][0];

  const m = matrix.map((row) => [...row]);
  let det = 1;
  for (let col = 0; col < n; col++) {
    let maxRow = col;
    for (let row = col + 1; row < n; row++) {
      if (Math.abs(m[row][col]) > Math.abs(m[maxRow][col])) maxRow = row;
    }
    if (maxRow !== col) {
      [m[col], m[maxRow]] = [m[maxRow], m[col]];
      det *= -1;
    }
    if (Math.abs(m[col][col]) < 1e-15) return 0;
    det *= m[col][col];
    for (let row = col + 1; row < n; row++) {
      const factor = m[row][col] / m[col][col];
      for (let j = col + 1; j < n; j++) {
        m[row][j] -= factor * m[col][j];
      }
    }
  }
  return det;
}
