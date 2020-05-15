interface Listener<T = void> {
  resolve: (value: T) => void;
  reject: (error: unknown) => void;
}

export { Listener };
