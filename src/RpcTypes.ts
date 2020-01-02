import { FileBasedCancellationTokenJSON } from './cancellation';
import { Message } from './Message';

export const RUN = 'run';
export type RunPayload = FileBasedCancellationTokenJSON;
export type RunResult =
  | Message
  // when run was cancelled via CancellationToken, undefined is returned
  | undefined;
