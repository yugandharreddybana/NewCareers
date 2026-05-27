/**
 * Load .env before any route module reads process.env (ESM hoists static imports).
 */
import { config } from 'dotenv';

if (process.env.NODE_ENV !== 'production') {
  config();
}
