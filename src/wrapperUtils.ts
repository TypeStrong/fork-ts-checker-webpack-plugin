/* tslint:disable:no-console */
// tslint:disable-next-line:no-implicit-dependencies
import { extname } from 'path';
import { handleMdxContents } from './handleMdxContents';
import { handleVueContents } from './handleVueContents';

export interface TypeScriptWrapperConfig {
  extensionHandlers: {
    [extension: string]: (
      originalContents: string,
      originalFileName: string
    ) => string;
  };
  wrapExtensionsAsTs: string[];
  wrapExtensionsAsTsx: string[];
}

export const wrapperConfigWithVue: TypeScriptWrapperConfig = {
  extensionHandlers: {
    '.mdx': handleMdxContents,
    '.vue': handleVueContents,
    '.vuex': handleVueContents
  },
  wrapExtensionsAsTs: ['.vue', '.vuex'],
  wrapExtensionsAsTsx: ['.mdx']
};

export const emptyWrapperConfig: TypeScriptWrapperConfig = {
  extensionHandlers: {},
  wrapExtensionsAsTs: [],
  wrapExtensionsAsTsx: []
};

export function getWrapperUtils(
  config: TypeScriptWrapperConfig = emptyWrapperConfig
) {
  const SUFFIX_TS = '.__fake__.ts';
  const SUFFIX_TSX = '.__fake__.tsx';
  return {
    watchExtensions: [
      '.ts',
      '.tsx',
      ...config.wrapExtensionsAsTs,
      ...config.wrapExtensionsAsTsx
    ],

    wrapFileName(fileName: string) {
      return config.wrapExtensionsAsTs.some(ext => fileName.endsWith(ext))
        ? fileName.concat(SUFFIX_TS)
        : config.wrapExtensionsAsTsx.some(ext => fileName.endsWith(ext))
        ? fileName.concat(SUFFIX_TSX)
        : fileName;
    },

    unwrapFileName(fileName: string) {
      if (fileName.endsWith(SUFFIX_TS)) {
        const realFileName = fileName.slice(0, -SUFFIX_TS.length);
        if (config.wrapExtensionsAsTs.includes(extname(realFileName))) {
          return realFileName;
        }
      }
      if (fileName.endsWith(SUFFIX_TSX)) {
        const realFileName = fileName.slice(0, -SUFFIX_TSX.length);
        if (config.wrapExtensionsAsTsx.includes(extname(realFileName))) {
          return realFileName;
        }
      }
      return fileName;
    }
  };
}
