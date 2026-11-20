import { getApi } from './api';
import { config } from './worker-config';

export function resetPerformanceIfNeeded() {
  if (config.profile) {
    getApi().resetTimingInfo();
  }
}

export function printPerformanceMeasuresIfNeeded() {
  if (config.profile) {
    const { totals } = getApi().getTimingInfo();
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
