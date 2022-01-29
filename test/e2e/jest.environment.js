// eslint-disable-next-line @typescript-eslint/no-var-requires
const NodeEnvironment = require('jest-environment-node');

function printBlock(message) {
  process.stdout.write('┏━' + '━'.repeat(message.length) + '━┓\n');
  process.stdout.write('┃ ' + message + ' ┃\n');
  process.stdout.write('┗━' + '━'.repeat(message.length) + '━┛\n');
}

class E2EEnvironment extends NodeEnvironment {
  constructor(config) {
    super(config);
  }

  async handleTestEvent(event) {
    switch (event.name) {
      case 'test_start':
        printBlock(`Test Start: ${event.test.name}`);
        break;

      case 'test_retry':
        printBlock(`Test Retry: ${event.test.name}`);
        break;

      case 'test_done':
        printBlock(`Test Done: ${event.test.name} (${Math.round(event.test.duration / 1000)}s)`);
        break;
    }
  }
}

module.exports = E2EEnvironment;
