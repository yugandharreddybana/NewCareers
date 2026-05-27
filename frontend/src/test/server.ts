import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { MOCK_RECOMMENDED_JOBS } from './canonicalMockJob';
import * as fixtures from './fixtures';

const API_ROOT = '*/api/v1';

const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

function mockSkillRun(skillName: string) {
	const data = clone(
		(fixtures.MOCK_SKILL_RESULTS[skillName] as Record<string, unknown> | undefined)
			?? { text: 'Skill execution complete.' },
	);

	return {
		type: 'RESULT',
		skillName,
		data,
	};
}

const defaultHandlers = [
	http.get(`${API_ROOT}/public/stats`, () => HttpResponse.json({ jobs: 0, users: 0, skills: 14 })),

	http.post(`${API_ROOT}/auth/login`, () => HttpResponse.json({
		user: clone(fixtures.MOCK_USER),
		token: 'test-access-token',
		refreshToken: 'test-refresh-token',
	})),
	http.post(`${API_ROOT}/auth/signup`, () => HttpResponse.json({
		user: clone(fixtures.MOCK_USER),
		token: 'test-access-token',
		refreshToken: 'test-refresh-token',
	})),
	http.post(`${API_ROOT}/auth/refresh`, () => HttpResponse.json({
		token: 'test-access-token-refreshed',
		refreshToken: 'test-refresh-token',
	})),
	http.post(`${API_ROOT}/auth/logout`, () => HttpResponse.json({ success: true })),
	http.get(`${API_ROOT}/auth/me`, () => HttpResponse.json(clone(fixtures.MOCK_USER))),

	http.get(`${API_ROOT}/profile`, () => HttpResponse.json({
		...clone(fixtures.MOCK_USER),
		portfolioItems: [],
	})),
	http.put(`${API_ROOT}/profile`, async ({ request }) => {
		const body = await request.json().catch(() => ({}));
		return HttpResponse.json({
			...clone(fixtures.MOCK_USER),
			...(typeof body === 'object' && body ? body : {}),
		});
	}),
	http.post(`${API_ROOT}/profile/portfolio`, async ({ request }) => {
		const body = await request.json().catch(() => ({}));
		return HttpResponse.json({
			id: 'portfolio-item-1',
			...(typeof body === 'object' && body ? body : {}),
		});
	}),
	http.delete(`${API_ROOT}/profile/portfolio/:itemId`, () => new HttpResponse(null, { status: 204 })),

	http.get(`${API_ROOT}/jobs`, () => HttpResponse.json({
		items: clone(fixtures.MOCK_JOBS),
		dailyCount: fixtures.MOCK_FETCH_SUMMARY.dailyCount,
		dailyLimit: fixtures.MOCK_FETCH_SUMMARY.dailyLimit,
		remaining: fixtures.MOCK_FETCH_SUMMARY.remaining,
	})),
	http.get(`${API_ROOT}/jobs/:id`, ({ params }) => {
		const match = fixtures.MOCK_JOBS.find((job) => job.userJobId === params.id || job.jobId === params.id);
		return HttpResponse.json(match ? { ...clone(fixtures.MOCK_JOB_DETAIL), ...match } : clone(fixtures.MOCK_JOB_DETAIL));
	}),
	http.post(`${API_ROOT}/jobs/fetch`, () => HttpResponse.json(clone(fixtures.MOCK_FETCH_SUMMARY))),
	http.get(`${API_ROOT}/jobs/limits`, () => HttpResponse.json(clone(fixtures.MOCK_FETCH_SUMMARY))),
	http.get(`${API_ROOT}/jobs/stats`, () => HttpResponse.json(clone(fixtures.MOCK_STATS))),
	http.get(`${API_ROOT}/jobs/recommended`, () => HttpResponse.json(clone(MOCK_RECOMMENDED_JOBS))),

	http.get(`${API_ROOT}/progress/weekly-summary`, () => HttpResponse.json(clone(fixtures.MOCK_WEEKLY_SUMMARY))),
	http.get(`${API_ROOT}/progress/streaks`, () => HttpResponse.json(clone(fixtures.MOCK_STREAKS))),

	http.post(`${API_ROOT}/skills/start`, async ({ request }) => {
		const body = await request.json() as { skillName?: string };
		return HttpResponse.json(mockSkillRun(body.skillName ?? 'evaluate'));
	}),
	http.post(`${API_ROOT}/skills/conversation/reply`, async ({ request }) => {
		const body = await request.json() as { answer?: string };
		return HttpResponse.json({
			type: 'RESULT',
			skillName: 'reply',
			data: { answer: body.answer ?? '' },
		});
	}),
	http.get(`${API_ROOT}/skills/last-run/:userJobId/:skillName`, ({ params }) =>
		HttpResponse.json(mockSkillRun(String(params.skillName ?? 'evaluate'))),
	),
	http.post(`${API_ROOT}/skills/run-all/:userJobId`, () => HttpResponse.json({
		total: 2,
		succeeded: 2,
		failed: 0,
		pendingAnswers: 0,
		results: {
			evaluate: mockSkillRun('evaluate'),
			research: mockSkillRun('research'),
		},
	})),
	http.post(`${API_ROOT}/skills/run-all-async/:userJobId`, ({ params }) => HttpResponse.json({
		id: 'mock-batch-1',
		userJobId: String(params.userJobId ?? 'mock-job'),
		status: 'in_progress',
		total: 14,
		completed: 0,
		createdAt: new Date().toISOString(),
		results: {},
	})),
	http.get(`${API_ROOT}/skills/run-all/:batchId/status`, ({ params }) => HttpResponse.json({
		id: String(params.batchId ?? 'mock-batch-1'),
		userJobId: 'mock-job',
		status: 'completed',
		total: 14,
		completed: 14,
		createdAt: new Date().toISOString(),
		results: {
			evaluate: mockSkillRun('evaluate'),
			research: mockSkillRun('research'),
		},
	})),

	http.get(`${API_ROOT}/planner/upcoming`, () => HttpResponse.json(clone(fixtures.MOCK_PLANNER_UPCOMING))),

	http.get(`${API_ROOT}/experiments/variants`, () => HttpResponse.json({})),

	http.get(`${API_ROOT}/notifications`, ({ request }) => {
		const url = new URL(request.url);
		const page = Number(url.searchParams.get('page') ?? 0);
		const size = Number(url.searchParams.get('size') ?? 20);
		return HttpResponse.json({
			content: [],
			totalElements: 0,
			number: page,
			size,
			totalPages: 0,
		});
	}),
	http.get(`${API_ROOT}/notifications/unread-count`, () => HttpResponse.json({ unread: 0 })),
	http.patch(`${API_ROOT}/notifications/:id/read`, () => new HttpResponse(null, { status: 204 })),
	http.patch(`${API_ROOT}/notifications/mark-all-read`, () => new HttpResponse(null, { status: 204 })),
	http.delete(`${API_ROOT}/notifications`, () => new HttpResponse(null, { status: 204 })),

	http.get(`${API_ROOT}/workspaces`, () => HttpResponse.json(clone(fixtures.MOCK_WORKSPACES))),
	http.post(`${API_ROOT}/workspaces`, async ({ request }) => {
		const body = await request.json().catch(() => ({}));
		return HttpResponse.json({
			id: 'workspace-1',
			name: 'Mock Workspace',
			description: null,
			createdAt: new Date().toISOString(),
			members: [],
			ownerId: fixtures.MOCK_USER.id,
			...(typeof body === 'object' && body ? body : {}),
		});
	}),
	http.delete(`${API_ROOT}/workspaces/:id`, () => new HttpResponse(null, { status: 204 })),
];

export const server = setupServer(...defaultHandlers);