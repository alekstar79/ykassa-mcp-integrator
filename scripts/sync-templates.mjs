import { access, cp, mkdir, rm, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import * as path from 'node:path';

const projectRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
);
const cliApp = path.join(projectRoot, 'apps', 'cli');

async function isDirectory(directoryPath) {
  try {
    return (await stat(directoryPath)).isDirectory();
  } catch (error) {
    if (error?.code === 'ENOENT') return false;
    throw error;
  }
}

async function copyDirectory(source, destination) {
  await rm(destination, { recursive: true, force: true });
  await mkdir(path.dirname(destination), { recursive: true });
  await cp(source, destination, { recursive: true });
}

async function main() {
  const clientTemplate = path.join(projectRoot, 'clients', 'example');
  if (await isDirectory(clientTemplate)) {
    const bundledTemplate = path.join(
      cliApp,
      'templates',
      'clients',
      'example',
    );
    await copyDirectory(clientTemplate, bundledTemplate);
    console.log('Copied clients/example/ to apps/cli/templates/clients/example/.');
  } else {
    console.warn('Warning: clients/example/ template has not been created yet; skipping it.');
  }

  const applications = [
    {
      name: 'web',
      source: path.join(projectRoot, 'apps', 'web', 'dist'),
      destination: path.join(cliApp, 'dist', 'web'),
    },
    {
      name: 'configurator',
      source: path.join(projectRoot, 'apps', 'configurator', 'dist'),
      destination: path.join(cliApp, 'dist', 'configurator'),
    },
  ];

  for (const application of applications) {
    try {
      await access(path.join(application.source, 'index.html'));
    } catch (error) {
      if (error?.code === 'ENOENT') {
        throw new Error(
          `Missing ${application.source}/index.html. Build the UIs with: npm run build --workspace=@alekstar79/ykassa-web && npm run build --workspace=@alekstar79/ykassa-configurator`,
        );
      }
      throw error;
    }
  }

  for (const application of applications) {
    await copyDirectory(application.source, application.destination);
    console.log(
      `Copied apps/${application.name}/dist/ to apps/cli/dist/${application.name}/.`,
    );
  }
}

main().catch((error) => {
  console.error(
    `sync-templates: ${error instanceof Error ? error.message : String(error)}`,
  );
  process.exitCode = 1;
});
