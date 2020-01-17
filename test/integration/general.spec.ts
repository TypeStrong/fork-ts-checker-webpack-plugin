import path from 'path';
import ForkTsCheckerWebpackPlugin from '../../lib/index';
import * as helpers from './helpers';
import { cloneDeep } from 'lodash';
import unixify from 'unixify';
import * as semver from 'semver';

describe.each([[true], [false]])(
  '[INTEGRATION] common tests - useTypescriptIncrementalApi: %s',
  useTypescriptIncrementalApi => {
    let compilerPlugin: ForkTsCheckerWebpackPlugin;

    const overrideOptions = { useTypescriptIncrementalApi };

    function createCompiler(
      options: Partial<helpers.CreateCompilerOptions> = {}
    ) {
      const compiler = helpers.createCompiler({
        ...options,
        pluginOptions: { ...options.pluginOptions, ...overrideOptions }
      });
      compilerPlugin = compiler.plugin;
      return compiler.compiler;
    }

    const ifNotIncrementalIt = useTypescriptIncrementalApi ? it.skip : it;
    const ifNodeGte8It = semver.lt(process.version, '8.10.0') ? it.skip : it;
    const ifNodeLt8It = semver.lt(process.version, '8.10.0') ? it : it.skip;

    /**
     * Implicitly check whether killService was called by checking that
     * the service property was set to undefined.
     * @returns [boolean] true if killService was called
     */
    function killServiceWasCalled() {
      return compilerPlugin['service'] === undefined;
    }

    it('should allow to pass no options', () => {
      expect(() => {
        new ForkTsCheckerWebpackPlugin();
      }).not.toThrowError();
    });

    it('should detect paths', () => {
      const plugin = new ForkTsCheckerWebpackPlugin({});

      expect(plugin['tsconfig']).toBe('./tsconfig.json');
    });

    it('should set logger to console by default', () => {
      const plugin = new ForkTsCheckerWebpackPlugin({});

      expect(plugin['logger']).toBe(console);
    });

    it('should find semantic errors', callback => {
      const compiler = createCompiler({
        pluginOptions: {
          tsconfig: 'tsconfig-semantic-error-only.json'
        }
      });

      compiler.run((err, stats) => {
        expect(stats.compilation.errors.length).toBeGreaterThanOrEqual(1);
        callback();
      });
    });

    it('should support custom resolution', callback => {
      const compiler = createCompiler({
        pluginOptions: {
          tsconfig: 'tsconfig-weird-resolutions.json',
          resolveModuleNameModule: path.resolve(
            __dirname,
            '../fixtures/project/',
            'weirdResolver.js'
          ),
          resolveTypeReferenceDirectiveModule: path.resolve(
            __dirname,
            '../fixtures/project/',
            'weirdResolver.js'
          )
        }
      });

      compiler.run((err, stats) => {
        expect(stats.compilation.errors.length).toBe(0);
        callback();
      });
    });

    ifNotIncrementalIt(
      'should support custom resolution w/ "paths"',
      callback => {
        const compiler = createCompiler({
          pluginOptions: {
            tsconfig: 'tsconfig-weird-resolutions-with-paths.json',
            resolveModuleNameModule: path.resolve(
              __dirname,
              '../fixtures/project/',
              'weirdResolver.js'
            ),
            resolveTypeReferenceDirectiveModule: path.resolve(
              __dirname,
              '../fixtures/project/',
              'weirdResolver.js'
            )
          }
        });

        compiler.run((err, stats) => {
          expect(stats.compilation.errors.length).toBe(0);
          callback();
        });
      }
    );

    ifNodeGte8It('should detect eslints', callback => {
      const compiler = createCompiler({
        context: './project_eslint',
        entryPoint: './src/index.ts',
        pluginOptions: { eslint: true }
      });

      compiler.run((err, stats) => {
        const { warnings, errors } = stats.compilation;
        expect(warnings.length).toBe(2);

        const [warning, warning2] = warnings;
        const actualFile = unixify(warning.file);
        const expectedFile = unixify('src/lib/func.ts');
        expect(actualFile).toContain(expectedFile);
        expect(warning.rawMessage).toContain('WARNING');
        expect(warning.rawMessage).toContain('@typescript-eslint/array-type');
        expect(warning.rawMessage).toContain(
          "Array type using 'Array<string>' is forbidden. Use 'string[]' instead."
        );
        expect(warning.location).toEqual({
          character: 44,
          line: 3
        });

        const actualFile2 = unixify(warning2.file);
        const expectedFile2 = unixify('src/lib/otherFunc.js');
        expect(actualFile2).toContain(expectedFile2);
        expect(warning2.rawMessage).toContain('WARNING');
        expect(warning2.rawMessage).toContain(
          '@typescript-eslint/no-unused-vars'
        );
        expect(warning2.rawMessage).toContain(
          "'i' is assigned a value but never used."
        );
        expect(warning2.location).toEqual({
          character: 5,
          line: 4
        });

        const error = errors.find(err =>
          err.rawMessage.includes('@typescript-eslint/array-type')
        );
        const actualErrorFile = unixify(error.file);
        const expectedErrorFile = unixify('src/index.ts');
        expect(actualErrorFile).toContain(expectedErrorFile);
        expect(error.rawMessage).toContain('ERROR');
        expect(error.rawMessage).toContain('@typescript-eslint/array-type');
        expect(error.rawMessage).toContain(
          "Array type using 'Array<string>' is forbidden. Use 'string[]' instead."
        );
        expect(error.location).toEqual({
          character: 43,
          line: 5
        });

        callback();
      });
    });

    ifNodeLt8It(
      'throws an error about Node.js version required for `eslint` option',
      () => {
        expect(() => {
          createCompiler({
            context: './project_eslint',
            entryPoint: './src/index.ts',
            pluginOptions: { eslint: true }
          });
        }).toThrowError(
          `To use 'eslint' option, please update to Node.js >= v8.10.0 ` +
            `(current version is ${process.version})`
        );
      }
    );

    it('should block emit on build mode', callback => {
      const compiler = createCompiler();

      const forkTsCheckerHooks = ForkTsCheckerWebpackPlugin.getCompilerHooks(
        compiler
      );
      forkTsCheckerHooks.emit.tap('should block emit on build mode', () => {
        expect(true).toBe(true);
        callback();
      });

      compiler.run(() => {
        /**/
      });
    });

    it('should not block emit on watch mode', callback => {
      const compiler = createCompiler();
      const watching = compiler.watch({}, () => {
        /**/
      });

      const forkTsCheckerHooks = ForkTsCheckerWebpackPlugin.getCompilerHooks(
        compiler
      );
      forkTsCheckerHooks.done.tap('should not block emit on watch mode', () => {
        watching.close(() => {
          expect(true).toBe(true);
          callback();
        });
      });
    });

    it('should block emit if async flag is false', callback => {
      const compiler = createCompiler({ pluginOptions: { async: false } });
      const watching = compiler.watch({}, () => {
        /**/
      });

      const forkTsCheckerHooks = ForkTsCheckerWebpackPlugin.getCompilerHooks(
        compiler
      );
      forkTsCheckerHooks.emit.tap(
        'should block emit if async flag is false',
        () => {
          watching.close(() => {
            expect(true).toBe(true);
            callback();
          });
        }
      );
    });

    it('kills the service when the watch is done', done => {
      const compiler = createCompiler();
      const watching = compiler.watch({}, () => {
        /**/
      });

      const forkTsCheckerHooks = ForkTsCheckerWebpackPlugin.getCompilerHooks(
        compiler
      );
      forkTsCheckerHooks.done.tap(
        'kills the service when the watch is done',
        () => {
          watching.close(() => {
            expect(killServiceWasCalled()).toBe(true);
            done();
          });
        }
      );
    });

    it('should throw error if config container wrong tsconfig.json path', () => {
      expect(() => {
        createCompiler({
          pluginOptions: {
            tsconfig: '/some/path/that/not/exists/tsconfig.json'
          }
        });
      }).toThrowError();
    });

    it('should allow delaying service-start', callback => {
      const compiler = createCompiler();
      let delayed = false;

      const forkTsCheckerHooks = ForkTsCheckerWebpackPlugin.getCompilerHooks(
        compiler
      );
      forkTsCheckerHooks.serviceBeforeStart.tapAsync(
        'should allow delaying service-start',
        (cb: () => void) => {
          setTimeout(() => {
            delayed = true;

            cb();
          }, 0);
        }
      );

      forkTsCheckerHooks.serviceBeforeStart.tap(
        'should allow delaying service-start',
        () => {
          expect(delayed).toBe(true);
          callback();
        }
      );

      compiler.run(() => {
        /**  */
      });
    });

    it('should not find syntactic errors when checkSyntacticErrors is false', callback => {
      const compiler = createCompiler({
        pluginOptions: { checkSyntacticErrors: false },
        happyPackMode: true
      });

      compiler.run((_error, stats) => {
        const syntacticErrorNotFoundInStats = stats.compilation.errors.every(
          error =>
            !error.rawMessage.includes(
              helpers.expectedErrorCodes.expectedSyntacticErrorCode
            )
        );
        expect(syntacticErrorNotFoundInStats).toBe(true);
        callback();
      });
    });

    it('should find syntactic errors when checkSyntacticErrors is true', callback => {
      const compiler = createCompiler({
        pluginOptions: { checkSyntacticErrors: true },
        happyPackMode: true
      });

      compiler.run((_error, stats) => {
        const syntacticErrorFoundInStats = stats.compilation.errors.some(
          error =>
            error.rawMessage.includes(
              helpers.expectedErrorCodes.expectedSyntacticErrorCode
            )
        );
        expect(syntacticErrorFoundInStats).toBe(true);
        callback();
      });
    });

    /**
     * regression test for #267, #299
     */
    it('should work even when the plugin has been deep-cloned', callback => {
      const compiler = createCompiler({
        pluginOptions: {
          tsconfig: 'tsconfig-semantic-error-only.json'
        },
        prepareWebpackConfig({ plugins, ...config }) {
          return { ...config, plugins: cloneDeep(plugins) };
        }
      });

      compiler.run((err, stats) => {
        expect(stats.compilation.errors).toEqual([
          expect.objectContaining({
            message: expect.stringContaining('TS2322')
          })
        ]);
        callback();
      });
    });
  }
);
