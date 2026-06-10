/**
 * Rejects AES-GCM ciphertext and other non-human display names from auth responses.
 */
export function looksLikeEncryptedName(value: string | null | undefined): boolean {
  if (!value?.trim()) return false;
  const trimmed = value.trim();
  if (trimmed.startsWith('v1:')) return true;
  if (trimmed.length < 24) return false;
  if (!/^[A-Za-z0-9+/=_-]+$/.test(trimmed)) return false;
  try {
    const decoded = atob(trimmed.replace(/-/g, '+').replace(/_/g, '/'));
    return decoded.length > 16;
  } catch {
    return false;
  }
}

export function readableDisplayName(value: string | null | undefined): string {
  if (!value?.trim()) return '';
  return looksLikeEncryptedName(value) ? '' : value.trim();
}
