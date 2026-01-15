/**
 * Custom builder for TypeScript compilation using typescript-go
 * This builder allows using tsgo (TypeScript Go implementation) instead of tsc
 */

const { createBuilder } = require('@angular-devkit/architect');
const { execSync } = require('child_process');
const path = require('path');

const getPackageRunner = () => {
  try {
    execSync('bun --version', { stdio: 'pipe' });
    return 'bun';
  } catch {
    return 'npm';
  }
};

const addTsgoOptions = (args, options) => {
  if (options?.noEmit) {
    args.push('--noEmit');
  }
  if (options?.declaration !== false) {
    args.push('--declaration');
  }
  if (options?.declarationMap) {
    args.push('--declarationMap');
  }
};

const buildTsgoArgs = (options, context) => {
  const runner = getPackageRunner();
  let cmd = 'npx tsgo';
  if (runner === 'bun') {
    cmd = 'bun x tsgo';
  }

  // Get tsconfig path
  const tsConfig = options?.tsConfig || `projects/zero-angular/tsconfig.lib.json`;
  const workspaceRoot = String(context.workspaceRoot);
  const tsconfigPath = path.join(workspaceRoot, tsConfig);

  const args = [cmd, '-p', tsconfigPath];

  addTsgoOptions(args, options);

  return args;
};

const runTsgo = (args, context) => {
  const finalArgs = Array.from(args);
  const cwd = String(context.workspaceRoot);
  context.logger.info(`Running: ${finalArgs.join(' ')}`);

  // Execute tsgo
  try {
    execSync(finalArgs.join(' '), {
      cwd,
      stdio: 'inherit',
    });
    context.logger.info('TypeScript compilation succeeded');
    return { success: true };
  } catch (err) {
    context.logger.error('TypeScript compilation failed:', err);
    return { success: false };
  }
};

const execute = async (options, context) => {
  try {
    const args = buildTsgoArgs(options, context);
    return runTsgo(args, context);
  } catch (error) {
    context.logger.error(`Error running tsgo: ${error.message}`);
    return { success: false };
  }
};

module.exports = createBuilder(execute);
