import * as ts from 'typescript';
import { extname } from 'path';
import { TypeScriptExtension } from './TypeScriptExtension';
import { Issue } from '../../issue';

interface TypeScriptEmbeddedSource {
  sourceText: string;
  extension: '.ts' | '.tsx' | '.js';
}

interface TypeScriptEmbeddedExtensionHost {
  embeddedExtensions: string[];
  getEmbeddedSource(fileName: string): TypeScriptEmbeddedSource | undefined;
}

/**
 * It handles most of the logic required to process embedded TypeScript code (like in Vue components or MDX)
 *
 * @param embeddedExtensions List of file extensions that should be treated as an embedded TypeScript source
 *                           (for example ['.vue'])
 * @param getEmbeddedSource  Function that returns embedded TypeScript source text and extension that this file
 *                           would have if it would be a regular TypeScript file
 */
function createTypeScriptEmbeddedExtension({
  embeddedExtensions,
  getEmbeddedSource,
}: TypeScriptEmbeddedExtensionHost): TypeScriptExtension {
  const embeddedSourceCache = new Map<string, TypeScriptEmbeddedSource | undefined>();

  function getCachedEmbeddedSource(fileName: string) {
    if (!embeddedSourceCache.has(fileName)) {
      embeddedSourceCache.set(fileName, getEmbeddedSource(fileName));
    }

    return embeddedSourceCache.get(fileName);
  }

  function parsePotentiallyEmbeddedFileName(fileName: string) {
    const extension = extname(fileName);
    const embeddedFileName = fileName.slice(0, fileName.length - extension.length);
    const embeddedExtension = extname(embeddedFileName);

    return {
      extension,
      embeddedFileName,
      embeddedExtension,
    };
  }

  type FileExists = (fileName: string) => boolean;
  function createEmbeddedFileExists(fileExists: FileExists): FileExists {
    return function embeddedFileExists(fileName) {
      const { embeddedExtension, embeddedFileName } = parsePotentiallyEmbeddedFileName(fileName);

      if (embeddedExtensions.includes(embeddedExtension) && fileExists(embeddedFileName)) {
        return true;
      }

      return fileExists(fileName);
    };
  }

  type ReadFile = (fileName: string, encoding?: string) => string | undefined;
  function createEmbeddedReadFile(readFile: ReadFile): ReadFile {
    return function embeddedReadFile(fileName, encoding) {
      const { embeddedExtension, embeddedFileName, extension } = parsePotentiallyEmbeddedFileName(
        fileName
      );

      if (embeddedExtensions.includes(embeddedExtension)) {
        const embeddedSource = getCachedEmbeddedSource(embeddedFileName);

        if (embeddedSource && embeddedSource.extension === extension) {
          return embeddedSource.sourceText;
        }
      }

      return readFile(fileName, encoding);
    };
  }

  return {
    extendIssues(issues: Issue[]): Issue[] {
      return issues.map((issue) => {
        if (issue.file) {
          const { embeddedExtension, embeddedFileName } = parsePotentiallyEmbeddedFileName(
            issue.file
          );

          if (embeddedExtensions.includes(embeddedExtension)) {
            return {
              ...issue,
              file: embeddedFileName,
            };
          }
        }

        return issue;
      });
    },
    extendWatchCompilerHost(host) {
      return {
        ...host,
        watchFile(fileName, callback, poolingInterval) {
          const { embeddedExtension, embeddedFileName } = parsePotentiallyEmbeddedFileName(
            fileName
          );

          if (embeddedExtensions.includes(embeddedExtension)) {
            return host.watchFile(
              embeddedFileName,
              (innerFileName: string, eventKind: ts.FileWatcherEventKind) => {
                embeddedSourceCache.delete(embeddedFileName);
                return callback(fileName, eventKind);
              },
              poolingInterval
            );
          } else {
            return host.watchFile(fileName, callback, poolingInterval);
          }
        },
        readFile: createEmbeddedReadFile(host.readFile),
        fileExists: createEmbeddedFileExists(host.fileExists),
      };
    },
    extendCompilerHost(host) {
      return {
        ...host,
        readFile: createEmbeddedReadFile(host.readFile),
        fileExists: createEmbeddedFileExists(host.fileExists),
      };
    },
  };
}

export {
  TypeScriptEmbeddedExtensionHost,
  TypeScriptEmbeddedSource,
  createTypeScriptEmbeddedExtension,
};
