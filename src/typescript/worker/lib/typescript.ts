import type * as ts from 'typescript';

import { config } from './worker-config';

// eslint-disable-next-line
export const typescript: typeof ts = require(config.typescriptPath);
