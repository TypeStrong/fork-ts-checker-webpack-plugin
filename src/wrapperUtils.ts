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
  wrapExtensions: string[];
}

export const wrapperConfigWithVue: TypeScriptWrapperConfig = {
  extensionHandlers: {
    '.mdx': handleMdxContents,
    '.vue': handleVueContents,
    '.vuex': handleVueContents
  },
  wrapExtensions: ['.mdx', '.vue', '.vuex']
};

export const emptyWrapperConfig: TypeScriptWrapperConfig = {
  extensionHandlers: {},
  wrapExtensions: []
};

export function getWrapperUtils(
  config: TypeScriptWrapperConfig = emptyWrapperConfig
) {
  const SUFFIX_TS = '.__fake__.ts';
  return {
    watchExtensions: ['.ts', '.tsx', ...config.wrapExtensions],

    wrapFileName(fileName: string) {
      return config.wrapExtensions.some(ext => fileName.endsWith(ext))
        ? fileName.concat(SUFFIX_TS)
        : fileName;
    },

    unwrapFileName(fileName: string) {
      if (fileName.endsWith(SUFFIX_TS)) {
        const realFileName = fileName.slice(0, -SUFFIX_TS.length);
        if (config.wrapExtensions.includes(extname(realFileName))) {
          return realFileName;
        }
      }
      return fileName;
    }
  };
}
