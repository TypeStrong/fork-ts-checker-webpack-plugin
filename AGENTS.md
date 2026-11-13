# AGENTS.md

Guidance for coding agents working on **fork-ts-checker-webpack-plugin**. For commit format, PR process and releases, see [CONTRIBUTING.md](CONTRIBUTING.md).

The plugin type-checks a webpack build in a forked worker, using TypeScript 7.1's native `typescript/sync` API (the Go compiler, tsgo). It requires TypeScript >= 7.1.0-beta and Node.js >= 22.12. TypeScript 3.6 to 6.x is supported by v9 only.

## Commands

| Task | Command |
| --- | --- |
| Install | `yarn install` (Yarn 4, see `packageManager`) |
| Type-check and lint | `yarn lint` (tsgo for `src` and `test`, then oxlint) |
| Formatting | `yarn format:check` (prettier) |
| Build | `yarn build` (output in `lib/`) |
| Unit tests | `yarn test:unit` |
| e2e tests | `yarn build && yarn test:e2e` |

The pre-commit hook runs lint-staged, `yarn build` and `yarn test:unit`.

### Running e2e tests

- **Build first.** `test:e2e` runs `npm pack`, which packs whatever is in `lib/`. Without `yarn build`, you test a stale build.
- **Run single specs with `node_modules/.bin/jest`, not `npx jest`.** `npx` puts the project's own `npm` (a semantic-release dependency) first on `PATH`, and sandbox setup fails with `glob is not a function`:

  ```bash
  yarn build && npm pack && YARN_ENABLE_IMMUTABLE_INSTALLS=false \
    node_modules/.bin/jest --config=test/e2e/jest.config.js --ci -i test/e2e/<spec>.ts -t "<name>"
  ```

- Each e2e test copies a fixture from `test/e2e/fixtures/` into a sandbox and installs it with Yarn's `node-modules` linker. The native compiler can't resolve through Plug'n'Play.
- Don't run prettier over `test/e2e/fixtures/`. The fixtures are test inputs, not project code.

## Architecture

- `src/plugin.ts` and `src/hooks/`: webpack integration. They start two RPC workers (`src/rpc/`).
- `src/typescript/worker/get-issues-worker.ts`: type checking. Its try/catch resets the program, the orchestrator and the API after any error, so a dead compiler process recovers on the next run. Keep every native API call inside it.
- `src/typescript/worker/get-dependencies-worker.ts`: computes the files and directories webpack should watch. It runs its own native compiler process and has the same reset-on-error handling.
- `src/typescript/worker/lib/`:
  - `api.ts`: creates the `API`, plus the file system callbacks that keep build-mode outputs in memory according to `mode`.
  - `config.ts`: reads and parses tsconfig with the implicit and `configOverwrite` overrides.
  - `dependencies.ts`: works out watched files and directories, `extends` chains and `${configDir}`.
  - `program/program.ts`: normal mode, a synthetic program in a snapshot.
  - `program/solution-builder.ts`: `build: true`, using the build orchestrator.
- `src/typescript/type-script-package.ts`: finds the TypeScript package from `typescriptPath`, which can be the package directory or any file inside it. TypeScript 7 has no `main`, and its entry points are only reachable through `exports`.

## Native API behaviour

These were found against `7.1.0-beta`. Re-check them on newer TypeScript versions before relying on a workaround.

**Snapshots and programs**

- Synthetic programs (`createPrograms` with raw options) make `configOverwrite` possible.
- `snapshot.update` needs `ensurePrograms: true`, or changed files keep their old contents.
- `removePrograms` and `createPrograms` in one update crash the compiler process. Reconfigure the program in place instead (microsoft/TypeScript#64911).
- A newly created file can be sent as `changed`. Failed imports of it resolve on the next update.

**Emit**

- Synthetic programs never write `.tsbuildinfo`, so `write-tsbuildinfo` and `write-references` need `build: true`.
- `emit(EmitOnly.OnlyDts)` and `emitToString(...)` work. Take `EmitOnly` from the runtime `typescriptSync` module, not from `import 'typescript/sync'`, so `typescriptPath` is honoured.

**Build orchestrator**

- `API#createBuildOrchestrator` works but is `@internal`, so it's missing from the typings (microsoft/TypeScript#64709).
- Its `force` option is ignored, and it ignores a `skipLibCheck` override; `tsc --build` rejects that option (TS5094).
- It returns one flat list of diagnostics, so `diagnosticOptions` can't apply in build mode.
- An existing orchestrator notices file edits and added files itself.
- A **new** orchestrator decides what's up to date by comparing input mtimes with the `.tsbuildinfo` mtime from `stat`. In-memory outputs must report their real write time: reporting "now" makes every project look up to date after a config change.

**Config parsing**

- `ParsedCommandLine` has no `wildcardDirectories` and no list of extended files. Derive both yourself.
- `raw.include` already contains `include` patterns inherited through `extends`.
- `${configDir}` is kept literally in `raw.include` and `raw.exclude`. Replace it with the directory the config was parsed against, as the compiler does: `context` for the root config.
- With `{ configDirectory }`, the root config's relative `extends` and `${configDir}` both resolve against that directory (the `context` option), not the tsconfig's own directory.

**Other**

- `generateTrace` produces no traces through the API (microsoft/TypeScript#65485).
- TypeScript 7 accepts `noEmit` together with `emitDeclarationOnly`.

To check a claim about the API, a small `.mjs` script importing `node_modules/typescript/dist/api/sync/api.js` settles it in seconds. If the API is constructed with `fs` callbacks, every callback must be given, even if only as `serverFS.useOS`.

## Decisions already made

Reviews of the TypeScript 7 migration raised these repeatedly. They were checked and kept deliberately; revisit them only with new evidence.

- **Forced `noEmit` in `readonly` mode.** It avoids emit-only option errors such as TS5011, matching `tsc --noEmit`.
- **Ignoring `.tsbuildinfo` this worker didn't write, in the in-memory modes.** One left by an earlier run, or by a run in another mode, could mark projects as built while their `.d.ts` files are missing. The cost is a full first check after a restart, which the README documents.
- **`write-dts` re-emits every declaration and writes only changed files.** Reading the existing files back is cheap next to `emitToString`'s round trip to the compiler.
- **No negative cache in `toOutputPath`.** Each callback is already a round trip to the Go process, and a cache of missing directories would go stale when packages are installed during watch.
- **A second compiler process in the dependencies worker.** It's a known cost, not a bug.
- **`configOverwrite` wins over each mode's implicit overrides,** in both normal and build mode.

## Working practices

- **Prove a fix with a test that fails without it.** Stash the source change, run `yarn build && npm pack`, and run the new test to see it fail. Then restore the change and rebuild.
- **Keep the README in step.** It documents option behaviour, including the build-mode limits: `configOverwrite`, `diagnosticOptions` and `skipLibCheck`.
- **Keep commits focused.** Separate unrelated changes, such as editor settings, from fixes.
