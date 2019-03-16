// tslint:disable-next-line:no-implicit-dependencies
import * as vueCompiler from 'vue-template-compiler';

export function handleVueContents(content: string): string {
  // We need to import vue-template-compiler lazily because it cannot be included it
  // as direct dependency because it is an optional dependency of fork-ts-checker-webpack-plugin.
  // Since its version must not mismatch with user-installed Vue.js,
  // we should let the users install vue-template-compiler by themselves.
  let parser: typeof vueCompiler;
  try {
    // tslint:disable-next-line
    parser = require('vue-template-compiler');
  } catch (err) {
    throw new Error(
      'When you use `vue` option, make sure to install `vue-template-compiler`.'
    );
  }

  const { script } = parser.parseComponent(content, {
    pad: 'space'
  });

  // No <script> block
  if (!script) {
    return '/* tslint:disable */\nexport default {};\n';
  }

  // There is src attribute
  if (script.attrs.src) {
    // import path cannot be end with '.ts[x]'
    const src = script.attrs.src.replace(/\.tsx?$/i, '');
    return (
      '/* tslint:disable */\n' +
      '// @ts-ignore\n' +
      `export { default } from '${src}';\n` +
      '// @ts-ignore\n' +
      `export * from '${src}';\n`
    );
  }

  // Pad blank lines to retain diagnostics location
  // We need to prepend `//` for each line to avoid
  // false positive of no-consecutive-blank-lines TSLint rule
  const offset = content.slice(0, script.start).split(/\r?\n/g).length;
  const paddedContent =
    Array(offset).join('//\n') + script.content.slice(script.start);

  return paddedContent;
}
