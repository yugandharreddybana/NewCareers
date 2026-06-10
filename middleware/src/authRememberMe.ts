export const REMEMBER_FLAG_COOKIE = 'co_remember';

/** Body `rememberMe` wins; otherwise fall back to the login-step cookie flag. */
export function resolveRememberMe(
  cookies: Record<string, string | undefined> | undefined,
  explicit?: boolean,
): boolean {
  if (typeof explicit === 'boolean') return explicit;
  return cookies?.[REMEMBER_FLAG_COOKIE] === '1';
}
