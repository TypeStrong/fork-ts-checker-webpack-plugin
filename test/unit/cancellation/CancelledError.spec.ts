import { CancelledError } from '../../../lib/cancellation';

describe('[UNIT] cancellation/CancelledError', () => {
  it('defines CancelledError with default message', () => {
    const error = new CancelledError();

    expect(error).toBeInstanceOf(Error);
    expect(error.message).toEqual('Operation has been cancelled.');
  });

  it('allows to pass custom message', () => {
    const error = new CancelledError('Fetching has been cancelled.');

    expect(error.message).toEqual('Fetching has been cancelled.');
  });
});
