import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';

const specUrl = process.env.CAREEROPS_OPENAPI_URL ?? 'http://localhost:8080/api/v1/v3/api-docs';
const outputPath = path.resolve('src/types/generated/openapi.d.ts');
const cliPath = path.resolve('node_modules/openapi-typescript/bin/cli.js');

async function ensureSpecAvailable() {
  let response;
  try {
    response = await fetch(specUrl, {
      headers: { Accept: 'application/json, application/yaml, text/yaml' },
    });
  } catch (error) {
    throw new Error(
      `Unable to reach ${specUrl}. Start the backend or set CAREEROPS_OPENAPI_URL to a reachable OpenAPI document.`,
      { cause: error },
    );
  }

  if (!response.ok) {
    throw new Error(
      `OpenAPI endpoint ${specUrl} responded with ${response.status} ${response.statusText}.`,
    );
  }
}

async function run() {
  await ensureSpecAvailable();
  await mkdir(path.dirname(outputPath), { recursive: true });

  await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [cliPath, specUrl, '-o', outputPath], {
      stdio: 'inherit',
    });

    child.on('exit', (code) => {
      if (code === 0) {
        resolve(undefined);
        return;
      }
      reject(new Error(`openapi-typescript exited with code ${code ?? 'unknown'}.`));
    });

    child.on('error', reject);
  });
}

run().catch((error) => {
  console.error('[generate:api-types]', error instanceof Error ? error.message : error);
  process.exitCode = 1;
});