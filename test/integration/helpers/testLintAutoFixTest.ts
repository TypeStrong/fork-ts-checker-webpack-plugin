import { createCompiler } from './createCompiler';
import { ForkTsCheckerWebpackPlugin } from '.';
import fs from 'fs';
import path from 'path';

export function testLintAutoFixTest({
  fileName,
  pluginOptions
}: {
  fileName: string;
  pluginOptions: Partial<ForkTsCheckerWebpackPlugin.Options>;
}) {
  const lintErrorFileContents = `function someFunctionName(param1,param2){return param1+param2};
`;
  const formattedFileContents = `function someFunctionName(param1, param2) {return param1 + param2; }
`;

  const results = createCompiler({
    pluginOptions,
    entryPoint: `./src/${fileName}.ts`
  });

  const targetFileName = path.resolve(
    results.contextDir,
    `./src/${fileName}.ts`
  );

  fs.writeFileSync(targetFileName, lintErrorFileContents, { flag: 'w' });

  return { ...results, targetFileName, formattedFileContents };
}
