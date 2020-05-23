import { Reporter } from '../Reporter';
import { createRpcClient, RpcMessageChannel } from '../../rpc';
import { configure, getIssues } from './ReporterRpcProcedure';
import flatten from '../../utils/array/flatten';

interface ReporterRpcClient extends Reporter {
  isConnected: () => boolean;
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
}

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
        await rpcClient.connect();
        await rpcClient.dispatchCall(configure, configuration);
      }
    },
    disconnect: async () => {
      if (channel.isOpen()) {
        await channel.close();
      }
      if (rpcClient.isConnected()) {
        await rpcClient.disconnect();
      }
    },
    getReport: async (change) => await rpcClient.dispatchCall(getIssues, change),
  };
}

function composeReporterRpcClients(clients: ReporterRpcClient[]): ReporterRpcClient {
  return {
    isConnected: () => clients.every((client) => client.isConnected()),
    connect: () => Promise.all(clients.map((client) => client.connect())).then(() => undefined),
    disconnect: () =>
      Promise.all(clients.map((client) => client.disconnect())).then(() => undefined),
    getReport: async (change) =>
      Promise.all(clients.map((client) => client.getReport(change))).then((issues) =>
        flatten(issues)
      ),
  };
}

export { ReporterRpcClient, createReporterRpcClient, composeReporterRpcClients };
