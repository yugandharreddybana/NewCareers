const ALLOWED_STRIPE_HOSTS = new Set(['checkout.stripe.com', 'billing.stripe.com']);

/**
 * Navigate to a Stripe-hosted checkout or customer portal URL after host allowlisting.
 */
export function assignStripeHostedUrl(url: string): void {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error('Invalid billing redirect URL');
  }
  if (parsed.protocol !== 'https:' || !ALLOWED_STRIPE_HOSTS.has(parsed.hostname)) {
    throw new Error('Untrusted billing redirect URL');
  }
  window.location.assign(parsed.href);
}
