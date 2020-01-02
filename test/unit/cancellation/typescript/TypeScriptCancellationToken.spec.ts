import {
  CancellationToken,
  TypeScriptCancellationToken
} from '../../../../lib/cancellation';
import * as ts from 'typescript';

class OperationCanceledException {}

describe('[UNIT] cancellation/typescript/FileBasedCancellationToken', () => {
  let cancellationRequested: boolean;
  let typescript: typeof ts;
  let sourceToken: CancellationToken;
  let token: TypeScriptCancellationToken;

  beforeEach(() => {
    cancellationRequested = true;
    sourceToken = {
      isCancellationRequested: jest.fn(() => cancellationRequested),
      requestCancellation: jest.fn(),
      cleanupCancellation: jest.fn()
    };
    typescript = ({
      OperationCanceledException
    } as unknown) as typeof ts;
    token = new TypeScriptCancellationToken(typescript, sourceToken);
  });

  it('proxies CancellationToken methods', () => {
    cancellationRequested = false;
    expect(token.isCancellationRequested()).toEqual(false);
    expect(sourceToken.isCancellationRequested).toHaveBeenCalledTimes(1);
    expect(sourceToken.requestCancellation).toHaveBeenCalledTimes(0);
    expect(sourceToken.cleanupCancellation).toHaveBeenCalledTimes(0);

    cancellationRequested = true;
    expect(token.isCancellationRequested()).toEqual(true);
    expect(sourceToken.isCancellationRequested).toHaveBeenCalledTimes(2);
    expect(sourceToken.requestCancellation).toHaveBeenCalledTimes(0);
    expect(sourceToken.cleanupCancellation).toHaveBeenCalledTimes(0);

    expect(token.requestCancellation()).toBeUndefined();
    expect(sourceToken.isCancellationRequested).toHaveBeenCalledTimes(2);
    expect(sourceToken.requestCancellation).toHaveBeenCalledTimes(1);
    expect(sourceToken.cleanupCancellation).toHaveBeenCalledTimes(0);

    expect(token.cleanupCancellation()).toBeUndefined();
    expect(sourceToken.isCancellationRequested).toHaveBeenCalledTimes(2);
    expect(sourceToken.requestCancellation).toHaveBeenCalledTimes(1);
    expect(sourceToken.cleanupCancellation).toHaveBeenCalledTimes(1);
  });

  it('throws a TypeScript specific error', () => {
    cancellationRequested = false;
    expect(() => token.throwIfCancellationRequested()).not.toThrowError();

    cancellationRequested = true;
    expect(() => token.throwIfCancellationRequested()).toThrowError(
      typescript.OperationCanceledException
    );
  });
});
