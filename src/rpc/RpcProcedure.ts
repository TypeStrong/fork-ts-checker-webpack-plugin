// suppressing as it will be removed anyway
// eslint-disable-next-line @typescript-eslint/no-empty-interface,@typescript-eslint/no-unused-vars
interface RpcProcedure<TPayload = unknown, TResult = unknown> extends String {}

type RpcProcedurePayload<TProcedure> = TProcedure extends RpcProcedure<
  infer TPayload,
  // suppressing as it will be removed anyway
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  infer TResult
>
  ? TPayload
  : never;

// suppressing as it will be removed anyway
// eslint-disable-next-line @typescript-eslint/no-unused-vars
type RpcProcedureResult<TProcedure> = TProcedure extends RpcProcedure<infer TPayload, infer TResult>
  ? TResult
  : never;

export { RpcProcedure, RpcProcedurePayload, RpcProcedureResult };
