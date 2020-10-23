// create unique version for each test run to prevent npm/yarn from caching the plugin
import { join, resolve } from 'path';
import fs from 'fs-extra';
import { logger } from './Logger';
import os from 'os';

const FORK_TS_CHECKER_WEBPACK_PLUGIN_PATH = join(
  resolve(__dirname, '../../..'),
  'fork-ts-checker-webpack-plugin-0.0.0-semantic-release.tgz'
);

if (!fs.pathExistsSync(FORK_TS_CHECKER_WEBPACK_PLUGIN_PATH)) {
  throw new Error(
    `Cannot find ${FORK_TS_CHECKER_WEBPACK_PLUGIN_PATH} file. To run e2e test, execute "npm pack" command before.`
  );
} else {
  logger.log(`Found plugin package in ${FORK_TS_CHECKER_WEBPACK_PLUGIN_PATH}.`);
}

const FORK_TS_CHECKER_WEBPACK_PLUGIN_VERSION = join(
  fs.mkdtempSync(join(os.tmpdir(), 'fork-ts-checker-tmp-')),
  `fork-ts-checker-webpack-plugin-${Math.random().toFixed(10)}.tgz`
);
logger.log(`Copying plugin package to unique place: ${FORK_TS_CHECKER_WEBPACK_PLUGIN_VERSION}`);
fs.copyFileSync(FORK_TS_CHECKER_WEBPACK_PLUGIN_PATH, FORK_TS_CHECKER_WEBPACK_PLUGIN_VERSION);

export { FORK_TS_CHECKER_WEBPACK_PLUGIN_VERSION };
