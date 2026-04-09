import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../lib/supabaseClient', () => import('./__mocks__/supabaseClient'));

import { mockSupabase } from './__mocks__/supabaseClient';
import {
  checkBackendHealth,
  getCachedForecasts,
  refreshForecasts,
  getForecast,
  getAvailableSkus,
  getForecastWithData,
} from '../services/forecastService';

// Mock global fetch
const mockFetch = vi.fn();
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal('fetch', mockFetch);
});
afterEach(() => {
  vi.unstubAllGlobals();
});

function makeFetchResponse(body: unknown, ok = true, status = 200) {
  return Promise.resolve({
    ok,
    status,
    json: () => Promise.resolve(body),
  });
}

// ─── checkBackendHealth ──────────────────────────────────────────────────────

describe('checkBackendHealth', () => {
  it('returns healthy=true when backend responds with status=healthy', async () => {
    mockFetch.mockReturnValueOnce(
      makeFetchResponse({ status: 'healthy', supabase_connected: true })
    );

    const result = await checkBackendHealth();

    expect(result.healthy).toBe(true);
    expect(result.supabaseConnected).toBe(true);
  });

  it('returns healthy=false when fetch throws', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network error'));

    const result = await checkBackendHealth();

    expect(result.healthy).toBe(false);
    expect(result.supabaseConnected).toBeUndefined();
  });

  it('returns healthy=false when backend returns non-healthy status', async () => {
    mockFetch.mockReturnValueOnce(
      makeFetchResponse({ status: 'degraded', supabase_connected: false })
    );

    const result = await checkBackendHealth();
    expect(result.healthy).toBe(false);
  });
});

// ─── getCachedForecasts ──────────────────────────────────────────────────────

describe('getCachedForecasts', () => {
  it('returns cached forecasts from Supabase directly when available', async () => {
    const mockData = [
      { sku: 'SKU-A', predictions: [{ ds: '2024-01-01', yhat: 100, yhat_lower: 80, yhat_upper: 120 }], generated_at: '2024-01-01T00:00:00Z' },
    ];

    const selectMock = vi.fn().mockResolvedValueOnce({ data: mockData, error: null });
    mockSupabase.from.mockReturnValueOnce({ select: selectMock });

    const result = await getCachedForecasts();

    expect(result.success).toBe(true);
    expect(result.cached).toBe(true);
    expect(result.forecasts['SKU-A']).toHaveLength(1);
    expect(result.generated_at!['SKU-A']).toBe('2024-01-01T00:00:00Z');
  });

  it('falls back to backend when Supabase returns empty data', async () => {
    const selectMock = vi.fn().mockResolvedValueOnce({ data: [], error: null });
    mockSupabase.from.mockReturnValueOnce({ select: selectMock });

    const backendResponse = {
      success: true,
      cached: true,
      forecasts: { 'SKU-B': [] },
    };
    mockFetch.mockReturnValueOnce(makeFetchResponse(backendResponse));

    const result = await getCachedForecasts();

    expect(result.success).toBe(true);
    expect(result.forecasts['SKU-B']).toBeDefined();
  });

  it('falls back to backend when Supabase throws', async () => {
    const selectMock = vi.fn().mockResolvedValueOnce({ data: null, error: new Error('DB error') });
    mockSupabase.from.mockReturnValueOnce({ select: selectMock });

    const backendResponse = { success: true, cached: false, forecasts: {} };
    mockFetch.mockReturnValueOnce(makeFetchResponse(backendResponse));

    const result = await getCachedForecasts();
    expect(result.success).toBe(true);
  });

  it('returns failure when both Supabase and backend fail', async () => {
    const selectMock = vi.fn().mockResolvedValueOnce({ data: null, error: new Error('DB error') });
    mockSupabase.from.mockReturnValueOnce({ select: selectMock });

    mockFetch.mockRejectedValueOnce(new Error('Network error'));

    const result = await getCachedForecasts();

    expect(result.success).toBe(false);
    expect(result.cached).toBe(false);
    expect(result.error).toBe('Network error');
  });
});

// ─── refreshForecasts ────────────────────────────────────────────────────────

describe('refreshForecasts', () => {
  it('posts to /api/forecast/refresh with correct body', async () => {
    const backendResponse = {
      success: true,
      cached: false,
      forecasts: { 'SKU-A': [] },
      model_info: { forecast_periods: 90, frequency: 'D', skus_processed: 1, generated_at: '2024-01-01' },
    };
    mockFetch.mockReturnValueOnce(makeFetchResponse(backendResponse));

    const result = await refreshForecasts(['SKU-A'], 90, 'D');

    expect(result.success).toBe(true);
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/forecast/refresh'),
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ skus: ['SKU-A'], periods: 90, frequency: 'D' }),
      })
    );
  });

  it('uses default periods and frequency when not provided', async () => {
    mockFetch.mockReturnValueOnce(makeFetchResponse({ success: true, cached: false, forecasts: {} }));
    await refreshForecasts();
    expect(mockFetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        body: JSON.stringify({ skus: undefined, periods: 90, frequency: 'D' }),
      })
    );
  });

  it('returns failure when fetch throws', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Timeout'));
    const result = await refreshForecasts();
    expect(result.success).toBe(false);
    expect(result.error).toBe('Timeout');
  });

  it('returns failure on non-ok HTTP response', async () => {
    mockFetch.mockReturnValueOnce(makeFetchResponse({}, false, 500));
    const result = await refreshForecasts();
    expect(result.success).toBe(false);
    expect(result.error).toContain('500');
  });
});

// ─── getForecast ─────────────────────────────────────────────────────────────

describe('getForecast', () => {
  it('returns forecast data for a valid SKU', async () => {
    const forecast = [{ ds: '2024-01-02', yhat: 150, yhat_lower: 120, yhat_upper: 180 }];
    mockFetch.mockReturnValueOnce(makeFetchResponse({ success: true, forecast }));

    const result = await getForecast('SKU-A');

    expect(result.success).toBe(true);
    expect(result.forecast).toEqual(forecast);
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/forecast'),
      expect.objectContaining({
        body: JSON.stringify({ sku: 'SKU-A', periods: 90, frequency: 'D' }),
      })
    );
  });

  it('returns failure on network error', async () => {
    mockFetch.mockRejectedValueOnce(new Error('No network'));
    const result = await getForecast('SKU-A');
    expect(result.success).toBe(false);
    expect(result.error).toBe('No network');
  });

  it('returns failure on non-ok response', async () => {
    mockFetch.mockReturnValueOnce(makeFetchResponse({}, false, 404));
    const result = await getForecast('SKU-A');
    expect(result.success).toBe(false);
  });
});

// ─── getAvailableSkus ────────────────────────────────────────────────────────

describe('getAvailableSkus', () => {
  it('returns list of SKUs', async () => {
    const skus = [
      { sku: 'SKU-A', data_points: 100, start_date: '2023-01-01', end_date: '2023-12-31', total_sales: 5000, avg_daily_sales: 13.7 },
    ];
    mockFetch.mockReturnValueOnce(makeFetchResponse({ success: true, skus }));

    const result = await getAvailableSkus();

    expect(result.success).toBe(true);
    expect(result.skus).toEqual(skus);
  });

  it('returns empty skus on fetch failure', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Timeout'));
    const result = await getAvailableSkus();
    expect(result.success).toBe(false);
    expect(result.skus).toEqual([]);
  });
});

// ─── getForecastWithData ─────────────────────────────────────────────────────

describe('getForecastWithData', () => {
  it('posts sales_data to forecast endpoint', async () => {
    const salesData = [{ ds: '2024-01-01', y: 100 }, { ds: '2024-01-02', y: 120 }];
    const forecastPoints = [{ ds: '2024-04-01', yhat: 130, yhat_lower: 110, yhat_upper: 150 }];
    mockFetch.mockReturnValueOnce(makeFetchResponse({ success: true, forecast: forecastPoints }));

    const result = await getForecastWithData(salesData, 30, 'D');

    expect(result.success).toBe(true);
    expect(result.forecast).toEqual(forecastPoints);
    expect(mockFetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        body: JSON.stringify({ sales_data: salesData, periods: 30, frequency: 'D' }),
      })
    );
  });

  it('returns failure on network error', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Offline'));
    const result = await getForecastWithData([]);
    expect(result.success).toBe(false);
    expect(result.error).toBe('Offline');
  });
});
