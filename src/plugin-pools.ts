import * as os from 'os';

import type { Pool } from './utils/async/pool';
import { createPool } from './utils/async/pool';

const issuesPool: Pool = createPool(Math.max(1, os.cpus().length));
const dependenciesPool: Pool = createPool(Math.max(1, os.cpus().length));

export { issuesPool, dependenciesPool };
