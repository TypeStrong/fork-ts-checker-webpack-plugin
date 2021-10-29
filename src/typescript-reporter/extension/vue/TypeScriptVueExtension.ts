import fs from 'fs-extra';

import type { TypeScriptEmbeddedSource } from '../TypeScriptEmbeddedExtension';
import { createTypeScriptEmbeddedExtension } from '../TypeScriptEmbeddedExtension';
import type { TypeScriptExtension } from '../TypeScriptExtension';

import type { VueTemplateCompilerV2 } from './types/vue-template-compiler';
import type { VueTemplateCompilerV3 } from './types/vue__compiler-sfc';
import type { TypeScriptVueExtensionConfiguration } from './TypeScriptVueExtensionConfiguration';

interface GenericScriptSFCBlock {
  content: string;
  attrs: Record<string, string | true>;
  start?: number;
  end?: number;
  lang?: string;
  src?: string;
}

function createTypeScriptVueExtension(
  configuration: TypeScriptVueExtensionConfiguration
): TypeScriptExtension {
  function loadVueTemplateCompiler(): VueTemplateCompilerV2 | VueTemplateCompilerV3 {
    return require(configuration.compiler);
  }

  function isVueTemplateCompilerV2(
    compiler: VueTemplateCompilerV2 | VueTemplateCompilerV3
  ): compiler is VueTemplateCompilerV2 {
    return typeof (compiler as VueTemplateCompilerV2).parseComponent === 'function';
  }

  function isVueTemplateCompilerV3(
    compiler: VueTemplateCompilerV2 | VueTemplateCompilerV3
  ): compiler is VueTemplateCompilerV3 {
    return typeof (compiler as VueTemplateCompilerV3).parse === 'function';
  }

  function getExtensionByLang(
    lang: string | true | undefined
  ): TypeScriptEmbeddedSource['extension'] {
    if (lang === true) {
      return '.js';
    }

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
    lang: string | true | undefined
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
    lang: string | true | undefined
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

    const compiler = loadVueTemplateCompiler();
    const vueSourceText = fs.readFileSync(fileName, { encoding: 'utf-8' });

    let script: GenericScriptSFCBlock | undefined;
    if (isVueTemplateCompilerV2(compiler)) {
      const parsed = compiler.parseComponent(vueSourceText, {
        pad: 'space',
      });

      script = parsed.script;
    } else if (isVueTemplateCompilerV3(compiler)) {
      const parsed = compiler.parse(vueSourceText);

      if (parsed.descriptor && parsed.descriptor.script) {
        const scriptV3 = parsed.descriptor.script;

        // map newer version of SFCScriptBlock to the generic one
        script = {
          content: scriptV3.content,
          attrs: scriptV3.attrs,
          start: scriptV3.loc.start.offset,
          end: scriptV3.loc.end.offset,
          lang: scriptV3.lang,
          src: scriptV3.src,
        };
      }
    } else {
      throw new Error(
        'Unsupported vue template compiler. Compiler should provide `parse` or `parseComponent` function.'
      );
    }

    if (!script) {
      // No <script> block
      return createVueNoScriptEmbeddedSource();
    } else if (script.attrs.src) {
      // <script src="file.ts" /> block
      if (typeof script.attrs.src === 'string') {
        return createVueSrcScriptEmbeddedSource(script.attrs.src, script.attrs.lang);
      }
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
