import type { Issue } from '../../issue';
import type { RpcProcedure } from '../../rpc';
import type { FilesChange } from '../FilesChange';
import type { FilesMatch } from '../FilesMatch';

// suppressing because it will be removed anyway
// eslint-disable-next-line @typescript-eslint/ban-types
const configure: RpcProcedure<object, void> = 'configure';
const getReport: RpcProcedure<{ change: FilesChange; watching: boolean }, void> = 'getReport';
const getDependencies: RpcProcedure<void, FilesMatch> = 'getDependencies';
const getIssues: RpcProcedure<void, Issue[]> = 'getIssues';
const closeReport: RpcProcedure<void, void> = 'closeReport';

export { configure, getReport, getDependencies, getIssues, closeReport };
