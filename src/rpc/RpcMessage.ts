import { RpcProcedure, RpcProcedurePayload, RpcProcedureResult } from './RpcProcedure';

interface RpcMessage<
  TType extends string = string,
  TProcedure extends RpcProcedure = RpcProcedure,
  TPayload = unknown
> {
  rpc: true;
  type: TType;
  procedure: TProcedure;
  id: number;
  payload: TPayload;
  source?: string;
}
type RpcCall<TProcedure extends RpcProcedure> = RpcMessage<
  'call',
  TProcedure,
  RpcProcedurePayload<TProcedure>
>;
type RpcReturn<TProcedure extends RpcProcedure> = RpcMessage<
  'return',
  TProcedure,
  RpcProcedureResult<TProcedure>
>;
type RpcThrow<TProcedure extends RpcProcedure, TError = Error> = RpcMessage<
  'throw',
  TProcedure,
  TError
>;

function createRpcMessage<
  TType extends string = string,
  TProcedure extends RpcProcedure = RpcProcedure,
  TPayload = unknown
>(
  procedure: TProcedure,
  id: number,
  type: TType,
  payload: TPayload,
  source?: string
): RpcMessage<TType, TProcedure, TPayload> {
  return {
    rpc: true,
    type,
    id,
    procedure,
    payload,
    source,
  };
}

function createRpcCall<TProcedure extends RpcProcedure>(
  procedure: TProcedure,
  index: number,
  payload: RpcProcedurePayload<TProcedure>
): RpcCall<TProcedure> {
  return createRpcMessage(procedure, index, 'call', payload);
}

function createRpcReturn<TProcedure extends RpcProcedure>(
  procedure: TProcedure,
  index: number,
  payload: RpcProcedureResult<TProcedure>
): RpcReturn<TProcedure> {
  return createRpcMessage(procedure, index, 'return', payload);
}

function createRpcThrow<TProcedure extends RpcProcedure, TError = Error>(
  procedure: TProcedure,
  index: number,
  payload: TError
): RpcThrow<TProcedure, TError> {
  return createRpcMessage(procedure, index, 'throw', payload);
}

function isRpcMessage<
  TType extends string = string,
  TProcedure extends RpcProcedure = RpcProcedure
>(candidate: unknown): candidate is RpcMessage<TType, TProcedure> {
  return !!(typeof candidate === 'object' && candidate && (candidate as { rpc: boolean }).rpc);
}

function getRpcMessageKey(message: RpcMessage) {
  return `${message.procedure}_${message.id}`;
}

export {
  RpcMessage,
  RpcCall,
  RpcReturn,
  RpcThrow,
  createRpcMessage,
  createRpcCall,
  createRpcReturn,
  createRpcThrow,
  isRpcMessage,
  getRpcMessageKey,
};
