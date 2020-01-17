import unixify from 'unixify';
import * as ts from 'typescript';
import { VueProgram } from '../../lib/VueProgram';
import ForkTsCheckerWebpackPlugin from '../../lib/index';

const templateCompilers = [
  'vue-template-compiler',
  'nativescript-vue-template-compiler'
];

jest.mock('typescript', () => {
  const originalTs = jest.requireActual('typescript');
  return {
    parseJsonConfigFileContent: jest.fn(tsconfig => ({
      options: tsconfig.compilerOptions
    })),
    readConfigFile: () => ({
      config: {
        compilerOptions: {
          foo: true
        }
      }
    }),
    sys: {},
    ScriptKind: originalTs.ScriptKind
  };
});

describe('[UNIT] VueProgram', () => {
  it('should determine if file is a Vue file', () => {
    expect(VueProgram.isVue('./test.vue')).toBe(true);
    expect(VueProgram.isVue('../test.vue')).toBe(true);
    expect(VueProgram.isVue('../../test.vue')).toBe(true);
    expect(VueProgram.isVue('@/test.vue')).toBe(true);
    expect(VueProgram.isVue('~/test.vue')).toBe(true);
    expect(VueProgram.isVue('../../.vue')).toBe(false);
    expect(VueProgram.isVue('./test.css')).toBe(false);
    expect(VueProgram.isVue('./')).toBe(false);
  });

  it('should properly resolve relative module names', () => {
    const basedir = '/base/dir';
    const containingFile = '/con/tain/ing/main.ts';
    const options: ts.CompilerOptions = {
      baseUrl: '/baseurl',
      paths: {
        '@/*': ['src/*']
      }
    };
    const moduleNames = ['./test.vue', '../test.vue', '../../test.vue'];

    const resolvedModuleNames = moduleNames.map(function(moduleName) {
      return VueProgram.resolveNonTsModuleName(
        moduleName,
        containingFile,
        basedir,
        options
      );
    });

    expect(unixify(resolvedModuleNames[0])).toBe('/con/tain/ing/test.vue');
    expect(unixify(resolvedModuleNames[1])).toBe('/con/tain/test.vue');
    expect(unixify(resolvedModuleNames[2])).toBe('/con/test.vue');
  });

  it('should properly resolve wildcard module names', () => {
    const basedir = '/base/dir';
    const containingFile = '/con/tain/ing/main.ts';
    const options: ts.CompilerOptions = {};
    const moduleName = '@/test.vue';

    let resolvedModuleName = VueProgram.resolveNonTsModuleName(
      moduleName,
      containingFile,
      basedir,
      options
    );
    expect(unixify(resolvedModuleName)).toBe('/base/dir/src/test.vue');

    options.baseUrl = '/baseurl1';
    resolvedModuleName = VueProgram.resolveNonTsModuleName(
      moduleName,
      containingFile,
      basedir,
      options
    );
    expect(unixify(resolvedModuleName)).toBe('/baseurl1/src/test.vue');

    options.baseUrl = '/baseurl2';
    options.paths = { '@/*': ['src1/*'] };
    resolvedModuleName = VueProgram.resolveNonTsModuleName(
      moduleName,
      containingFile,
      basedir,
      options
    );
    expect(unixify(resolvedModuleName)).toBe('/baseurl2/src1/test.vue');

    options.baseUrl = '/baseurl3';
    options.paths = { '@/*': ['src1/src2/*'] };
    resolvedModuleName = VueProgram.resolveNonTsModuleName(
      moduleName,
      containingFile,
      basedir,
      options
    );
    expect(unixify(resolvedModuleName)).toBe('/baseurl3/src1/src2/test.vue');
  });

  const vueOptionsVariants = [
    void 0,
    true,
    false,
    {},
    { enabled: true },
    { enabled: false },
    { compiler: 'vue-template-compiler' }
  ];

  it.each(vueOptionsVariants)(
    'should init valid vue options with: %p',
    option => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = (ForkTsCheckerWebpackPlugin as any).prepareVueOptions(
        option
      );
      expect(typeof result.enabled).toBe('boolean');
      expect(typeof result.compiler).toBe('string');
    }
  );

  it.each(templateCompilers)(
    'should extract script block with compiler=%s',
    templateCompiler => {
      const content = [
        '<script lang="ts">',
        'import Vue from "vue";',
        'export default Vue.extend({});',
        '</script>'
      ].join('\n');

      const result = VueProgram.resolveScriptBlock(
        ts,
        content,
        templateCompiler
      );

      expect(result.scriptKind).toBe(ts.ScriptKind.TS);
      expect(result.content).toBe(
        [
          '',
          'import Vue from "vue";',
          'export default Vue.extend({});',
          ''
        ].join('\n')
      );
    }
  );

  it.each(templateCompilers)('should pad lines with %s', templateCompiler => {
    const content = [
      '<template>',
      '  <p>Hello</p>',
      '</template>',
      '',
      '<script lang="ts">',
      'import Vue from "vue";',
      'export default Vue.extend({});',
      '</script>'
    ].join('\n');

    const result = VueProgram.resolveScriptBlock(ts, content, templateCompiler);
    expect(result.content).toBe(
      [
        '//',
        '//',
        '//',
        '//',
        '',
        'import Vue from "vue";',
        'export default Vue.extend({});',
        ''
      ].join('\n')
    );
  });

  describe('loadProgramConfig', () => {
    it('sets allowNonTsExtensions to true on returned options', () => {
      const result = VueProgram.loadProgramConfig(
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        require('typescript'),
        'tsconfig.foo.json',
        {}
      );

      expect(result.options.allowNonTsExtensions).toBe(true);
    });

    it('merges compilerOptions into config file options', () => {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      VueProgram.loadProgramConfig(require('typescript'), 'tsconfig.foo.json', {
        bar: false
      });

      expect(ts.parseJsonConfigFileContent).toHaveBeenLastCalledWith(
        {
          compilerOptions: {
            allowNonTsExtensions: true,
            foo: true,
            bar: false
          }
        },
        expect.anything(),
        expect.anything()
      );
    });
  });
});
