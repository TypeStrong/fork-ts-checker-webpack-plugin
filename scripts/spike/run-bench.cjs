// SPIKE: compares chokidar 4 with Node's recursive fs.watch on generated trees.
// usage: node scripts/spike/run-bench.cjs
const { spawnSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const RUNS = 3;
const TREES = [
  { name: '50 files', srcDirs: 5, nodeModulesDirs: 0 },
  { name: '2,000 files', srcDirs: 200, nodeModulesDirs: 0 },
  { name: '2,000 files + 40,000 in ignored node_modules', srcDirs: 200, nodeModulesDirs: 4000 },
  { name: '20,000 files', srcDirs: 2000, nodeModulesDirs: 0 },
];
const IMPLS = ['chokidar', 'chokidar-plain', 'native'];

function fill(base, dirs, extension) {
  for (let d = 0; d < dirs; d++) {
    const dir = path.join(base, `g${d % 20}`, `d${d}`);
    fs.mkdirSync(dir, { recursive: true });
    for (let f = 0; f < 10; f++)
      fs.writeFileSync(path.join(dir, `f${f}.${extension}`), 'export {}');
  }
}

const median = (values) => {
  const numbers = values.filter((value) => typeof value === 'number');
  if (numbers.length < values.length || !numbers.length) return '-';
  return numbers.sort((a, b) => a - b)[Math.floor(numbers.length / 2)];
};

const lines = [
  `### Watcher benchmark: ${os.platform()} ${os.release()}, Node ${process.version}, ${os.cpus().length} CPUs`,
  '',
  "`chokidar` = the plugin's options (with `awaitWriteFinish`), `chokidar-plain` = without it, `native` = `fs.watch(dir, { recursive: true })`. Medians of " +
    RUNS +
    ' runs.',
  '',
  '| Tree | Watcher | Setup ms | Setup CPU ms | First event ms | RSS +MB | Handles | New file latency ms | 500 files: all seen ms | 500 files: seen | 500 files: CPU ms | Error |',
  '| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |',
];

const base = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), 'watch-bench-'));
for (const [index, tree] of TREES.entries()) {
  const root = path.join(base, `tree${index}`);
  fs.mkdirSync(path.join(root, 'src'), { recursive: true });
  fill(path.join(root, 'src'), tree.srcDirs, 'ts');
  if (tree.nodeModulesDirs) fill(path.join(root, 'node_modules'), tree.nodeModulesDirs, 'js');

  for (const impl of IMPLS) {
    const results = [];
    for (let run = 0; run < RUNS; run++) {
      const child = spawnSync(
        process.execPath,
        ['--expose-gc', path.join(__dirname, 'watch-bench.cjs'), impl, root],
        { encoding: 'utf8', timeout: 120000 }
      );
      const line = (child.stdout || '').trim().split('\n').pop();
      try {
        results.push(JSON.parse(line));
      } catch (error) {
        const stderr = (child.stderr || '').match(/\b(E[A-Z]{4,})\b/);
        results.push({
          error: stderr ? `crashed: ${stderr[1]}` : `crashed (exit ${child.status})`,
        });
      }
      console.error(
        `${tree.name} / ${impl} / run ${run + 1}: ${JSON.stringify(results[results.length - 1])}`
      );
      if (results[results.length - 1].error) {
        // a failure is slow to reproduce and won't change
        break;
      }
    }
    const column = (key) => median(results.map((result) => result[key]));
    const errors = [...new Set(results.map((result) => result.error).filter(Boolean))].join(', ');
    lines.push(
      `| ${tree.name} | ${impl} | ${column('setupMs')} | ${column('setupCpuMs')} | ${column('firstEventMs')} | ${column('rssDeltaMb')} | ${column('handles')} | ${column('latencyMs')} | ${column('burstMs')} | ${column('burstSeen')} | ${column('burstCpuMs')} | ${errors} |`
    );
  }
  fs.rmSync(root, { recursive: true, force: true });
}
fs.rmSync(base, { recursive: true, force: true });

const report = lines.join('\n') + '\n';
console.log(report);
if (process.env.GITHUB_STEP_SUMMARY) {
  fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, report + '\n');
}
