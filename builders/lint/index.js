const { createBuilder } = require('@angular-devkit/architect');
const { execSync } = require('child_process');

const MIN_EXCLUDE_LENGTH = 0;
const MIN_WARNINGS = 0;

const getPackageRunner = () => {
  try {
    execSync('bun --version', { stdio: 'pipe' });
    return 'bun';
  } catch {
    return 'npm';
  }
};

const addOxlintOptions = (args, options) => {
  if (options?.typeAware !== false) {
    args.push('--type-aware');
    if (options?.typeCheck) {
      args.push('--type-check');
    }
  }

  if (options?.fix) {
    args.push('--fix');
  }

  if (options?.exclude?.length > MIN_EXCLUDE_LENGTH) {
    for (const pattern of options.exclude) {
      args.push('--ignore-pattern', pattern);
    }
  }

  if (options?.maxWarnings !== undefined && options.maxWarnings >= MIN_WARNINGS) {
    args.push('--max-warnings', String(options.maxWarnings));
  }
};

const buildOxlintArgs = (options) => {
  const runner = getPackageRunner();
  let cmd = 'npx oxlint';
  if (runner === 'bun') {
    cmd = 'bun x oxlint';
  }

  const args = [];
  addOxlintOptions(args, options);
  args.push('.');

  // Make a shallow copy of args as string[] to avoid unsafe spread warnings
  const finalArgs = Array.from(args, String);
  return [cmd, ...finalArgs];
};

const runOxlint = (args, context) => {
  context.logger.info(`Running: ${args.join(' ')}`);

  // Execute oxlint
  try {
    execSync(args.join(' '), {
      cwd: context.workspaceRoot,
      stdio: 'inherit',
    });
    return { success: true };
  } catch (err) {
    context.logger.info('Oxlint exited with error:', err);
    // Oxlint exits with code 1 if there are errors, which is expected
    return { success: false };
  }
};

const execute = async (options, context) => {
  try {
    const args = buildOxlintArgs(options);
    return runOxlint(args, context);
  } catch (error) {
    context.logger.error(`Error running oxlint: ${error.message}`);
    return { success: false };
  }
};

module.exports = createBuilder(execute);
