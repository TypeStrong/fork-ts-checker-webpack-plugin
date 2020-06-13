// eslint-disable-next-line @typescript-eslint/no-empty-interface
interface RpcProcedure<TPayload = unknown, TResult = unknown> extends String {}

type RpcProcedurePayload<TProcedure> = TProcedure extends RpcProcedure<
  infer TPayload,
  infer TResult
>
  ? TPayload
  : never;

type RpcProcedureResult<TProcedure> = TProcedure extends RpcProcedure<infer TPayload, infer TResult>
  ? TResult
  : never;

export { RpcProcedure, RpcProcedurePayload, RpcProcedureResult };
