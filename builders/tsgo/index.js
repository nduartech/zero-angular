/**
 * Custom builder for TypeScript typechecking.
 * Uses `tsc` in no-emit mode.
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
  let cmd = 'npx tsc';
  if (runner === 'bun') {
    cmd = 'bun x tsc';
  }

  // Get tsconfig path
  const tsConfig = options?.tsConfig || `projects/zero-angular/tsconfig.lib.json`;
  const workspaceRoot = String(context.workspaceRoot);
  const tsconfigPath = path.join(workspaceRoot, tsConfig);

  const args = [cmd, '-p', tsconfigPath];

  // Default to noEmit for a "check" target unless explicitly overridden.
  if (options?.noEmit !== false) {
    args.push('--noEmit');
  }

  addTsgoOptions(args, options);

  return args;
};

const runTsgo = (args, context) => {
  const finalArgs = Array.from(args);
  const cwd = String(context.workspaceRoot);
  context.logger.info(`Running: ${finalArgs.join(' ')}`);

  // Execute tsc
  try {
    execSync(finalArgs.join(' '), {
      cwd,
      stdio: 'inherit',
    });
    context.logger.info('TypeScript typecheck succeeded');
    return { success: true };
  } catch (err) {
    context.logger.error('TypeScript typecheck failed:', err);
    return { success: false };
  }
};

const execute = async (options, context) => {
  try {
    const args = buildTsgoArgs(options, context);
    return runTsgo(args, context);
  } catch (error) {
    context.logger.error(`Error running tsc: ${error.message}`);
    return { success: false };
  }
};

module.exports = createBuilder(execute);
