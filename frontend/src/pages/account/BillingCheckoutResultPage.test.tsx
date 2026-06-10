import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { SUBSCRIPTION_QUERY_KEY } from '@/hooks/useSubscription';
import BillingCheckoutResultPage from './BillingCheckoutResultPage';

const getSubscription = vi.hoisted(() => vi.fn());

vi.mock('@/services/billingApi', () => ({
  billingApi: {
    getSubscription,
  },
}));

describe('BillingCheckoutResultPage', () => {
  it('invalidates the subscription query used by useSubscription on success', async () => {
    getSubscription.mockResolvedValue({ status: 'ACTIVE' });
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const invalidate = vi.spyOn(client, 'invalidateQueries');

    render(
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={['/billing/success']}>
          <BillingCheckoutResultPage variant="success" />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    await waitFor(() => {
      expect(invalidate).toHaveBeenCalledWith({ queryKey: SUBSCRIPTION_QUERY_KEY });
    });
    await waitFor(() => {
      expect(getSubscription).toHaveBeenCalled();
    });
  });
});
