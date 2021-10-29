import type { RpcProcedure, RpcProcedurePayload, RpcProcedureResult } from './RpcProcedure';

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
interface RpcRemoteError {
  message: string;
  stack?: string;
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
type RpcThrow<TProcedure extends RpcProcedure> = RpcMessage<'throw', TProcedure, RpcRemoteError>;

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

// suppressing as it will be removed anyway
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function createRpcThrow<TProcedure extends RpcProcedure, TError = Error>(
  procedure: TProcedure,
  index: number,
  payload: RpcRemoteError
): RpcThrow<TProcedure> {
  return createRpcMessage(procedure, index, 'throw', payload);
}

function isRpcMessage<
  TType extends string = string,
  TProcedure extends RpcProcedure = RpcProcedure
>(candidate: unknown): candidate is RpcMessage<TType, TProcedure> {
  return !!(typeof candidate === 'object' && candidate && (candidate as { rpc: boolean }).rpc);
}

function isRpcCallMessage<
  // suppressing as it will be removed anyway
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  TType extends string = string,
  TProcedure extends RpcProcedure = RpcProcedure
>(candidate: unknown): candidate is RpcCall<TProcedure> {
  return isRpcMessage(candidate) && candidate.type === 'call';
}

function isRpcReturnMessage<
  // suppressing as it will be removed anyway
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  TType extends string = string,
  TProcedure extends RpcProcedure = RpcProcedure
>(candidate: unknown): candidate is RpcReturn<TProcedure> {
  return isRpcMessage(candidate) && candidate.type === 'return';
}

function isRpcThrowMessage<
  // suppressing as it will be removed anyway
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  TType extends string = string,
  TProcedure extends RpcProcedure = RpcProcedure
>(candidate: unknown): candidate is RpcThrow<TProcedure> {
  return isRpcMessage(candidate) && candidate.type === 'throw';
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
  isRpcCallMessage,
  isRpcReturnMessage,
  isRpcThrowMessage,
  getRpcMessageKey,
};
