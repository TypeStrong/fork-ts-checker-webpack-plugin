import type { TypeScriptWorkerConfig } from '../type-script-worker-config';

import type { ApiHost } from './api';

export async function resetPerformanceIfNeeded(
  config: TypeScriptWorkerConfig,
  { getApi }: ApiHost
) {
  if (config.profile) {
    await getApi().resetTimingInfo();
  }
}

export async function printPerformanceMeasuresIfNeeded(
  config: TypeScriptWorkerConfig,
  { getApi }: ApiHost
) {
  if (config.profile) {
    const { totals } = await getApi().getTimingInfo();
    console.table({
      Requests: totals.requestCount,
      'Round trip (ms)': Math.round(totals.roundTripMs),
      'Compiler (ms)': Math.round(totals.serverTimeMs),
      'Transport (ms)': Math.round(totals.roundTripMs - totals.serverTimeMs),
      'Sent (bytes)': totals.bytesSent,
      'Received (bytes)': totals.bytesReceived,
    });
  }
}
