import { Reporter } from '../Reporter';
import { createRpcService, RpcMessagePort } from '../../rpc';
import {
  configure,
  getReport,
  getDependencies,
  getIssues,
  closeReport,
} from './ReporterRpcProcedure';
import { Report } from '../Report';

interface ReporterRpcService {
  isOpen: () => boolean;
  open: () => Promise<void>;
  close: () => Promise<void>;
}

function registerReporterRpcService<TConfiguration extends object>(
  servicePort: RpcMessagePort,
  reporterFactory: (configuration: TConfiguration) => Reporter
): ReporterRpcService {
  const rpcService = createRpcService(servicePort);
  let reporterRegistered = false;
  let report: Report | undefined = undefined;

  const registerReporter = () => {
    rpcService.addCallHandler(configure, async (configuration: TConfiguration) => {
      rpcService.removeCallHandler(configure);

      const reporter = reporterFactory(configuration);

      rpcService.addCallHandler(getReport, async ({ change, watching }) => {
        if (report) {
          throw new Error(`Close previous report before opening the next one.`);
        }

        report = await reporter.getReport(change, watching);
      });
      rpcService.addCallHandler(getDependencies, () => {
        if (!report) {
          throw new Error(`Cannot find active report.`);
        }

        return report.getDependencies();
      });
      rpcService.addCallHandler(getIssues, () => {
        if (!report) {
          throw new Error(`Cannot find active report.`);
        }

        return report.getIssues();
      });
      rpcService.addCallHandler(closeReport, async () => {
        report = undefined;
      });
    });
  };
  const unregisterReporter = () => {
    rpcService.removeCallHandler(configure);
    rpcService.removeCallHandler(getReport);
    rpcService.removeCallHandler(getDependencies);
    rpcService.removeCallHandler(getIssues);
    rpcService.removeCallHandler(closeReport);
  };

  return {
    isOpen: () => rpcService.isOpen() && reporterRegistered,
    open: async () => {
      if (!rpcService.isOpen()) {
        await rpcService.open();
      }

      if (!reporterRegistered) {
        registerReporter();
        reporterRegistered = true;
      }
    },
    close: async () => {
      if (reporterRegistered) {
        unregisterReporter();
        reporterRegistered = false;
      }

      if (rpcService.isOpen()) {
        await rpcService.close();
      }
    },
  };
}

export { ReporterRpcService, registerReporterRpcService };
