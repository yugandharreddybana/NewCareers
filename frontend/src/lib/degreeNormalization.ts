export type DegreeLevel =
  | 'bachelors'
  | 'masters'
  | 'phd'
  | 'associate'
  | 'diploma'
  | 'certificate'
  | 'other';

export type ParsedDegree = {
  level: DegreeLevel;
  title: string;
  fieldHint?: string;
};

export const DEGREE_LEVEL_OPTIONS: { value: DegreeLevel; label: string }[] = [
  { value: 'bachelors', label: "Bachelor's" },
  { value: 'masters', label: "Master's" },
  { value: 'phd', label: 'Ph.D.' },
  { value: 'associate', label: 'Associate' },
  { value: 'diploma', label: 'Diploma' },
  { value: 'certificate', label: 'Certificate' },
  { value: 'other', label: 'Other' },
];

export function degreeLevelLabel(level: DegreeLevel | ''): string {
  if (!level) return '';
  return DEGREE_LEVEL_OPTIONS.find(o => o.value === level)?.label ?? level;
}

const BACHELORS = /\b(b\.?\s*tech\.?|b\.?e\.?|b\.?s\.?c?\.?|b\.?a\.?|b\.?eng\.?|bachelor|ba\b|bsc\b|btech\b|b\.?tech\b)/i;
const MASTERS = /\b(m\.?\s*tech\.?|m\.?s\.?c?\.?|m\.?a\.?|m\.?b\.?a\.?|m\.?eng\.?|master|msc\b|mba\b|mtech\b)/i;
const PHD = /\b(ph\.?d\.?|doctorate|doctoral|doctor of)/i;
const ASSOCIATE = /\b(associate|hnd\b|h\.?n\.?d\.?)/i;
const DIPLOMA = /\b(diploma|pg\s*dip|pgdip)/i;
const CERTIFICATE = /\b(certificate|cert\.)/i;

export function parseDegree(raw: string): ParsedDegree {
  const trimmed = raw.trim();
  if (!trimmed) {
    return { level: 'other', title: '' };
  }

  let level: DegreeLevel = 'other';
  if (PHD.test(trimmed)) level = 'phd';
  else if (MASTERS.test(trimmed)) level = 'masters';
  else if (BACHELORS.test(trimmed)) level = 'bachelors';
  else if (ASSOCIATE.test(trimmed)) level = 'associate';
  else if (DIPLOMA.test(trimmed)) level = 'diploma';
  else if (CERTIFICATE.test(trimmed)) level = 'certificate';

  const fieldHint = extractFieldHint(trimmed);
  return fieldHint ? { level, title: trimmed, fieldHint } : { level, title: trimmed };
}

function extractFieldHint(degree: string): string | undefined {
  const inMatch = degree.match(/\b(?:in|of)\s+(.+)$/i);
  if (inMatch?.[1]) return inMatch[1].trim();

  const stripped = degree.replace(
    /^(?:b\.?\s*tech\.?|b\.?e\.?|b\.?s\.?c?\.?|b\.?a\.?|m\.?\s*tech\.?|m\.?s\.?c?\.?|m\.?a\.?|m\.?b\.?a\.?|ph\.?d\.?|bachelor(?:'s)?|master(?:'s)?|doctor(?:ate)?)\s*/i,
    '',
  ).trim();
  if (stripped && stripped !== degree.trim()) return stripped;
  return undefined;
}

export function isDegreeLevel(value: string): value is DegreeLevel {
  return DEGREE_LEVEL_OPTIONS.some(o => o.value === value);
}

/** Removes embedded field-of-study text from a degree title when field is stored separately. */
export function stripFieldFromDegreeTitle(degreeTitle: string, fieldOfStudy: string): string {
  const title = degreeTitle.trim();
  const field = fieldOfStudy.trim();
  if (!title || !field) return title;

  const inPattern = new RegExp(`\\s+(?:in|of)\\s+${escapeRegExp(field)}\\s*$`, 'i');
  if (inPattern.test(title)) {
    return title.replace(inPattern, '').trim();
  }

  const bareField = new RegExp(`\\s+${escapeRegExp(field)}\\s*$`, 'i');
  if (bareField.test(title)) {
    return title.replace(bareField, '').trim();
  }

  return title;
}

/** Label shown in the degree combobox — omits field when it has its own input. */
export function degreeDisplayLabel(
  degreeLevel: DegreeLevel | '',
  degreeTitle: string,
  fieldOfStudy: string,
): string {
  const stripped = stripFieldFromDegreeTitle(degreeTitle, fieldOfStudy);
  if (stripped) return stripped;
  if (degreeLevel) return degreeLevelLabel(degreeLevel);
  return '';
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
