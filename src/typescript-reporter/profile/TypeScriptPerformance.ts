import * as ts from 'typescript';
import { Performance } from '../../profile/Performance';

interface TypeScriptPerformance {
  enable(): void;
  disable(): void;
  mark(name: string): void;
  measure(name: string, startMark?: string, endMark?: string): void;
}

function getTypeScriptPerformance(): TypeScriptPerformance | undefined {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (ts as any).performance;
}

function connectTypeScriptPerformance(performance: Performance): Performance {
  const typeScriptPerformance = getTypeScriptPerformance();

  if (typeScriptPerformance) {
    const { mark, measure } = typeScriptPerformance;
    const { enable, disable } = performance;

    typeScriptPerformance.mark = (name) => {
      mark(name);
      performance.mark(name);
    };
    typeScriptPerformance.measure = (name, startMark, endMark) => {
      measure(name, startMark, endMark);
      performance.measure(name, startMark, endMark);
    };

    return {
      ...performance,
      enable() {
        enable();
        typeScriptPerformance.enable();
      },
      disable() {
        disable();
        typeScriptPerformance.disable();
      },
    };
  } else {
    return performance;
  }
}

export { TypeScriptPerformance, connectTypeScriptPerformance };
