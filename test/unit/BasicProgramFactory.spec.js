var describe = require('mocha').describe;
var it = require('mocha').it;
var expect = require('chai').expect;
var mockRequire = require('mock-require');
var sinon = require('sinon');

describe('[UNIT] IncrementalChecker', function() {
  var BasicProgramFactory;
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
      sys: {}
    });

    BasicProgramFactory = mockRequire.reRequire(
      '../../lib/BasicProgramFactory'
    );
  });

  afterEach(function() {
    mockRequire.stopAll();
  });

  describe('loadProgramConfig', function() {
    it('merges compilerOptions into config file options', function() {
      BasicProgramFactory.loadProgramConfig(
        require('typescript'),
        'tsconfig.foo.json',
        {
          bar: false
        }
      );

      expect(parseJsonConfigFileContentStub.calledOnce).to.equal(true);
      expect(parseJsonConfigFileContentStub.args[0][0]).to.deep.equal({
        compilerOptions: {
          foo: true,
          bar: false
        }
      });
    });
  });
});
