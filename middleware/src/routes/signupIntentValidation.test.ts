import assert from 'node:assert/strict';
import test from 'node:test';
import { body, validationResult } from 'express-validator';

/** Mirrors signup-intent consent validators in auth.routes.ts */
const consentValidators = [
  body('consents.termsAccepted').isBoolean().custom((v) => v === true),
  body('consents.aiProcessingAccepted').isBoolean().custom((v) => v === true),
];

async function runConsentValidation(consents: Record<string, unknown>) {
  const req = { body: { consents } };
  await Promise.all(consentValidators.map((chain) => chain.run(req)));
  return validationResult(req).array();
}

test('signup-intent accepts JSON boolean true for required consents', async () => {
  const errors = await runConsentValidation({
    termsAccepted: true,
    aiProcessingAccepted: true,
  });
  assert.equal(errors.length, 0);
});

test('signup-intent rejects false required consents', async () => {
  const errors = await runConsentValidation({
    termsAccepted: false,
    aiProcessingAccepted: true,
  });
  assert.ok(errors.some((e) => e.path === 'consents.termsAccepted'));
});
