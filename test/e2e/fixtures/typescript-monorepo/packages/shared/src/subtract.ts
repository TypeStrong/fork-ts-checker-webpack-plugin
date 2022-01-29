function subtract<T>(arrayA: T[] = [], arrayB: T[] = []): T[] {
  return arrayA.filter((item) => !arrayB.includes(item));
}

export default subtract;
