/**
 * Maps job titles / industries to permit-analytics career domains (sector buckets).
 */

export type DomainKey =
  | 'TECH'
  | 'HEALTHCARE'
  | 'FINANCE'
  | 'CONSTRUCTION'
  | 'EDUCATION'
  | 'HOSPITALITY'
  | 'PHARMA'
  | 'AGRICULTURE';

type DomainRule = { key: DomainKey; keywords: string[] };

const DOMAIN_RULES: DomainRule[] = [
  {
    key: 'TECH',
    keywords: [
      'software', 'developer', 'engineer', 'full stack', 'frontend', 'backend',
      'data', ' ai ', ' ml ', 'devops', 'cloud', 'qa', 'architect',
    ],
  },
  {
    key: 'HEALTHCARE',
    keywords: [
      'nurse', 'doctor', 'care', 'medical', 'health', 'pharmacist', 'physio',
      'dental', 'surgeon', ' gp ',
    ],
  },
  {
    key: 'FINANCE',
    keywords: [
      'finance', 'accountant', 'risk', 'banking', 'investment', 'analyst',
      'audit', 'tax', 'treasury',
    ],
  },
  {
    key: 'CONSTRUCTION',
    keywords: [
      'builder', 'construction', 'civil', 'structural', 'surveyor', 'quantity',
      'planning',
    ],
  },
  {
    key: 'EDUCATION',
    keywords: [
      'teacher', 'lecturer', 'professor', 'tutor', 'trainer', 'research', 'academic',
    ],
  },
  {
    key: 'HOSPITALITY',
    keywords: [
      'chef', 'hotel', 'hospitality', 'restaurant', 'catering', 'bartender', 'kitchen',
    ],
  },
  {
    key: 'PHARMA',
    keywords: [
      'pharma', 'clinical', 'biotech', 'laboratory', 'regulatory', 'drug',
      'life sciences',
    ],
  },
  {
    key: 'AGRICULTURE',
    keywords: [
      'farm', 'agriculture', 'agri', 'food production', 'fisheries', 'forestry',
    ],
  },
];

const LABELS: Record<DomainKey, string> = {
  TECH: 'Technology',
  HEALTHCARE: 'Healthcare',
  FINANCE: 'Finance',
  CONSTRUCTION: 'Construction',
  EDUCATION: 'Education',
  HOSPITALITY: 'Hospitality',
  PHARMA: 'Pharma & Life Sciences',
  AGRICULTURE: 'Agriculture',
};

const EMOJIS: Record<DomainKey, string> = {
  TECH: '💻',
  HEALTHCARE: '🏥',
  FINANCE: '📊',
  CONSTRUCTION: '🏗️',
  EDUCATION: '📚',
  HOSPITALITY: '🍽️',
  PHARMA: '💊',
  AGRICULTURE: '🌾',
};

/** Pad with spaces so short tokens like "ai" match as whole words where needed. */
function normalizeText(jobTitle: string, industry?: string): string {
  const combined = `${jobTitle} ${industry ?? ''}`.toLowerCase();
  return ` ${combined.replace(/\s+/g, ' ')} `;
}

export function resolveDomainKey(jobTitle: string, industry?: string): DomainKey {
  const haystack = normalizeText(jobTitle, industry);
  for (const rule of DOMAIN_RULES) {
    if (rule.keywords.some((kw) => haystack.includes(kw))) {
      return rule.key;
    }
  }
  return 'TECH';
}

export function getDomainLabel(key: DomainKey): string {
  return LABELS[key];
}

export function getDomainEmoji(key: DomainKey): string {
  return EMOJIS[key];
}

/** Full card labels for onboarding and dashboard. */
export const DOMAIN_OPTIONS: { key: DomainKey; label: string; icon: string }[] = [
  { key: 'TECH', label: 'Technology & Software', icon: '💻' },
  { key: 'HEALTHCARE', label: 'Healthcare & Medical', icon: '🏥' },
  { key: 'FINANCE', label: 'Finance & Banking', icon: '💰' },
  { key: 'CONSTRUCTION', label: 'Construction & Engineering', icon: '🏗️' },
  { key: 'EDUCATION', label: 'Education & Research', icon: '📚' },
  { key: 'HOSPITALITY', label: 'Hospitality & Catering', icon: '🍽️' },
  { key: 'PHARMA', label: 'Pharma & Life Sciences', icon: '💊' },
  { key: 'AGRICULTURE', label: 'Agriculture & Food', icon: '🌾' },
];

const DOMAIN_SECTOR_CODE: Record<DomainKey, string> = {
  TECH: 'J',
  HEALTHCARE: 'Q',
  FINANCE: 'K',
  CONSTRUCTION: 'F',
  EDUCATION: 'P',
  HOSPITALITY: 'I',
  PHARMA: 'C',
  AGRICULTURE: 'A',
};

const DOMAIN_KEYS = new Set<string>(DOMAIN_OPTIONS.map((o) => o.key));

export function isDomainKey(value: string): value is DomainKey {
  return DOMAIN_KEYS.has(value.toUpperCase());
}

export function getDomainSectorCode(key: DomainKey): string {
  return DOMAIN_SECTOR_CODE[key];
}

export function resolveProfileDomainKey(
  profile: {
    jobDomain?: string;
    goalTitle?: string;
    targetRoles?: string[];
    workExperience?: Array<{ jobTitle?: string }>;
    sectors?: string[];
  } | null | undefined,
): DomainKey {
  const stored = profile?.jobDomain?.trim().toUpperCase();
  if (stored && isDomainKey(stored)) {
    return stored;
  }
  return resolveDomainKey(
    profile?.goalTitle
      ?? profile?.targetRoles?.[0]
      ?? profile?.workExperience?.[0]?.jobTitle
      ?? '',
    profile?.sectors?.[0] ?? '',
  );
}
