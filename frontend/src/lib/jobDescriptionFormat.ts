/** Normalize and structure job posting text for display. */

export type JobDescBlock =
  | { type: 'heading'; level: 2 | 3; text: string }
  | { type: 'paragraph'; text: string }
  | { type: 'list'; ordered: boolean; items: string[] };

const SHOW_MORE_LESS = /\bshow\s+(?:more|less)\b/gi;
const MARKDOWN_H2 = /^##\s+(.+)$/;
const MARKDOWN_H3 = /^###\s+(.+)$/;
const MARKDOWN_H1 = /^#\s+(.+)$/;
const BULLET = /^(\d+[.)])\s+(.+)$/;
const DASH_BULLET = /^[-*•]\s+(.+)$/;
const SECTION_HEADING = /^([A-Za-z][A-Za-z0-9\s/&-]{2,48}):\s*$/;
const ALL_CAPS_HEADING = /^[A-Z][A-Z0-9\s/&,'()-]{3,58}$/;

/** Strip UI chrome and normalize whitespace (safe in browser and tests). */
export function cleanJobDescriptionText(raw: string): string {
  if (!raw?.trim()) return '';
  let text = raw
    .replace(SHOW_MORE_LESS, '')
    .replace(/\u00a0/g, ' ')
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n[ \t]+/g, '\n')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  // Collapse stray spaces without destroying line breaks
  text = text
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n[ \t]+/g, '\n');
  return text.replace(/\n{3,}/g, '\n\n').trim();
}

export function parseJobDescriptionBlocks(plain: string): JobDescBlock[] {
  const text = cleanJobDescriptionText(plain);
  if (!text) return [];

  const lines = text.split('\n');
  const blocks: JobDescBlock[] = [];
  let listItems: string[] = [];
  let listOrdered = false;

  const flushList = () => {
    if (!listItems.length) return;
    blocks.push({ type: 'list', ordered: listOrdered, items: [...listItems] });
    listItems = [];
  };

  for (const rawLine of lines) {
    const trimmed = rawLine.trim();
    if (!trimmed) {
      flushList();
      continue;
    }

    const h1 = MARKDOWN_H1.exec(trimmed);
    if (h1) {
      flushList();
      blocks.push({ type: 'heading', level: 2, text: h1[1]!.trim() });
      continue;
    }
    const h2 = MARKDOWN_H2.exec(trimmed);
    if (h2) {
      flushList();
      blocks.push({ type: 'heading', level: 2, text: h2[1]!.trim() });
      continue;
    }
    const h3 = MARKDOWN_H3.exec(trimmed);
    if (h3) {
      flushList();
      blocks.push({ type: 'heading', level: 3, text: h3[1]!.trim() });
      continue;
    }

    const section = SECTION_HEADING.exec(trimmed);
    if (section) {
      flushList();
      blocks.push({ type: 'heading', level: 3, text: section[1]!.trim() });
      continue;
    }

    if (
      ALL_CAPS_HEADING.test(trimmed) &&
      !trimmed.includes('.') &&
      trimmed.split(/\s+/).length <= 8
    ) {
      flushList();
      blocks.push({
        type: 'heading',
        level: 3,
        text: trimmed
          .toLowerCase()
          .replace(/\b\w/g, c => c.toUpperCase()),
      });
      continue;
    }

    const numbered = BULLET.exec(trimmed);
    if (numbered) {
      const ordered = true;
      const body = numbered[2] ?? trimmed;
      if (listItems.length > 0 && listOrdered !== ordered) flushList();
      listOrdered = ordered;
      listItems.push(body);
      continue;
    }

    const dashed = DASH_BULLET.exec(trimmed);
    if (dashed) {
      const ordered = false;
      const body = dashed[1] ?? trimmed;
      if (listItems.length > 0 && listOrdered !== ordered) flushList();
      listOrdered = ordered;
      listItems.push(body);
      continue;
    }

    flushList();
    blocks.push({ type: 'paragraph', text: trimmed });
  }

  flushList();
  return blocks;
}

/** Roughly how much content to show when collapsed. */
export const JD_COLLAPSED_CHAR_LIMIT = 720;

export function descriptionExceedsCollapseLimit(plain: string): boolean {
  return cleanJobDescriptionText(plain).length > JD_COLLAPSED_CHAR_LIMIT;
}

/** First blocks that fit within the collapsed character budget. */
export function blocksForCollapsedView(blocks: JobDescBlock[]): JobDescBlock[] {
  let used = 0;
  const out: JobDescBlock[] = [];
  for (const block of blocks) {
    const size =
      block.type === 'list'
        ? block.items.join(' ').length + block.items.length * 4
        : block.text.length;
    if (out.length > 0 && used + size > JD_COLLAPSED_CHAR_LIMIT) break;
    out.push(block);
    used += size;
    if (used >= JD_COLLAPSED_CHAR_LIMIT) break;
  }
  return out.length > 0 ? out : blocks.slice(0, 1);
}
