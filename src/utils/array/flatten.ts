function flatten<T>(matrix: T[][]): T[] {
  return matrix.reduce((flatten, array) => flatten.concat(array), []);
}

export default flatten;
