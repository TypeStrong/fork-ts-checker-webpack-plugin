## babel-loader configuration example

It's a basic configuration of the plugin and [babel-loader](https://github.com/babel/babel-loader).
Very similar to the [ts-loader example](../ts-loader), the main difference in the configuration is that we
enable **syntactic diagnostics**:

```js
new ForkTsCheckerWebpackPlugin({
  typescript: {
    diagnosticOptions: {
      semantic: true,
      syntactic: true,
    },
  },
})
```

