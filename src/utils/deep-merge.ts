type Mergeable = Record<PropertyKey, unknown> | unknown[];

function isMergeable(value: unknown): value is Mergeable {
  return (
    typeof value === 'object' &&
    value !== null &&
    !(value instanceof RegExp) &&
    !(value instanceof Date)
  );
}

function clone(value: unknown): unknown {
  return isMergeable(value) ? merge(Array.isArray(value) ? [] : {}, value) : value;
}

function getKeys(value: object): PropertyKey[] {
  return [
    ...Object.keys(value),
    ...Object.getOwnPropertySymbols(value).filter((symbol) =>
      Object.prototype.propertyIsEnumerable.call(value, symbol)
    ),
  ];
}

function merge(target: Mergeable, source: Mergeable): Mergeable {
  if (Array.isArray(target) !== Array.isArray(source)) {
    return clone(source) as Mergeable;
  }
  if (Array.isArray(target) && Array.isArray(source)) {
    return [...target, ...source].map(clone);
  }

  const targetObject = target as Record<PropertyKey, unknown>;
  const sourceObject = source as Record<PropertyKey, unknown>;
  const result: Record<PropertyKey, unknown> = {};
  for (const key of getKeys(targetObject)) {
    // assigning `__proto__` would replace the prototype of the result
    if (key !== '__proto__') {
      result[key] = clone(targetObject[key]);
    }
  }
  for (const key of getKeys(sourceObject)) {
    if (key === '__proto__') {
      continue;
    }
    const targetValue = Object.prototype.hasOwnProperty.call(targetObject, key)
      ? targetObject[key]
      : undefined;
    const sourceValue = sourceObject[key];
    result[key] =
      isMergeable(targetValue) && isMergeable(sourceValue)
        ? merge(targetValue, sourceValue)
        : clone(sourceValue);
  }

  return result;
}

/**
 * Merges `source` into a copy of `target`: objects are merged key by key, arrays
 * are concatenated, and anything else in `source` wins. Neither input is modified.
 */
export function deepMerge<TTarget extends object, TSource extends object>(
  target: TTarget,
  source: TSource
): TTarget & TSource {
  return merge(target as Mergeable, source as Mergeable) as TTarget & TSource;
}
