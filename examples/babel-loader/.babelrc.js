module.exports = {
  presets: [
    '@babel/preset-env',
    [
      '@babel/preset-typescript',
      {
        onlyRemoveTypeImports: true, // this is important for proper files watching
      },
    ],
  ],
};
