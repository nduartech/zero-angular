const { createBuilder } = require('@angular-devkit/architect');
const { execSync } = require('child_process');

const getPackageRunner = () => {
  try {
    execSync('bun --version', { stdio: 'pipe' });
    return 'bun';
  } catch {
    return 'npm';
  }
};

const buildVitestArgs = (options) => {
  const runner = getPackageRunner();
  let cmd = 'npx vitest';
  if (runner === 'bun') {
    cmd = 'bun x vitest';
  }

  const args = options?.watch ? [] : ['run'];
  const configPath = options?.config || 'vitest.config.ts';
  args.push('-c', configPath);
  return [cmd, ...args];
};

const execute = async (options, context) => {
  const args = buildVitestArgs(options);
  context.logger.info(`Running: ${args.join(' ')}`);
  try {
    execSync(args.join(' '), {
      cwd: context.workspaceRoot,
      stdio: 'inherit',
    });
    return { success: true };
  } catch (err) {
    context.logger.error('Vitest failed:', err);
    return { success: false };
  }
};

module.exports = createBuilder(execute);
