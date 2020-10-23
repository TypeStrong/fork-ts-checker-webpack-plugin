import chalk from 'chalk';

interface Logger {
  log: (message: string) => void;
}

const logger: Logger = {
  log(message) {
    process.stdout.write(
      message
        .split('\n')
        .map((line) => chalk.grey(`$ ${line}`))
        .join('\n')
    );
    process.stdout.write('\n');
  },
};

export { Logger, logger };
