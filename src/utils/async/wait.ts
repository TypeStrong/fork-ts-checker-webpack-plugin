function wait(timeout: number) {
  return new Promise((resolve) => setTimeout(resolve, timeout));
}

export default wait;
