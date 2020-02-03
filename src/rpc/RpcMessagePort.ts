type RpcMessageDispatch = <TMessage>(message: TMessage) => Promise<void>;

interface RpcMessagePort {
  readonly dispatchMessage: RpcMessageDispatch;
  readonly addMessageListener: (listener: RpcMessageDispatch) => void;
  readonly removeMessageListener: (listener: RpcMessageDispatch) => void;
  readonly isOpen: () => boolean;
  readonly open: () => Promise<void>;
  readonly close: () => Promise<void>;
}

export { RpcMessagePort, RpcMessageDispatch };
