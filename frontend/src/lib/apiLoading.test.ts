import { describe, it, expect, beforeEach } from 'vitest';
import type { InternalAxiosRequestConfig } from 'axios';
import {
  startApiLoading,
  endApiLoading,
  getApiLoadingSnapshot,
  resetApiLoading,
} from './apiLoading';

function mockConfig(url = '/profile'): InternalAxiosRequestConfig {
  return { url, method: 'get' } as InternalAxiosRequestConfig;
}

describe('apiLoading', () => {
  beforeEach(() => {
    resetApiLoading();
  });

  it('tracks and clears a request via __loaderTrackId', () => {
    const config = mockConfig();
    startApiLoading(config);
    expect(getApiLoadingSnapshot().active).toBe(true);
    endApiLoading(config);
    expect(getApiLoadingSnapshot().active).toBe(false);
  });

  it('clears via WeakMap when __loaderTrackId is stripped from same config', () => {
    const config = mockConfig('/jobs');
    startApiLoading(config);
    delete config.__loaderTrackId;
    endApiLoading(config);
    expect(getApiLoadingSnapshot().active).toBe(false);
  });

  it('resetApiLoading clears all in-flight entries', () => {
    startApiLoading(mockConfig('/profile/cv'));
    startApiLoading(mockConfig('/jobs/fetch'));
    expect(getApiLoadingSnapshot().active).toBe(true);
    resetApiLoading();
    expect(getApiLoadingSnapshot().active).toBe(false);
  });

  it('getApiLoadingSnapshot uses last message without Array.at', () => {
    startApiLoading({ url: '/profile', method: 'get', loaderMessage: 'First' } as InternalAxiosRequestConfig);
    startApiLoading({ url: '/jobs/fetch', method: 'post' } as InternalAxiosRequestConfig);
    const snap = getApiLoadingSnapshot();
    expect(snap.active).toBe(true);
    expect(snap.message.length).toBeGreaterThan(0);
  });
});
