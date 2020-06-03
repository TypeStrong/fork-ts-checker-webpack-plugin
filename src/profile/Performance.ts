import { performance } from 'perf_hooks';

interface Performance {
  enable(): void;
  disable(): void;
  mark(name: string): void;
  markStart(name: string): void;
  markEnd(name: string): void;
  measure(name: string, startMark?: string, endMark?: string): void;
  print(): void;
}

function createPerformance(): Performance {
  let enabled = false;
  let timeOrigin: number;
  let marks: Map<string, number>;
  let measurements: Map<string, number>;

  function enable() {
    enabled = true;
    marks = new Map();
    measurements = new Map();
    timeOrigin = performance.now();
  }

  function disable() {
    enabled = false;
  }

  function mark(name: string) {
    if (enabled) {
      marks.set(name, performance.now());
    }
  }

  function measure(name: string, startMark?: string, endMark?: string) {
    if (enabled) {
      const start = (startMark && marks.get(startMark)) || timeOrigin;
      const end = (endMark && marks.get(endMark)) || performance.now();

      measurements.set(name, (measurements.get(name) || 0) + (end - start));
    }
  }

  function markStart(name: string) {
    if (enabled) {
      mark(`${name} start`);
    }
  }

  function markEnd(name: string) {
    if (enabled) {
      mark(`${name} end`);
      measure(name, `${name} start`, `${name} end`);
    }
  }

  function formatName(name: string, width = 0) {
    return `${name}:`.padEnd(width);
  }

  function formatDuration(duration: number, width = 0) {
    return `${(duration / 1000).toFixed(2)} s`.padStart(width);
  }

  function print() {
    if (enabled) {
      let nameWidth = 0;
      let durationWidth = 0;

      measurements.forEach((duration, name) => {
        nameWidth = Math.max(nameWidth, formatName(name).length);
        durationWidth = Math.max(durationWidth, formatDuration(duration).length);
      });

      measurements.forEach((duration, name) => {
        console.log(`${formatName(name, nameWidth)} ${formatDuration(duration, durationWidth)}`);
      });
    }
  }

  return { enable, disable, mark, markStart, markEnd, measure, print };
}

export { Performance, createPerformance };
