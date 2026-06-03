import { describe, expect, it } from 'vitest';
import {
  cleanJobDescriptionText,
  descriptionExceedsCollapseLimit,
  parseJobDescriptionBlocks,
} from './jobDescriptionFormat';

describe('jobDescriptionFormat', () => {
  it('removes Show more / Show less artifacts', () => {
    const raw = 'About the role. Show more\n\nFull details here. Show less';
    expect(cleanJobDescriptionText(raw)).toBe('About the role.\n\nFull details here.');
  });

  it('parses markdown headings and lists', () => {
    const blocks = parseJobDescriptionBlocks(`## About the Role

We build great products.

## Requirements

- React experience
- TypeScript
1. First item
2. Second item
`);
    expect(blocks.some(b => b.type === 'heading' && b.text === 'About the Role')).toBe(true);
    expect(blocks.some(b => b.type === 'list' && b.items.includes('React experience'))).toBe(true);
    expect(blocks.some(b => b.type === 'list' && b.ordered && b.items.length === 2)).toBe(true);
  });

  it('detects collapse threshold', () => {
    expect(descriptionExceedsCollapseLimit('short')).toBe(false);
    expect(descriptionExceedsCollapseLimit('x'.repeat(800))).toBe(true);
  });
});
