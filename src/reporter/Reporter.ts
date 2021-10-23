import type { FilesChange } from './FilesChange';
import type { Report } from './Report';

interface Reporter {
  getReport(change: FilesChange, watching: boolean): Promise<Report>;
}

export { Reporter };
