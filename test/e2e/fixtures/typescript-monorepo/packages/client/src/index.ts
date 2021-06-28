import { intersect, subtract } from '@project-references-fixture/shared';

function compute<T>(arrayA: T[], arrayB: T[]) {
  const intersection = intersect(arrayA, arrayB);
  const difference = subtract(arrayA, arrayB);

  return {
    intersection,
    difference,
  };
}

const { intersection, difference } = compute(['a', 'b', 'c'], ['a', 'd', 'a']);

console.log(`Intersection: ${JSON.stringify(intersection)}`);
console.log(`Difference: ${JSON.stringify(difference)}`);
