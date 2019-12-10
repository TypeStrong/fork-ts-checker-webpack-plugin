import * as path from 'path';
import * as minimatch from 'minimatch';
// tslint:disable-next-line:no-implicit-dependencies
import * as tslint from 'tslint'; // imported for types alone

import { fileExistsSync } from './FsHelper';

// Need some augmentation here - linterOptions.exclude is not (yet) part of the official
// types for tslint.
export interface ConfigurationFile
  extends tslint.Configuration.IConfigurationFile {
  linterOptions?: {
    typeCheck?: boolean;
    exclude?: string[];
  };
}

export function loadLinterConfig(configFile: string): ConfigurationFile {
  // tslint:disable-next-line:no-implicit-dependencies
  const { Configuration } = require('tslint');

  return Configuration.loadConfigurationFromPath(
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
