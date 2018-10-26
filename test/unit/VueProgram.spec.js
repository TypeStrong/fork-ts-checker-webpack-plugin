var ts = require('typescript');
var describe = require('mocha').describe;
var it = require('mocha').it;
var expect = require('chai').expect;
var mockRequire = require('mock-require');
var sinon = require('sinon');

describe('[UNIT] VueProgram', function() {
  var VueProgram;
  var parseJsonConfigFileContentStub;

  beforeEach(function() {
    parseJsonConfigFileContentStub = sinon.spy(function(tsconfig) {
      return {
        options: tsconfig.compilerOptions
      };
    });

    var readConfigFile = function() {
      return {
        config: {
          compilerOptions: {
            foo: true
          }
        }
      };
    };

    mockRequire('typescript', {
      parseJsonConfigFileContent: parseJsonConfigFileContentStub,
      readConfigFile,
      sys: {},
      ScriptKind: ts.ScriptKind
    });

    VueProgram = mockRequire.reRequire('../../lib/VueProgram').VueProgram;
  });

  afterEach(function() {
    mockRequire.stopAll();
  });

  it('should determine if file is a Vue file', function() {
    expect(VueProgram.isVue('./test.vue')).to.be.true;
    expect(VueProgram.isVue('../test.vue')).to.be.true;
    expect(VueProgram.isVue('../../test.vue')).to.be.true;
    expect(VueProgram.isVue('@/test.vue')).to.be.true;
    expect(VueProgram.isVue('~/test.vue')).to.be.true;
    expect(VueProgram.isVue('../../.vue')).to.be.false;
    expect(VueProgram.isVue('./test.css')).to.be.false;
    expect(VueProgram.isVue('./')).to.be.false;
  });

  it('should properly resolve relative module names', function() {
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

    expect(resolvedModuleNames[0]).to.be.equal('/con/tain/ing/test.vue');
    expect(resolvedModuleNames[1]).to.be.equal('/con/tain/test.vue');
    expect(resolvedModuleNames[2]).to.be.equal('/con/test.vue');
  });

  it('should properly resolve wildcard module names', function() {
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
    expect(resolvedModuleName).to.be.equal('/base/dir/src/test.vue');

    options.baseUrl = '/baseurl1';
    resolvedModuleName = VueProgram.resolveNonTsModuleName(
      moduleName,
      containingFile,
      basedir,
      options
    );
    expect(resolvedModuleName).to.be.equal('/baseurl1/src/test.vue');

    options.baseUrl = '/baseurl2';
    options.paths = { '@/*': ['src1/*'] };
    resolvedModuleName = VueProgram.resolveNonTsModuleName(
      moduleName,
      containingFile,
      basedir,
      options
    );
    expect(resolvedModuleName).to.be.equal('/baseurl2/src1/test.vue');

    options.baseUrl = '/baseurl3';
    options.paths = { '@/*': ['src1/src2/*'] };
    resolvedModuleName = VueProgram.resolveNonTsModuleName(
      moduleName,
      containingFile,
      basedir,
      options
    );
    expect(resolvedModuleName).to.be.equal('/baseurl3/src1/src2/test.vue');
  });

  it('should extract script block', function() {
    var content = [
      '<script lang="ts">',
      'import Vue from "vue";',
      'export default Vue.extend({});',
      '</script>'
    ].join('\n');

    var result = VueProgram.resolveScriptBlock(content);

    expect(result.scriptKind).to.be.equal(ts.ScriptKind.TS);
    expect(result.content).to.be.equal(
      ['', 'import Vue from "vue";', 'export default Vue.extend({});', ''].join(
        '\n'
      )
    );
  });

  it('should pad lines', function() {
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

    var result = VueProgram.resolveScriptBlock(content);

    expect(result.content).to.be.equal(
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

  describe('loadProgramConfig', function() {
    it('sets allowNonTsExtensions to true on returned options', function() {
      var result = VueProgram.loadProgramConfig('tsconfig.foo.json', {});

      expect(result.options.allowNonTsExtensions).to.equal(true);
    });

    it('merges compilerOptions into config file options', function() {
      VueProgram.loadProgramConfig('tsconfig.foo.json', {
        bar: false
      });

      expect(parseJsonConfigFileContentStub.calledOnce).to.equal(true);
      expect(parseJsonConfigFileContentStub.args[0][0]).to.deep.equal({
        compilerOptions: {
          allowNonTsExtensions: true,
          foo: true,
          bar: false
        }
      });
    });
  });
});
