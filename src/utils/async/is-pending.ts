function isPending(promise: Promise<unknown>, timeout = 100) {
  return Promise.race([
    promise.then(() => false).catch(() => false),
    new Promise((resolve) => setTimeout(() => resolve(true), timeout)),
  ]);
}

export { isPending };
