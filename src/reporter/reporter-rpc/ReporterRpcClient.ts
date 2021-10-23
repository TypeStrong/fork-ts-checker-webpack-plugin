import type { RpcMessageChannel } from '../../rpc';
import { createRpcClient } from '../../rpc';
import flatten from '../../utils/array/flatten';
import type { FilesChange } from '../FilesChange';
import type { Reporter } from '../Reporter';

import {
  configure,
  getReport,
  getDependencies,
  getIssues,
  closeReport,
} from './ReporterRpcProcedure';

interface ReporterRpcClient extends Reporter {
  isConnected: () => boolean;
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
}

// suppressing because it will be removed anyway
// eslint-disable-next-line @typescript-eslint/ban-types
function createReporterRpcClient<TConfiguration extends object>(
  channel: RpcMessageChannel,
  configuration: TConfiguration
): ReporterRpcClient {
  const rpcClient = createRpcClient(channel.clientPort);

  return {
    isConnected: () => channel.isOpen() && rpcClient.isConnected(),
    connect: async () => {
      if (!channel.isOpen()) {
        await channel.open();
      }
      if (!rpcClient.isConnected()) {
        try {
          await rpcClient.connect();
          await rpcClient.dispatchCall(configure, configuration);
        } catch (error) {
          // connect or configure was not successful -
          // close the reporter and re-throw an error
          await rpcClient.disconnect();
          await channel.close();
          throw error;
        }
      }
    },
    disconnect: async () => {
      if (rpcClient.isConnected()) {
        await rpcClient.disconnect();
      }
      if (channel.isOpen()) {
        await channel.close();
      }
    },
    getReport: async (change, watching) => {
      const reportId = await rpcClient.dispatchCall(getReport, { change, watching });

      return {
        getDependencies() {
          return rpcClient.dispatchCall(getDependencies, reportId);
        },
        getIssues() {
          return rpcClient.dispatchCall(getIssues, reportId);
        },
        close() {
          return rpcClient.dispatchCall(closeReport, reportId);
        },
      };
    },
  };
}

function composeReporterRpcClients(clients: ReporterRpcClient[]): ReporterRpcClient {
  return {
    isConnected: () => clients.every((client) => client.isConnected()),
    connect: () => Promise.all(clients.map((client) => client.connect())).then(() => undefined),
    disconnect: () =>
      Promise.all(clients.map((client) => client.disconnect())).then(() => undefined),
    getReport: (change: FilesChange, watching: boolean) =>
      Promise.all(clients.map((client) => client.getReport(change, watching))).then((reports) => ({
        getDependencies: () =>
          Promise.all(reports.map((report) => report.getDependencies())).then((dependencies) =>
            dependencies.reduce(
              (mergedDependencies, singleDependencies) => ({
                files: Array.from(
                  new Set([...mergedDependencies.files, ...singleDependencies.files])
                ),
                dirs: Array.from(new Set([...mergedDependencies.dirs, ...singleDependencies.dirs])),
                excluded: Array.from(
                  new Set([...mergedDependencies.excluded, ...singleDependencies.excluded])
                ),
                extensions: Array.from(
                  new Set([...mergedDependencies.extensions, ...singleDependencies.extensions])
                ),
              }),
              { files: [], dirs: [], excluded: [], extensions: [] }
            )
          ),
        getIssues: () =>
          Promise.all(reports.map((report) => report.getIssues())).then((issues) =>
            flatten(issues)
          ),
        close: () => Promise.all(reports.map((report) => report.close())).then(() => undefined),
      })),
  };
}

export { ReporterRpcClient, createReporterRpcClient, composeReporterRpcClients };
