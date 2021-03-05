import { Reporter } from './Reporter';
import { OperationCanceledError } from '../error/OperationCanceledError';
import { aggregateFilesChanges, FilesChange } from './FilesChange';

/**
 * This higher order reporter aggregates too frequent getReport requests to avoid unnecessary computation.
 */
function createAggregatedReporter<TReporter extends Reporter>(reporter: TReporter): TReporter {
  let pendingPromise: Promise<unknown> | undefined;
  let queuedIndex = 0;
  let queuedChanges: FilesChange[] = [];

  const aggregatedReporter: TReporter = {
    ...reporter,
    getReport: async (change, watching) => {
      if (!pendingPromise) {
        let resolvePending: () => void;
        pendingPromise = new Promise((resolve) => {
          resolvePending = () => {
            resolve();
            pendingPromise = undefined;
          };
        });

        return reporter
          .getReport(change, watching)
          .then((report) => ({
            ...report,
            async close() {
              await report.close();
              resolvePending();
            },
          }))
          .catch((error) => {
            resolvePending();

            throw error;
          });
      } else {
        const currentIndex = ++queuedIndex;
        queuedChanges.push(change);

        return pendingPromise.then(() => {
          if (queuedIndex === currentIndex) {
            const change = aggregateFilesChanges(queuedChanges);
            queuedChanges = [];

            return aggregatedReporter.getReport(change, watching);
          } else {
            throw new OperationCanceledError('getReport canceled - new report requested.');
          }
        });
      }
    },
  };

  return aggregatedReporter;
}

export { createAggregatedReporter };
