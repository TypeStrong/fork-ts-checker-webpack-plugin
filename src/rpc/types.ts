interface RpcCallMessage {
  type: 'call';
  id: string;
  args: unknown[];
}
interface RpcResolveMessage {
  type: 'resolve';
  id: string;
  value: unknown;
}
interface RpcRejectMessage {
  type: 'reject';
  id: string;
  error: unknown;
}
type RpcMessage = RpcCallMessage | RpcResolveMessage | RpcRejectMessage;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type RpcMethod = (...args: any[]) => any;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type RpcRemoteMethod<T extends RpcMethod> = T extends (...args: infer A) => infer R
  ? // eslint-disable-next-line @typescript-eslint/no-explicit-any
    R extends Promise<any>
    ? (...args: A) => R
    : (...args: A) => Promise<R>
  : (...args: unknown[]) => Promise<unknown>;

export {
  RpcCallMessage,
  RpcResolveMessage,
  RpcRejectMessage,
  RpcMessage,
  RpcMethod,
  RpcRemoteMethod,
};
