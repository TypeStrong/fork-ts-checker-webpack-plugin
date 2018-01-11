var describe = require('mocha').describe;
var it = require('mocha').it;
var expect = require('chai').expect;
var VueProgram = require('../../lib/VueProgram');

describe('[UNIT] VueProgram', function () {
  it('should determine if file is a Vue file', function() {
    expect(VueProgram.isVue('./test.vue')).to.be.true;
    expect(VueProgram.isVue('../test.vue')).to.be.true;
    expect(VueProgram.isVue('../../test.vue')).to.be.true;
    expect(VueProgram.isVue('@/test.vue')).to.be.true;
    expect(VueProgram.isVue('../../.vue')).to.be.false;
    expect(VueProgram.isVue('./test.css')).to.be.false;
    expect(VueProgram.isVue('./')).to.be.false;
  });

  it('should properly resolve module names', function() {
    var basedir = '/base/dir';
    var containingFile = '/con/tain/ing/main.ts';
    var options = {
      baseUrl: '/baseurl',
      paths: {
        '@/*': [
          'src/*'
        ]
      }
    }
    var moduleNames = [
      './test.vue',
      '../test.vue',
      '../../test.vue',
      '@/test.vue',
      '@/dir/test.vue'
    ];

    var resolvedModuleNames = moduleNames.map(function(moduleName) {
      return VueProgram.resolveNonTsModuleName(moduleName, containingFile, basedir, options);
    });

    expect(resolvedModuleNames[0]).to.be.equal('/con/tain/ing/test.vue');
    expect(resolvedModuleNames[1]).to.be.equal('/con/tain/test.vue');
    expect(resolvedModuleNames[2]).to.be.equal('/con/test.vue');
    expect(resolvedModuleNames[3]).to.be.equal('/con/tain/ing/@/test.vue');
    expect(resolvedModuleNames[4]).to.be.equal('/con/tain/ing/@/dir/test.vue');
  });
});