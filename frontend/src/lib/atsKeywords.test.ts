import { describe, expect, it } from 'vitest';
import { buildAtsKeywords, highlightAtsInText, partitionAtsKeywords } from './atsKeywords';

describe('atsKeywords', () => {
  it('builds keywords from tech stack', () => {
    const keys = buildAtsKeywords({ techStack: ['React', 'TypeScript'], targetRoles: [] });
    expect(keys).toContain('React');
    expect(keys).toContain('TypeScript');
  });

  it('partitions matched vs unmatched', () => {
    const { matched, unmatched } = partitionAtsKeywords(
      'We use React and Node for our platform.',
      ['React', 'TypeScript', 'GraphQL'],
    );
    expect(matched).toEqual(['React']);
    expect(unmatched).toContain('TypeScript');
    expect(unmatched).toContain('GraphQL');
  });

  it('highlights only ATS terms in text', () => {
    const spans = highlightAtsInText('Experience with React required.', ['React']);
    expect(spans.some(s => s.tone === 'match' && s.text === 'React')).toBe(true);
    expect(spans.some(s => s.tone === 'plain')).toBe(true);
  });
});
