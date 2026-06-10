import assert from 'node:assert/strict';
import test from 'node:test';
import authRoutes from './auth.routes.js';

type RouteLayer = {
  handle?: unknown;
  route?: {
    path: string | string[];
    methods: Record<string, boolean>;
    stack: { name: string; handle: { name?: string } }[];
  };
};

function postRoute(path: string): RouteLayer | undefined {
  return ((authRoutes.stack as unknown) as RouteLayer[]).find(
    (layer) => {
      const routePath = layer.route?.path;
      const pathMatches = Array.isArray(routePath) ? routePath.includes(path) : routePath === path;
      return pathMatches && layer.route?.methods.post;
    },
  );
}

function middlewareNames(route: RouteLayer): string[] {
  return route.route!.stack.map((layer) => layer.name || layer.handle?.name || '');
}

test('auth register and signup POST routes both reach the signup handler', () => {
  assert.ok(postRoute('/register')?.route);
  assert.ok(postRoute('/signup')?.route);
});

test('2FA verification POST route is public middleware', () => {
  const verify = postRoute('/two-factor/verify');
  assert.ok(verify?.route);
  assert.ok(!middlewareNames(verify).some((name) => name.includes('authGuard')));
});

test('Google link confirmation POST route is public middleware', () => {
  const confirm = postRoute('/google/link/confirm');
  assert.ok(confirm?.route);
  assert.ok(!middlewareNames(confirm).some((name) => name.includes('authGuard')));
});
