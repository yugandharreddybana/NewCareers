import { describe, expect, it } from 'vitest';
import {
  degreeDisplayLabel,
  degreeLevelLabel,
  parseDegree,
  stripFieldFromDegreeTitle,
} from './degreeNormalization';

describe('parseDegree', () => {
  it('maps B.Tech to bachelors', () => {
    const r = parseDegree('B.Tech Computer Science');
    expect(r.level).toBe('bachelors');
    expect(r.title).toBe('B.Tech Computer Science');
    expect(r.fieldHint).toBe('Computer Science');
  });

  it('maps MSc to masters', () => {
    const r = parseDegree('MSc Data Science');
    expect(r.level).toBe('masters');
  });

  it('maps PhD to phd', () => {
    expect(parseDegree('Ph.D. in Physics').level).toBe('phd');
  });

  it('maps Bachelor of Science', () => {
    expect(parseDegree('Bachelor of Science in Computer Science').level).toBe('bachelors');
  });
});

describe('degreeLevelLabel', () => {
  it('returns human label', () => {
    expect(degreeLevelLabel('masters')).toBe("Master's");
  });
});

describe('stripFieldFromDegreeTitle', () => {
  it('removes trailing field when stored separately', () => {
    expect(stripFieldFromDegreeTitle('M.Sc Computer Science', 'Computer Science')).toBe('M.Sc');
    expect(stripFieldFromDegreeTitle('MSc in Data Science', 'Data Science')).toBe('MSc');
  });
});

describe('degreeDisplayLabel', () => {
  it('shows degree without field when fieldOfStudy is set', () => {
    expect(degreeDisplayLabel('masters', 'M.Sc Computer Science', 'Computer Science')).toBe(
      'M.Sc',
    );
  });
});
