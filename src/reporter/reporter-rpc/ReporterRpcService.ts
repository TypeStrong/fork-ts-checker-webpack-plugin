import { Reporter } from '../Reporter';
import { createRpcService, RpcMessagePort } from '../../rpc';
import { configure, getIssues } from './ReporterRpcProcedure';

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

  const registerReporter = () => {
    rpcService.addCallHandler(configure, async (configuration: TConfiguration) => {
      rpcService.removeCallHandler(configure);

      const reporter = reporterFactory(configuration);
      rpcService.addCallHandler(getIssues, reporter.getReport);
    });
  };
  const unregisterReporter = () => {
    rpcService.removeCallHandler(configure);
    rpcService.removeCallHandler(getIssues);
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
