function intersect<T>(arrayA: T[] = [], arrayB: T[] = []): T[] {
  return arrayA.filter((item) => arrayB.includes(item));
}

export default intersect;
