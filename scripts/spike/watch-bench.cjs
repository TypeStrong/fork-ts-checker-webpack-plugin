// SPIKE: measures one watcher on one directory tree, prints a JSON line.
// usage: node --expose-gc watch-bench.cjs <chokidar|chokidar-plain|native> <dir>
const fs = require('fs');
const path = require('path');

const impl = process.argv[2];
const root = process.argv[3];
const src = path.join(root, 'src');
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const isIgnored = (file) => /[\\/]node_modules([\\/]|$)/.test(file) || /[\\/]\.git[\\/]/.test(file);
const mb = (bytes) => Math.round((bytes / 1024 / 1024) * 10) / 10;
const ms = (from) => Math.round(Number(process.hrtime.bigint() - from) / 1e6);
const median = (values) => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)];

let onAdd = () => {};
let watchError;
const noteError = (error) => {
  watchError = watchError || error.code || error.message;
};

async function start() {
  if (impl === 'native') {
    const watcher = fs.watch(root, { recursive: true }, (eventType, fileName) => {
      if (!fileName) return;
      const file = path.join(root, fileName);
      if (path.extname(file) !== '.ts' || isIgnored(file)) return;
      onAdd(file);
    });
    watcher.on('error', noteError);
    return watcher;
  }
  const chokidar = require('chokidar');
  // the options the plugin uses
  const watcher = chokidar.watch(root, {
    ignoreInitial: true,
    ignorePermissionErrors: true,
    ignored: (file) => isIgnored(file),
    alwaysStat: true,
    atomic: true,
    awaitWriteFinish: impl === 'chokidar',
  });
  watcher.on('add', (file) => onAdd(file));
  watcher.on('error', noteError);
  await Promise.race([new Promise((resolve) => watcher.on('ready', resolve)), sleep(30000)]);
  return watcher;
}

(async () => {
  const created = [];
  const write = (file) => {
    created.push(file);
    fs.writeFileSync(file, 'export {}');
  };
  const result = { impl };
  try {
    global.gc();
    const before = process.memoryUsage();
    const cpu0 = process.cpuUsage();
    const t0 = process.hrtime.bigint();
    const watcher = await start();
    result.setupMs = ms(t0);
    const setupCpu = process.cpuUsage(cpu0);
    result.setupCpuMs = Math.round((setupCpu.user + setupCpu.system) / 1000);
    if (watchError) {
      // the watcher couldn't watch the whole tree - the rest would measure nothing useful
      throw new Error(String(watchError));
    }

    // the watcher can report "ready" before it really delivers events
    let working = false;
    onAdd = (file) => {
      if (path.basename(file).startsWith('bench-probe-')) working = true;
    };
    for (let i = 0; !working && ms(t0) < result.setupMs + 15000; i++) {
      write(path.join(src, `bench-probe-${i}.ts`));
      await sleep(100);
    }
    result.firstEventMs = working ? ms(t0) : null;

    await sleep(impl === 'chokidar' ? 2500 : 300);
    global.gc();
    const after = process.memoryUsage();
    result.rssDeltaMb = mb(after.rss - before.rss);
    result.heapDeltaMb = mb(after.heapUsed - before.heapUsed);
    result.handles = process._getActiveHandles().length;

    // latency: one new file at a time
    const latencies = [];
    for (let i = 0; i < 5; i++) {
      const file = path.join(src, `bench-latency-${i}.ts`);
      const seen = new Promise((resolve) => {
        onAdd = (added) => added === file && resolve(true);
      });
      const written = process.hrtime.bigint();
      write(file);
      const ok = await Promise.race([seen, sleep(8000).then(() => false)]);
      latencies.push(ok ? ms(written) : Infinity);
      await sleep(200);
    }
    const latency = median(latencies);
    result.latencyMs = Number.isFinite(latency) ? latency : null;

    // burst: many new files at once
    const burstDir = path.join(src, 'bench-burst');
    fs.mkdirSync(burstDir, { recursive: true });
    await sleep(1000);
    const BURST = 500;
    const got = new Set();
    let burstDone;
    const allSeen = new Promise((resolve) => (burstDone = resolve));
    onAdd = (file) => {
      if (file.startsWith(burstDir)) {
        got.add(file);
        if (got.size === BURST) burstDone(true);
      }
    };
    const cpu1 = process.cpuUsage();
    const b0 = process.hrtime.bigint();
    for (let i = 0; i < BURST; i++) fs.writeFileSync(path.join(burstDir, `f${i}.ts`), 'export {}');
    const all = await Promise.race([allSeen, sleep(20000).then(() => false)]);
    result.burstMs = all ? ms(b0) : null;
    result.burstSeen = got.size;
    const burstCpu = process.cpuUsage(cpu1);
    result.burstCpuMs = Math.round((burstCpu.user + burstCpu.system) / 1000);

    onAdd = () => {};
    await Promise.race([Promise.resolve(watcher.close()), sleep(5000)]);
    fs.rmSync(burstDir, { recursive: true, force: true });
  } catch (error) {
    noteError(error);
  }
  for (const file of created) fs.rmSync(file, { force: true });
  if (watchError) result.error = String(watchError);
  console.log(JSON.stringify(result));
  process.exit(0);
})();
