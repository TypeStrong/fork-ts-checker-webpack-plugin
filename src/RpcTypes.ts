import { CancellationTokenData } from './CancellationToken';
import { Message } from './Message';

export const RUN = 'run';
export type RunPayload = CancellationTokenData;
export type RunResult =
  | Message
  // when run was cancelled via CancellationToken, undefined is returned
  | undefined;
