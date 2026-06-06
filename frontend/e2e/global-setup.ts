import { request } from '@playwright/test';
import { ensureTestUser, isLiveStackUp } from './helpers/stack';

export default async function globalSetup(): Promise<void> {
  const ctx = await request.newContext();
  try {
    if (await isLiveStackUp(ctx)) {
      await ensureTestUser(ctx);
    }
  } finally {
    await ctx.dispose();
  }
}
