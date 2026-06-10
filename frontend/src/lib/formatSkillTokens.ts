/** Compact label for per-run LLM token usage, e.g. "4k tokens used to generate this". */
export function formatSkillTokens(totalTokens: number | null | undefined): string | null {
  if (totalTokens == null || totalTokens <= 0) {
    return null;
  }
  if (totalTokens >= 1000) {
    const rounded = Math.round(totalTokens / 1000);
    return `${rounded}k tokens used to generate this`;
  }
  return `${totalTokens} tokens used to generate this`;
}

/** Short suffix for version history pills, e.g. "4k". */
export function formatSkillTokensCompact(totalTokens: number | null | undefined): string | null {
  if (totalTokens == null || totalTokens <= 0) {
    return null;
  }
  if (totalTokens >= 1000) {
    return `${Math.round(totalTokens / 1000)}k`;
  }
  return String(totalTokens);
}
