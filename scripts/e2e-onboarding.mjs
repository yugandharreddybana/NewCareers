/**
 * E2E onboarding smoke test against local middleware (:4000).
 * Run: node scripts/e2e-onboarding.mjs
 */
import { writeFileSync, unlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const BASE = process.env.E2E_API_URL ?? 'http://localhost:4000/api/v1';
const email = `e2e_${Date.now()}@careerops.test`;
const password = `E2e!${Date.now()}Aa9`;

class CookieJar {
  #cookies = new Map();

  ingest(response) {
    const raw = response.headers.getSetCookie?.() ?? [];
    for (const line of raw) {
      const [pair] = line.split(';');
      const eq = pair.indexOf('=');
      if (eq > 0) {
        this.#cookies.set(pair.slice(0, eq).trim(), pair.slice(eq + 1).trim());
      }
    }
  }

  header() {
    return [...this.#cookies.entries()].map(([k, v]) => `${k}=${v}`).join('; ');
  }
}

const jar = new CookieJar();

async function request(method, path, { body, token } = {}) {
  const headers = {
    'X-Requested-With': 'XMLHttpRequest',
    Accept: 'application/json',
  };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = `Bearer ${token}`;
  const cookie = jar.header();
  if (cookie) headers.Cookie = cookie;

  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  jar.ingest(res);
  const text = await res.text();
  let data;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  return { status: res.status, data };
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

const onboardingPayload = {
  name: 'E2E Jane Doe',
  goalTitle: 'Senior Product Designer',
  targetRoles: ['Software Engineer', 'Custom Role X'],
  techStack: ['React', 'TypeScript', 'CustomTech Y'],
  sectors: ['Full-time', 'Contract'],
  location: 'Dublin, Ireland',
  salaryMin: 60_000,
  salaryMax: 120_000,
  salaryCurrency: 'EUR',
  availability: '2 weeks notice',
  experienceLevel: 'senior',
  sponsorshipRequired: true,
  openToRemote: true,
  remotePolicy: 'Hybrid',
  workExperience: [
    {
      jobTitle: 'Engineer',
      companyName: 'Acme Corp',
      startDate: '2020-01',
      endDate: '',
      current: true,
      description: 'Built APIs',
    },
  ],
  education: [
    {
      schoolName: 'State University',
      degree: 'bachelors',
      fieldOfStudy: 'Computer Science',
      graduationYear: '2020',
    },
  ],
  onboarded: true,
};

async function main() {
  console.log('E2E onboarding →', BASE);

  await request('GET', '/public/stats');

  let token;
  let refreshToken;

  const signup = await request('POST', '/auth/signup', {
    body: {
      name: 'E2E Jane Doe',
      username: `e2e${Date.now()}`,
      email,
      password,
    },
  });

  if (signup.status === 200) {
    token = signup.data?.token;
    refreshToken = signup.data?.refreshToken;
    console.log('✓ signup', email);
  } else {
    console.log('signup:', signup.status, JSON.stringify(signup.data), '→ using dev seed user');
    const login = await request('POST', '/auth/login', {
      body: { email: 'dev@careerops.ie', password: 'password' },
    });
    assert(login.status === 200, `login failed: ${login.status} ${JSON.stringify(login.data)}`);
    token = login.data?.token;
    refreshToken = login.data?.refreshToken;
    console.log('✓ login dev@careerops.ie');
  }

  assert(refreshToken, 'missing refreshToken');

  const put = await request('PUT', '/profile', { token, body: onboardingPayload });
  assert(put.status === 200, `PUT /profile failed: ${put.status} ${JSON.stringify(put.data)}`);
  console.log('✓ PUT /profile');

  const me = await request('GET', '/auth/me', { token });
  assert(me.status === 200, `GET /auth/me failed: ${me.status}`);
  assert(me.data?.onboarded === true, 'user not onboarded after save');
  console.log('✓ GET /auth/me onboarded=true');

  const profile = await request('GET', '/profile', { token });
  assert(profile.status === 200, `GET /profile failed: ${profile.status}`);
  const p = profile.data;
  assert(p.goalTitle === onboardingPayload.goalTitle, 'goalTitle mismatch');
  assert(p.targetRoles?.includes('Software Engineer'), 'targetRoles missing');
  assert(p.techStack?.includes('React'), 'techStack missing');
  assert(p.salaryMin === 60_000 && p.salaryMax === 120_000, 'salary mismatch');
  assert(p.availability === '2 weeks notice', 'availability mismatch');
  assert(p.workExperience?.length === 1, 'workExperience missing');
  assert(p.education?.length === 1, 'education missing');
  assert(p.onboarded === true, 'profile.onboarded false');
  console.log('✓ GET /profile all fields verified');

  // CV upload (minimal PDF) — optional; warn if storage unavailable
  const pdfPath = join(tmpdir(), `e2e-cv-${Date.now()}.pdf`);
  const minimalPdf = Buffer.from(
    '%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n',
    'utf8',
  );
  writeFileSync(pdfPath, minimalPdf);
  try {
    const form = new FormData();
    form.append('file', new Blob([minimalPdf], { type: 'application/pdf' }), 'e2e-resume.pdf');
    const cvRes = await fetch(`${BASE}/profile/cv`, {
      method: 'POST',
      headers: {
        'X-Requested-With': 'XMLHttpRequest',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(jar.header() ? { Cookie: jar.header() } : {}),
      },
      body: form,
    });
    jar.ingest(cvRes);
    const cvBody = await cvRes.json().catch(() => ({}));
    if (cvRes.status === 200) {
      console.log('✓ POST /profile/cv', cvBody.fileName ?? cvBody);
    } else {
      console.warn('⚠ POST /profile/cv skipped/failed:', cvRes.status, cvBody);
    }
  } finally {
    try {
      unlinkSync(pdfPath);
    } catch {
      /* ignore */
    }
  }

  // Token refresh + retry profile read
  const refreshed = await request('POST', '/auth/refresh', {
    body: { refreshToken },
  });
  assert(refreshed.status === 200, `refresh failed: ${refreshed.status}`);
  assert(refreshed.data?.token, 'refresh missing token in body');
  const profile2 = await request('GET', '/profile', { token: refreshed.data.token });
  assert(profile2.status === 200, 'profile read after refresh failed');
  console.log('✓ refresh + profile read');

  console.log('\n✅ E2E onboarding passed');
}

main().catch(err => {
  console.error('\n❌ E2E failed:', err.message);
  process.exit(1);
});
