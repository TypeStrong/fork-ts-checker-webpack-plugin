jest.setTimeout(300000);

interface JasmineResult {
  id: string;
  description: string;
  fullName: string;
  testPath: string;
}

if (process.argv.includes('--verbose')) {
  // add boundaries between tests outputs for better debugging experience
  const testsStarted = new Map<string, number>();

  // eslint-disable-next-line
  (jasmine as any).getEnv().addReporter({
    specStarted: (result: JasmineResult) => {
      testsStarted.set(result.id, Date.now());

      const message = `Starting test: ${result.fullName}`;
      const separator = '='.repeat(message.length);
      process.stdout.write(`\n${separator}\n${message}\n${separator}\n\n`);
    },
    specDone: (result: JasmineResult) => {
      const started = testsStarted.get(result.id);
      const duration = started ? Date.now() - started : undefined;

      let message = `Finishing test: ${result.fullName}`;
      if (duration) {
        message += `, Duration: ${duration / 1000} s`;
      }

      const separator = '='.repeat(message.length);

      process.stdout.write(`\n${separator}\n${message}\n${separator}\n\n`);
    },
  });
}
