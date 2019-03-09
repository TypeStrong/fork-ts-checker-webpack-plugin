import * as path from 'path';

import { PluggableProgramFactoryInterface } from './PluggableProgramFactory';
import { VueProgram } from './VueProgram';

const VueProgramFactory: PluggableProgramFactoryInterface = {
  watchExtensions: ['.ts', '.tsx', '.vue'],

  loadProgram(config) {
    const programConfig =
      config.programConfig ||
      VueProgram.loadProgramConfig(
        config.typescript,
        config.configFile,
        config.compilerOptions
      );

    const program = VueProgram.createProgram(
      config.typescript,
      programConfig,
      path.dirname(config.configFile),
      config.files,
      config.watcher!,
      config.oldProgram!
    );

    return { programConfig, program };
  }
};

export default VueProgramFactory;
