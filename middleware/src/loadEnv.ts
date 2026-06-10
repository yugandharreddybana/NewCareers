/**
 * Load .env before any route module reads process.env (ESM hoists static imports).
 */
import { config } from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

if (process.env.NODE_ENV !== 'production') {
  const middlewareDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const repoRoot = path.resolve(middlewareDir, '..');
  // Repo-root secret first, then middleware/.env overrides (APP_INTERNAL_SECRET must match Java).
  config({ path: path.join(repoRoot, '.env') });
  config({ path: path.join(middlewareDir, '.env') });
  config();
}
