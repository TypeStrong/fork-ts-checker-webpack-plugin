import * as eslint from 'eslint';

/**
 * We need to define custom interface because of eslint architecture which
 * groups lint messages per file
 */
interface FileAwareEsLintMessage extends eslint.Linter.LintMessage {
  filePath?: string;
}

export { FileAwareEsLintMessage };
