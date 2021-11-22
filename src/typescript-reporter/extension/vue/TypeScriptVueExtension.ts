import {
  createTypeScriptEmbeddedExtension,
  TypeScriptEmbeddedSource,
} from '../TypeScriptEmbeddedExtension';
import fs from 'fs-extra';
import { TypeScriptExtension } from '../TypeScriptExtension';
import { TypeScriptVueExtensionConfiguration } from './TypeScriptVueExtensionConfiguration';
import { VueTemplateCompilerV2 } from './types/vue-template-compiler';
import { VueTemplateCompilerV3 } from './types/vue__compiler-sfc';

interface GenericScriptSFCBlock {
  content: string;
  attrs: Record<string, string | true | undefined>;
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

  function mergeVueScriptsContent(
    scriptContent: string | undefined,
    scriptSetupContent: string | undefined
  ): string {
    const scriptLines = scriptContent?.split(/\r?\n/) ?? [];
    const scriptSetupLines = scriptSetupContent?.split(/\r?\n/) ?? [];
    const maxScriptLines = Math.max(scriptLines.length, scriptSetupLines.length);
    const mergedScriptLines: string[] = [];

    for (let line = 0; line < maxScriptLines; ++line) {
      mergedScriptLines.push(scriptLines[line] || scriptSetupLines[line]);
    }

    return mergedScriptLines.join('\n');
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
        pad: 'line',
      });

      script = parsed.script;
    } else if (isVueTemplateCompilerV3(compiler)) {
      const parsed = compiler.parse(vueSourceText, {
        pad: 'line',
      });

      if (parsed.descriptor) {
        const parsedScript = parsed.descriptor.script;
        const parsedScriptSetup = parsed.descriptor.scriptSetup;
        let parsedContent = mergeVueScriptsContent(
          parsedScript?.content,
          parsedScriptSetup?.content
        );

        if (parsedScriptSetup) {
          // a little bit naive, but should work in 99.9% cases without need for parsing script
          const alreadyHasExportDefault = /export\s+default[\s|{]/gm.test(parsedContent);

          if (!alreadyHasExportDefault) {
            parsedContent += '\nexport default {};';
          }
          // add script setup lines at the end
          parsedContent +=
            "\n// @ts-ignore\nimport { defineProps, defineEmits, defineExpose, withDefaults } from '@vue/runtime-core';";
        }

        if (parsedScript || parsedScriptSetup) {
          // map newer version of SFCScriptBlock to the generic one
          script = {
            content: parsedContent,
            attrs: {
              lang: parsedScript?.lang || parsedScriptSetup?.lang,
            },
          };
        }
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
      return createVueInlineScriptEmbeddedSource(script.content, script.attrs.lang);
    }
  }

  return createTypeScriptEmbeddedExtension({
    embeddedExtensions: ['.vue'],
    getEmbeddedSource: getVueEmbeddedSource,
  });
}

export { createTypeScriptVueExtension };
