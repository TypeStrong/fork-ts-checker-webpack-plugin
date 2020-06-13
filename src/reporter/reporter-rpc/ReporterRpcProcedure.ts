import { RpcProcedure } from '../../rpc';
import { FilesChange } from '../FilesChange';
import { Issue } from '../../issue';

const configure: RpcProcedure<object, void> = 'configure';
const getIssues: RpcProcedure<FilesChange, Issue[]> = 'getIssues';

export { configure, getIssues };
