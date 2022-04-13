import type { ChildProcess } from 'child_process';

import { RpcExitError, wrapRpc } from '../../../src/rpc';

describe('wrapRpc', () => {
  let childProcessMock: ChildProcess;
  let eventHandlers: Record<string, Array<(...args: unknown[]) => void>>;
  let messageIds: string[];

  beforeEach(() => {
    eventHandlers = {};
    messageIds = [];
    childProcessMock = {
      connected: true,
      pid: 1234,
      send: jest.fn((message, callback) => {
        messageIds.push(message?.id);
        callback();
      }),
      on: jest.fn((name, handlerToAdd) => {
        if (!eventHandlers[name]) {
          eventHandlers[name] = [];
        }
        eventHandlers[name].push(handlerToAdd);
      }),
      off: jest.fn((name, handlerToRemove) => {
        if (!eventHandlers[name]) {
          return;
        }
        eventHandlers[name] = eventHandlers[name].filter((handler) => handler !== handlerToRemove);
      }),
      // we don't have to implement all methods - it would take a lot of code to do so
    } as unknown as ChildProcess;
  });

  it('returns new functions without adding event handlers', () => {
    const wrapped = wrapRpc(childProcessMock);
    expect(wrapped).toBeInstanceOf(Function);
    expect(eventHandlers).toEqual({});
  });

  it("throws an error if child process doesn't have IPC channels", async () => {
    childProcessMock.send = undefined;
    const wrapped = wrapRpc(childProcessMock);
    await expect(wrapped()).rejects.toEqual(new Error("Process 1234 doesn't have IPC channels"));
    expect(eventHandlers).toEqual({});
  });

  it("throws an error if child process doesn't have open IPC channels", async () => {
    // @ts-expect-error We're using mock here :)
    childProcessMock.connected = false;
    const wrapped = wrapRpc(childProcessMock);
    await expect(wrapped()).rejects.toEqual(
      new Error("Process 1234 doesn't have open IPC channels")
    );
    expect(eventHandlers).toEqual({});
  });

  it('sends a call message', async () => {
    const wrapped = wrapRpc(childProcessMock);
    wrapped('foo', 1234);
    expect(childProcessMock.send).toHaveBeenCalledWith(
      {
        type: 'call',
        id: expect.any(String),
        args: ['foo', 1234],
      },
      expect.any(Function)
    );
    expect(eventHandlers).toEqual({
      message: [expect.any(Function)],
      close: [expect.any(Function)],
    });
  });

  it('ignores invalid message', async () => {
    const wrapped = wrapRpc<() => void>(childProcessMock);
    wrapped();
    expect(messageIds).toEqual([expect.any(String)]);
    expect(eventHandlers['message']).toEqual([expect.any(Function)]);
    const triggerMessage = eventHandlers['message'][0];

    triggerMessage(undefined);
    triggerMessage('test');
    triggerMessage({});
    triggerMessage({ id: 'test' });

    expect(eventHandlers).toEqual({
      message: [expect.any(Function)],
      close: [expect.any(Function)],
    });
  });

  it('resolves on valid resolve message', async () => {
    const wrapped = wrapRpc<() => void>(childProcessMock);
    const promise = wrapped();
    expect(messageIds).toEqual([expect.any(String)]);
    expect(eventHandlers['message']).toEqual([expect.any(Function)]);
    const triggerMessage = eventHandlers['message'][0];
    const id = messageIds[0];

    triggerMessage({
      id,
      type: 'resolve',
      value: 41,
    });

    expect(promise).resolves.toEqual(41);
    expect(eventHandlers).toEqual({
      message: [],
      close: [],
    });
  });

  it('rejects on valid reject message', async () => {
    const wrapped = wrapRpc<() => void>(childProcessMock);
    const promise = wrapped();
    expect(messageIds).toEqual([expect.any(String)]);
    expect(eventHandlers['message']).toEqual([expect.any(Function)]);
    const triggerMessage = eventHandlers['message'][0];
    const id = messageIds[0];

    triggerMessage({
      id,
      type: 'reject',
      error: 'sad error',
    });

    expect(promise).rejects.toEqual('sad error');
    expect(eventHandlers).toEqual({
      message: [],
      close: [],
    });
  });

  it('rejects on send error', async () => {
    (childProcessMock.send as jest.Mock).mockImplementation((message, callback) =>
      callback(new Error('cannot send'))
    );
    const wrapped = wrapRpc<() => void>(childProcessMock);

    expect(wrapped()).rejects.toEqual(new Error('cannot send'));
    expect(eventHandlers).toEqual({
      message: [],
      close: [],
    });
  });

  it.each([
    { code: 100, signal: 'SIGINT', message: 'Process 1234 exited with code 100 [SIGINT]' },
    { code: -1, signal: undefined, message: 'Process 1234 exited with code -1' },
    { code: undefined, signal: undefined, message: 'Process 1234 exited' },
  ])('rejects on process close with %p', async ({ code, signal, message }) => {
    const wrapped = wrapRpc<() => void>(childProcessMock);
    const promise = wrapped();
    expect(eventHandlers['close']).toEqual([expect.any(Function)]);
    const triggerClose = eventHandlers['close'][0];

    triggerClose(code, signal);

    expect(promise).rejects.toEqual(new RpcExitError(message, code, signal));
    expect(eventHandlers).toEqual({
      message: [],
      close: [],
    });
  });
});
