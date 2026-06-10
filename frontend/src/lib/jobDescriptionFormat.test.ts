import { describe, expect, it } from 'vitest';
import {
  cleanJobDescriptionText,
  descriptionExceedsCollapseLimit,
  parseJobDescriptionBlocks,
  preprocessJobDescription,
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

  it('splits very long paragraphs into multiple blocks', () => {
    const wall =
      'Dublin City Centre Our client is a global financial services company operating across Europe. ' +
      'They are seeking Full Stack Developers to join a high-performing team building customer-facing platforms. ' +
      'You will work with Python and React on AWS, designing APIs and modernising legacy services. ' +
      'The role offers hybrid working, strong mentorship, and a collaborative environment with clear career progression.';

    const blocks = parseJobDescriptionBlocks(wall);
    const paragraphs = blocks.filter(b => b.type === 'paragraph');
    expect(paragraphs.length).toBeGreaterThan(1);
  });

  it('preprocesses single-line RECRUITERS-style posting into sections', () => {
    const singleLine =
      'We are hiring a Senior Software Engineer for a fintech client. ' +
      'Salary: €60,000 to €85,000 DOE Hybrid: 3 days in office, 2 remote ' +
      'Tech stack: Java, Spring Boot, React Requirements: 5+ years experience ' +
      'Must have: Kubernetes, AWS';

    const preprocessed = preprocessJobDescription(singleLine);
    expect(preprocessed).toContain('\n\nSalary:');
    expect(preprocessed).toContain('\n\nHybrid:');
    expect(preprocessed).toContain('\n\nTech stack:');

    const blocks = parseJobDescriptionBlocks(singleLine);
    expect(blocks.some(b => b.type === 'heading' && /tech stack/i.test(b.text))).toBe(true);
    expect(blocks.filter(b => b.type === 'paragraph').length).toBeGreaterThan(1);
  });
});
