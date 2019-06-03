var unixify = require('unixify');
var ts = require('typescript');
var VueProgram = require('../../lib/VueProgram').VueProgram;

jest.mock('typescript', () => {
  var originalTs = jest.requireActual('typescript');
  return {
    parseJsonConfigFileContent: jest.fn(function(tsconfig) {
      return {
        options: tsconfig.compilerOptions
      };
    }),
    readConfigFile() {
      return {
        config: {
          compilerOptions: {
            foo: true
          }
        }
      };
    },
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
    var basedir = '/base/dir';
    var containingFile = '/con/tain/ing/main.ts';
    var options = {
      baseUrl: '/baseurl',
      paths: {
        '@/*': ['src/*']
      }
    };
    var moduleNames = ['./test.vue', '../test.vue', '../../test.vue'];

    var resolvedModuleNames = moduleNames.map(function(moduleName) {
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
    var basedir = '/base/dir';
    var containingFile = '/con/tain/ing/main.ts';
    var options = {};
    var moduleName = '@/test.vue';

    var resolvedModuleName = VueProgram.resolveNonTsModuleName(
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

  it('should extract script block', () => {
    var content = [
      '<script lang="ts">',
      'import Vue from "vue";',
      'export default Vue.extend({});',
      '</script>'
    ].join('\n');

    var result = VueProgram.resolveScriptBlock(ts, content);

    expect(result.scriptKind).toBe(ts.ScriptKind.TS);
    expect(result.content).toBe(
      ['', 'import Vue from "vue";', 'export default Vue.extend({});', ''].join(
        '\n'
      )
    );
  });

  it('should pad lines', () => {
    var content = [
      '<template>',
      '  <p>Hello</p>',
      '</template>',
      '',
      '<script lang="ts">',
      'import Vue from "vue";',
      'export default Vue.extend({});',
      '</script>'
    ].join('\n');

    var result = VueProgram.resolveScriptBlock(ts, content);

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
      var result = VueProgram.loadProgramConfig(
        require('typescript'),
        'tsconfig.foo.json',
        {}
      );

      expect(result.options.allowNonTsExtensions).toBe(true);
    });

    it('merges compilerOptions into config file options', () => {
      VueProgram.loadProgramConfig(require('typescript'), 'tsconfig.foo.json', {
        bar: false
      });

      expect(ts.parseJsonConfigFileContent).toHaveBeenCalledTimes(1);
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
