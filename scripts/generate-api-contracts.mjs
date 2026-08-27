#!/usr/bin/env node

import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';

const repoRoot = process.cwd();
const args = new Set(process.argv.slice(2));
const checkMode = args.has('--check');
const port = Number(process.env.OPENAPI_PORT ?? 18080);
const openApiUrl = `http://127.0.0.1:${port}/v3/api-docs`;
const contractsDir = path.join(repoRoot, 'frontend', 'api-contracts');
const openApiPath = path.join(contractsDir, 'openapi.json');
const typesPath = path.join(contractsDir, 'types.ts');
const tmpDir = path.join(repoRoot, 'artifacts', 'api-contracts');
const tmpOpenApiPath = path.join(tmpDir, 'openapi.generated.json');
const tmpTypesPath = path.join(tmpDir, 'types.generated.ts');

await main();

async function main() {
  await fs.mkdir(contractsDir, { recursive: true });
  await fs.mkdir(tmpDir, { recursive: true });

  const backend = startBackend();
  try {
    const spec = sortJson(await fetchOpenApiSpec());
    await writeJson(tmpOpenApiPath, spec);
    await generateTypes(tmpOpenApiPath, tmpTypesPath);

    if (checkMode) {
      await assertFileFresh(openApiPath, tmpOpenApiPath, 'frontend/api-contracts/openapi.json');
      await assertFileFresh(typesPath, tmpTypesPath, 'frontend/api-contracts/types.ts');
      console.log('Generated API contracts are up to date.');
      return;
    }

    await fs.copyFile(tmpOpenApiPath, openApiPath);
    await fs.copyFile(tmpTypesPath, typesPath);
    console.log('Generated API contracts in frontend/api-contracts/.');
  } finally {
    backend.contractStopping = true;
    await stopBackend(backend);
  }
}

function startBackend() {
  const command = process.platform === 'win32' ? 'mvnw.cmd' : './scripts/run-maven.sh';
  const commandArgs = [
    '-q',
    'spring-boot:run',
    '-Dspring-boot.run.profiles=test',
    '-Dspring-boot.run.useTestClasspath=true',
    `-Dspring-boot.run.arguments=--server.port=${port} --spring.main.banner-mode=off --spring.devtools.restart.enabled=false --springdoc.api-docs.enabled=true --springdoc.swagger-ui.enabled=false --spring.flyway.enabled=false --spring.jpa.hibernate.ddl-auto=create-drop --spring.jpa.show-sql=false --github.sync.enabled=false --notifications.due-date-reminder.enabled=false --logging.level.root=WARN --logging.level.com.planora.backend=INFO --logging.level.org.hibernate.SQL=OFF --logging.level.org.hibernate.orm.jdbc.bind=OFF --logging.level.org.springframework.web=INFO --logging.level.org.springframework.boot=INFO`,
  ];
  const child = spawn(command, shellArguments(commandArgs), {
    cwd: path.join(repoRoot, 'backend'),
    env: buildBackendEnv(),
    stdio: ['ignore', 'pipe', 'pipe'],
    shell: process.platform === 'win32',
  });

  child.stdout.on('data', (chunk) => process.stdout.write(`[backend] ${chunk}`));
  child.stderr.on('data', (chunk) => process.stderr.write(`[backend] ${chunk}`));
  child.on('exit', (code, signal) => {
    if (!child.contractStopping && code !== 0 && signal !== 'SIGTERM') {
      console.error(`Backend exited before OpenAPI generation completed (code ${code}, signal ${signal}).`);
    }
  });

  return child;
}

function buildBackendEnv() {
  const env = { ...process.env, SPRING_PROFILES_ACTIVE: 'test' };
  env.SPRING_DEVTOOLS_RESTART_ENABLED = 'false';
  env.SPRING_DEVTOOLS_ADD_PROPERTIES = 'false';
  env.SPRING_DATASOURCE_URL = 'jdbc:h2:mem:openapi;DB_CLOSE_DELAY=-1;DB_CLOSE_ON_EXIT=FALSE;NON_KEYWORDS=VALUE';
  env.SPRING_DATASOURCE_USERNAME = 'sa';
  env.SPRING_DATASOURCE_PASSWORD = '';
  env.JWT_SECRET = [
    'dGhpcy1pcy1h',
    'LXN1cGVyLXNlY3JldC1rZXkt',
    'MzJieXQ=',
  ].join('');
  env.MAIL_HOST = 'localhost';
  env.MAIL_PORT = '25';
  env.MAIL_USERNAME = 'openapi@example.com';
  env.MAIL_PASSWORD = 'openapi';
  env.AWS_ACCESS_KEY = 'openapi-access-key';
  env.AWS_SECRET_KEY = 'openapi-secret-key';
  env.AWS_REGION = 'eu-north-1';
  env.AWS_PROFILE_PHOTOS_BUCKET = 'openapi-profile-bucket';
  env.AWS_DMS_BUCKET = 'openapi-dms-bucket';
  env.AWS_CHAT_BUCKET = 'openapi-chat-bucket';
  env.AWS_TASK_STORAGE_BUCKET = 'openapi-task-bucket';
  return env;
}

async function fetchOpenApiSpec() {
  const deadline = Date.now() + 90_000;
  let lastError;

  while (Date.now() < deadline) {
    try {
      const response = await fetch(openApiUrl);
      if (response.ok) {
        return await response.json();
      }
      lastError = new Error(`HTTP ${response.status} from ${openApiUrl}`);
    } catch (error) {
      lastError = error;
    }
    await delay(1_000);
  }

  throw new Error(`Timed out waiting for ${openApiUrl}: ${lastError}`);
}

async function generateTypes(inputPath, outputPath) {
  const binary = path.join(
    repoRoot,
    'frontend',
    'web',
    'node_modules',
    '.bin',
    process.platform === 'win32' ? 'openapi-typescript.cmd' : 'openapi-typescript',
  );
  await run(binary, [inputPath, '--output', outputPath]);
}

async function run(command, commandArgs) {
  await new Promise((resolve, reject) => {
    const child = spawn(command, shellArguments(commandArgs), {
      cwd: repoRoot,
      stdio: 'inherit',
      shell: process.platform === 'win32',
    });
    child.on('exit', (code) => code === 0 ? resolve() : reject(new Error(`${command} exited with ${code}`)));
    child.on('error', reject);
  });
}

function shellArguments(commandArgs) {
  return process.platform === 'win32'
    ? commandArgs.map((value) => `"${value.replaceAll('"', '\\"')}"`)
    : commandArgs;
}

async function assertFileFresh(expectedPath, actualPath, label) {
  const [expected, actual] = await Promise.all([
    readFileOrEmpty(expectedPath),
    readFileOrEmpty(actualPath),
  ]);
  if (expected !== actual) {
    throw new Error(`${label} is stale. Run: node scripts/generate-api-contracts.mjs`);
  }
}

async function readFileOrEmpty(filePath) {
  try {
    return await fs.readFile(filePath, 'utf8');
  } catch (error) {
    if (error?.code === 'ENOENT') {
      return '';
    }
    throw error;
  }
}

async function writeJson(filePath, value) {
  await fs.writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function sortJson(value) {
  if (Array.isArray(value)) {
    return value.map(sortJson);
  }
  if (!value || typeof value !== 'object') {
    return value;
  }

  return Object.fromEntries(
    Object.entries(value)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, child]) => [key, sortJson(child)]),
  );
}

async function stopBackend(child) {
  if (child.exitCode != null) {
    return;
  }

  child.kill('SIGTERM');
  await Promise.race([
    new Promise((resolve) => child.once('exit', resolve)),
    delay(5_000).then(() => {
      if (child.exitCode == null) {
        child.kill('SIGKILL');
      }
    }),
  ]);
}
