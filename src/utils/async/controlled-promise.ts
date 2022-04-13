function createControlledPromise<T = unknown>() {
  let resolve: (value: T) => void = () => undefined;
  let reject: (error: unknown) => void = () => undefined;
  const promise = new Promise<T>((aResolve, aReject) => {
    resolve = aResolve;
    reject = aReject;
  });

  return {
    promise,
    resolve,
    reject,
  };
}

export { createControlledPromise };
