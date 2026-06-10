import assert from 'node:assert/strict';
import test from 'node:test';
import type { Request, Response } from 'express';
import billingRoutes from './billing.routes.js';

type RouteLayer = {
  handle?: unknown;
  route?: {
    path: string;
    methods: Record<string, boolean>;
    stack: { name: string; handle: { name?: string } }[];
  };
};

function postRoute(path: string): RouteLayer | undefined {
  return ((billingRoutes.stack as unknown) as RouteLayer[]).find(
    (layer) => layer.route?.path === path && layer.route.methods.post,
  );
}

function getRoute(path: string): RouteLayer | undefined {
  return ((billingRoutes.stack as unknown) as RouteLayer[]).find(
    (layer) => layer.route?.path === path && layer.route.methods.get,
  );
}

test('billing webhook is not on the router (registered in server.ts with rate limit)', () => {
  const webhook = postRoute('/webhook');
  assert.equal(webhook, undefined);
});

test('billing plans GET is registered without authGuard', () => {
  const plans = getRoute('/plans');
  assert.ok(plans?.route);
  const middlewareNames = plans.route!.stack.map((layer) => layer.name || layer.handle?.name || '');
  assert.ok(!middlewareNames.some((name) => name.includes('authGuard')));
});

test('billing checkout-session requires authGuard before proxy', () => {
  const checkout = postRoute('/checkout-session');
  assert.ok(checkout?.route);
  assert.equal(checkout.route!.stack.length, 2);
  const first = checkout.route!.stack[0].name || checkout.route!.stack[0].handle?.name || '';
  assert.match(first, /authGuard/i);
});

test('billing subscription GET requires authGuard', () => {
  const subscription = getRoute('/subscription');
  assert.ok(subscription?.route);
  const first = subscription.route!.stack[0].name || subscription.route!.stack[0].handle?.name || '';
  assert.match(first, /authGuard/i);
});

test('unknown billing route returns 404 JSON', async () => {
  const catchAll = ((billingRoutes.stack as unknown) as RouteLayer[]).find((layer) => !layer.route);
  assert.ok(catchAll?.handle);

  const req = { method: 'GET', path: '/unknown-billing-path' } as Request;
  let statusCode = 0;
  let body: { code?: string } = {};
  const res = {
    status(code: number) {
      statusCode = code;
      return this;
    },
    json(payload: { code?: string }) {
      body = payload;
      return this;
    },
  } as Response;

  await new Promise<void>((resolve, reject) => {
    try {
      (catchAll.handle as (req: Request, res: Response) => void)(req, res);
      resolve();
    } catch (err) {
      reject(err);
    }
  });

  assert.equal(statusCode, 404);
  assert.equal(body.code, 'BILLING_ROUTE_NOT_FOUND');
});
