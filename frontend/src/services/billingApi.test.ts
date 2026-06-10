import { beforeEach, describe, expect, it, vi } from 'vitest';
import { billingApi } from '@/services/billingApi';

const mockGet = vi.fn();
const mockPost = vi.fn();
const mockPut = vi.fn();

vi.mock('@/services/api', () => ({
  api: {
    get: (...args: unknown[]) => mockGet(...args),
    post: (...args: unknown[]) => mockPost(...args),
    put: (...args: unknown[]) => mockPut(...args),
  },
}));

describe('billingApi', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('getSubscription calls GET /billing/subscription', async () => {
    mockGet.mockResolvedValueOnce({ data: { plan: 'FREE', status: 'TRIALING' } });

    const result = await billingApi.getSubscription();

    expect(mockGet).toHaveBeenCalledWith('/billing/subscription');
    expect(result.plan).toBe('FREE');
  });

  it('createCheckoutSession posts plan payload', async () => {
    mockPost.mockResolvedValueOnce({ data: { url: 'https://checkout.test' } });

    const result = await billingApi.createCheckoutSession('PRO');

    expect(mockPost).toHaveBeenCalledWith('/billing/checkout-session', { plan: 'PRO' });
    expect(result.url).toBe('https://checkout.test');
  });

  it('openPortal posts to customer-portal', async () => {
    mockPost.mockResolvedValueOnce({ data: { url: 'https://portal.test' } });

    await billingApi.openPortal();

    expect(mockPost).toHaveBeenCalledWith('/billing/customer-portal', {});
  });

  it('getInvoices calls GET /billing/invoices', async () => {
    mockGet.mockResolvedValueOnce({ data: [{ id: 'in_1', amount: 1900, currency: 'eur', status: 'paid', date: '2026-01-01', pdfUrl: null }] });

    const invoices = await billingApi.getInvoices();

    expect(mockGet).toHaveBeenCalledWith('/billing/invoices');
    expect(invoices).toHaveLength(1);
  });

  it('cancel posts to /billing/cancel', async () => {
    mockPost.mockResolvedValueOnce({ data: { cancelAtPeriodEnd: true, currentPeriodEnd: '2026-07-01T00:00:00Z' } });

    const result = await billingApi.cancel();

    expect(mockPost).toHaveBeenCalledWith('/billing/cancel');
    expect(result.cancelAtPeriodEnd).toBe(true);
  });

});
