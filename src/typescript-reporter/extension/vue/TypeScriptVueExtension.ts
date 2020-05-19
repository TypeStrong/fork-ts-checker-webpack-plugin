import {
  createTypeScriptEmbeddedExtension,
  TypeScriptEmbeddedSource,
} from '../TypeScriptEmbeddedExtension';
import fs from 'fs-extra';
import { TypeScriptExtension } from '../TypeScriptExtension';
import { TypeScriptVueExtensionConfiguration } from './TypeScriptVueExtensionConfiguration';
import { VueTemplateCompiler } from './types/vue-template-compiler';

function createTypeScriptVueExtension(
  configuration: TypeScriptVueExtensionConfiguration
): TypeScriptExtension {
  function loadVueCompiler(): VueTemplateCompiler {
    return require(configuration.compiler);
  }

  function getExtensionByLang(lang: string | undefined): TypeScriptEmbeddedSource['extension'] {
    switch (lang) {
      case 'ts':
        return '.ts';
      case 'tsx':
        return '.tsx';
      case 'js':
      case 'jsx':
      default:
        return '.js';
    }
  }

  function createVueNoScriptEmbeddedSource(): TypeScriptEmbeddedSource {
    return {
      sourceText: 'export default {};\n',
      extension: '.js',
    };
  }

  function createVueSrcScriptEmbeddedSource(
    src: string,
    lang: string | undefined
  ): TypeScriptEmbeddedSource {
    // Import path cannot be end with '.ts[x]'
    src = src.replace(/\.tsx?$/i, '');

    // For now, ignore the error when the src file is not found since it will produce incorrect code location.
    // It's not a large problem since it's handled on webpack side.
    const text = [
      '// @ts-ignore',
      `export { default } from '${src}';`,
      '// @ts-ignore',
      `export * from '${src}';`,
    ].join('\n');

    return {
      sourceText: text,
      extension: getExtensionByLang(lang),
    };
  }

  function createVueInlineScriptEmbeddedSource(
    text: string,
    lang: string | undefined
  ): TypeScriptEmbeddedSource {
    return {
      sourceText: text,
      extension: getExtensionByLang(lang),
    };
  }

  function getVueEmbeddedSource(fileName: string): TypeScriptEmbeddedSource | undefined {
    if (!fs.existsSync(fileName)) {
      return undefined;
    }

    const compiler = loadVueCompiler();
    const vueSourceText = fs.readFileSync(fileName, { encoding: 'utf-8' });

    const { script } = compiler.parseComponent(vueSourceText, {
      pad: 'space',
    });

    if (!script) {
      // No <script> block
      return createVueNoScriptEmbeddedSource();
    } else if (script.attrs.src) {
      // <script src="file.ts" /> block
      return createVueSrcScriptEmbeddedSource(script.attrs.src, script.attrs.lang);
    } else {
      // <script lang="ts"></script> block
      // pad blank lines to retain diagnostics location
      const lineOffset = vueSourceText.slice(0, script.start).split(/\r?\n/g).length;
      const paddedSourceText =
        Array(lineOffset).join('\n') + vueSourceText.slice(script.start, script.end);

      return createVueInlineScriptEmbeddedSource(paddedSourceText, script.attrs.lang);
    }
  }

  return createTypeScriptEmbeddedExtension({
    embeddedExtensions: ['.vue'],
    getEmbeddedSource: getVueEmbeddedSource,
  });
}

export { createTypeScriptVueExtension };
