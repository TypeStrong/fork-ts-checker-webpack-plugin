import type * as ts from 'typescript';
import { Performance } from '../../profile/Performance';

interface TypeScriptPerformance {
  enable?(): void;
  disable?(): void;
  forEachMeasure?(callback: (measureName: string, duration: number) => void): void;
}

function getTypeScriptPerformance(typescript: typeof ts): TypeScriptPerformance | undefined {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (typescript as any).performance;
}

function connectTypeScriptPerformance(
  typescript: typeof ts,
  performance: Performance
): Performance {
  const typeScriptPerformance = getTypeScriptPerformance(typescript);

  if (typeScriptPerformance) {
    const { enable, disable } = performance;

    return {
      ...performance,
      enable() {
        enable();
        typeScriptPerformance.enable?.();
      },
      disable() {
        disable();
        typeScriptPerformance.disable?.();
      },
    };
  } else {
    return performance;
  }
}

export { TypeScriptPerformance, connectTypeScriptPerformance };
