import * as path from 'path';
// tslint:disable-next-line:no-implicit-dependencies
import { Configuration } from 'tslint';
import * as minimatch from 'minimatch';
import { fileExistsSync } from './FsHelper';

// Need some augmentation here - linterOptions.exclude is not (yet) part of the official
// types for tslint.
export interface ConfigurationFile extends Configuration.IConfigurationFile {
  linterOptions?: {
    typeCheck?: boolean;
    exclude?: string[];
  };
}

export function loadLinterConfig(configFile: string): ConfigurationFile {
  // tslint:disable-next-line:no-implicit-dependencies
  const tslint = require('tslint');

  return tslint.Configuration.loadConfigurationFromPath(
    configFile
  ) as ConfigurationFile;
}

export function makeGetLinterConfig(
  linterConfigs: Record<string, ConfigurationFile | undefined>,
  linterExclusions: minimatch.IMinimatch[],
  context: string
): (file: string) => ConfigurationFile | undefined {
  const getLinterConfig = (file: string): ConfigurationFile | undefined => {
    const dirname = path.dirname(file);
    if (dirname in linterConfigs) {
      return linterConfigs[dirname];
    }

    if (fileExistsSync(path.join(dirname, 'tslint.json'))) {
      const config = loadLinterConfig(path.join(dirname, 'tslint.json'));

      if (config.linterOptions && config.linterOptions.exclude) {
        linterExclusions.concat(
          config.linterOptions.exclude.map(
            pattern => new minimatch.Minimatch(path.resolve(pattern))
          )
        );
      }
      linterConfigs[dirname] = config;
    } else {
      if (dirname !== context && dirname !== file) {
        linterConfigs[dirname] = getLinterConfig(dirname);
      }
    }
    return linterConfigs[dirname];
  };

  return getLinterConfig;
}
