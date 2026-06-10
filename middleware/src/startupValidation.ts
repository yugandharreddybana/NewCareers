/**
 * Fail-fast checks for middleware deploy configuration.
 */
export function validateStartupSecrets(): void {
  const isProd = process.env.NODE_ENV === 'production';
  const secret = process.env.APP_INTERNAL_SECRET || process.env.INTERNAL_TRUST_SECRET;

  if (isProd && (!secret || secret.length < 32)) {
    console.error(
      '[startup] FATAL: APP_INTERNAL_SECRET must be at least 32 characters in production.',
    );
    process.exit(1);
  }

  if (process.env.NODE_ENV === 'production' && process.env.DEV_AUTO_AUTH === 'true') {
    console.error('[startup] FATAL: DEV_AUTO_AUTH cannot be enabled in production.');
    process.exit(1);
  }

  if (
    process.env.NODE_ENV === 'development'
    && process.env.DEV_AUTO_AUTH === 'true'
    && process.env.DEV_AUTO_AUTH_ROLE === 'ADMIN'
  ) {
    console.warn(
      '[startup] DEV_AUTO_AUTH_ROLE=ADMIN grants admin in local dev — use USER unless testing admin flows.',
    );
  }
}
