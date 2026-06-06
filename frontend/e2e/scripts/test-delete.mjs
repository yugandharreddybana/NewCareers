import { request } from '@playwright/test';

const ctx = await request.newContext();
const login = await ctx.post('http://localhost:4000/api/v1/auth/login', {
  data: { email: 'test@newcareer.com', password: 'Test@1234' },
  headers: { 'X-Requested-With': 'XMLHttpRequest' },
});
const body = await login.json();
const del = await ctx.post('http://localhost:4000/api/v1/account/delete', {
  data: { password: 'Test@1234' },
  headers: {
    Authorization: `Bearer ${body.token}`,
    'X-Requested-With': 'XMLHttpRequest',
  },
});
console.log('playwright delete', del.status(), await del.text());
const check = await ctx.post('http://localhost:4000/api/v1/auth/onboarding/check-email', {
  data: { email: 'test@newcareer.com' },
  headers: { 'X-Requested-With': 'XMLHttpRequest' },
});
console.log('check-email after delete', check.status(), await check.text());
await ctx.dispose();
