import { Reporter } from './Reporter';
import { OperationCanceledError } from '../error/OperationCanceledError';
import { aggregateFilesChanges, FilesChange } from './FilesChange';

/**
 * This higher order reporter aggregates too frequent getReport requests to avoid unnecessary computation.
 */
function createAggregatedReporter<TReporter extends Reporter>(reporter: TReporter): TReporter {
  let pendingReportPromise: Promise<unknown> | undefined;
  let queuedIndex = 0;
  let queuedChanges: FilesChange[] = [];

  const aggregatedReporter: TReporter = {
    ...reporter,
    getReport: async (change) => {
      if (!pendingReportPromise) {
        const reportPromise = reporter.getReport(change);
        pendingReportPromise = reportPromise
          .then(() => {
            // remove current pending - .finally() is supported starting from Node 10
            pendingReportPromise = undefined;
          })
          // ignore previous errors
          .catch(() => {
            // remove current pending - .finally() is supported starting from Node 10
            pendingReportPromise = undefined;
          });

        return reportPromise;
      } else {
        const currentIndex = ++queuedIndex;
        queuedChanges.push(change);

        return pendingReportPromise.then(() => {
          if (queuedIndex === currentIndex) {
            const change = aggregateFilesChanges(queuedChanges);
            queuedChanges = [];

            return aggregatedReporter.getReport(change);
          } else {
            throw new OperationCanceledError('getIssues canceled - new report requested.');
          }
        });
      }
    },
  };

  return aggregatedReporter;
}

export { createAggregatedReporter };
