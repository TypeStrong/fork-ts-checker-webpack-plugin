exports.resolveModuleName = function() {
  return { resolvedModule: { resolvedFileName: `${__dirname}/src/export.ts` } };
};

exports.resolveTypeReferenceDirective = function() {
  return {
    resolvedTypeReferenceDirective: {
      resolvedFileName: `${__dirname}/src/defs.d.ts`
    }
  };
};
