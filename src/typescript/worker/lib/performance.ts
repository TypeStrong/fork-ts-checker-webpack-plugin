import { typescript } from './typescript';
import { config } from './worker-config';

interface TypeScriptPerformance {
  enable?(): void;
  disable?(): void;
  forEachMeasure?(callback: (measureName: string, duration: number) => void): void;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const performance: TypeScriptPerformance | undefined = (typescript as any).performance;

export function enablePerformanceIfNeeded() {
  if (config.profile) {
    performance?.enable?.();
  }
}

export function disablePerformanceIfNeeded() {
  if (config.profile) {
    performance?.disable?.();
  }
}

export function printPerformanceMeasuresIfNeeded() {
  if (config.profile) {
    const measures: Record<string, number> = {};
    performance?.forEachMeasure?.((measureName, duration) => {
      measures[measureName] = duration;
    });
    console.table(measures);
  }
}
