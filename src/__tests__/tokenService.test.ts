import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../lib/supabaseClient', () => import('./__mocks__/supabaseClient'));

import { mockSupabase, mockQueryBuilder } from './__mocks__/supabaseClient';
import {
  createOrderToken,
  updateTokenStatus,
  getActiveTokens,
  getReadyUnpaidTokens,
  getTokenHistory,
  getKDSSettings,
  createTokensBatch,
  getTokenQueuePosition,
  updateTokenQueuePosition,
} from '../services/tokenService';

// Helper: reset all mocks before each test
beforeEach(() => {
  vi.clearAllMocks();
});

// ─── createOrderToken ────────────────────────────────────────────────────────

describe('createOrderToken', () => {
  it('returns success with token data on valid params', async () => {
    mockSupabase.rpc.mockResolvedValueOnce({
      data: [{ token_number: 42, id: 'tok-1' }],
      error: null,
    });

    const result = await createOrderToken({
      sale_id: 'sale-1',
      business_account_id: 'biz-1',
      is_restaurant_order: true,
    });

    expect(result.success).toBe(true);
    expect(result.tokenNumber).toBe(42);
    expect(result.data).toEqual({ token_number: 42, id: 'tok-1' });
    expect(mockSupabase.rpc).toHaveBeenCalledWith('create_order_token', {
      p_sale_id: 'sale-1',
      p_business_account_id: 'biz-1',
      p_notes: undefined,
    });
  });

  it('returns failure when supabase throws an error', async () => {
    mockSupabase.rpc.mockResolvedValueOnce({
      data: null,
      error: new Error('DB error'),
    });

    const result = await createOrderToken({
      sale_id: 'sale-x',
      business_account_id: 'biz-x',
      is_restaurant_order: false,
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe('DB error');
  });

  it('handles empty data array gracefully', async () => {
    mockSupabase.rpc.mockResolvedValueOnce({ data: [], error: null });

    const result = await createOrderToken({
      sale_id: 's',
      business_account_id: 'b',
      is_restaurant_order: true,
    });

    expect(result.success).toBe(true);
    expect(result.data).toBeNull();
    expect(result.tokenNumber).toBeUndefined();
  });
});

// ─── updateTokenStatus ───────────────────────────────────────────────────────

describe('updateTokenStatus', () => {
  it('returns success with updated token data', async () => {
    mockSupabase.rpc.mockResolvedValueOnce({
      data: [{ token_id: 'tok-1', status: 'ready' }],
      error: null,
    });

    const result = await updateTokenStatus({
      token_id: 'tok-1',
      new_status: 'ready',
    });

    expect(result.success).toBe(true);
    expect(result.data).toEqual({ token_id: 'tok-1', status: 'ready' });
  });

  it('returns failure on error', async () => {
    mockSupabase.rpc.mockResolvedValueOnce({
      data: null,
      error: new Error('Status update failed'),
    });

    const result = await updateTokenStatus({
      token_id: 'tok-1',
      new_status: 'cancelled',
      reason: 'Customer left',
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe('Status update failed');
  });
});

// ─── getActiveTokens ─────────────────────────────────────────────────────────

describe('getActiveTokens', () => {
  it('returns token list and count', async () => {
    const tokens = [{ id: 't1' }, { id: 't2' }];
    mockSupabase.rpc.mockResolvedValueOnce({ data: tokens, error: null });

    const result = await getActiveTokens('biz-1');

    expect(result.success).toBe(true);
    expect(result.data).toEqual(tokens);
    expect(result.count).toBe(2);
  });

  it('returns empty array on error', async () => {
    mockSupabase.rpc.mockResolvedValueOnce({
      data: null,
      error: new Error('Fetch failed'),
    });

    const result = await getActiveTokens('biz-1');

    expect(result.success).toBe(false);
    expect(result.data).toEqual([]);
  });
});

// ─── getReadyUnpaidTokens ────────────────────────────────────────────────────

describe('getReadyUnpaidTokens', () => {
  it('sums totalAmount across tokens', async () => {
    const tokens = [
      { id: 't1', total_amount: 100 },
      { id: 't2', total_amount: 250 },
    ];
    mockSupabase.rpc.mockResolvedValueOnce({ data: tokens, error: null });

    const result = await getReadyUnpaidTokens('biz-1');

    expect(result.success).toBe(true);
    expect(result.totalAmount).toBe(350);
  });

  it('returns 0 total when no tokens exist', async () => {
    mockSupabase.rpc.mockResolvedValueOnce({ data: [], error: null });

    const result = await getReadyUnpaidTokens('biz-1');

    expect(result.totalAmount).toBe(0);
  });
});

// ─── getTokenHistory ─────────────────────────────────────────────────────────

describe('getTokenHistory', () => {
  it('queries token_status_history filtered by token_id', async () => {
    const history = [{ id: 'h1', changed_at: '2024-01-01' }];

    // Chain: from().select().eq().order() → resolves with history
    const orderMock = vi.fn().mockResolvedValueOnce({ data: history, error: null });
    const eqMock = vi.fn().mockReturnValue({ order: orderMock });
    const selectMock = vi.fn().mockReturnValue({ eq: eqMock });
    mockSupabase.from.mockReturnValueOnce({ select: selectMock });

    const result = await getTokenHistory('tok-1');

    expect(result.success).toBe(true);
    expect(result.data).toEqual(history);
    expect(mockSupabase.from).toHaveBeenCalledWith('token_status_history');
    expect(eqMock).toHaveBeenCalledWith('token_id', 'tok-1');
  });

  it('returns empty array on DB error', async () => {
    const orderMock = vi.fn().mockResolvedValueOnce({ data: null, error: new Error('Oops') });
    const eqMock = vi.fn().mockReturnValue({ order: orderMock });
    const selectMock = vi.fn().mockReturnValue({ eq: eqMock });
    mockSupabase.from.mockReturnValueOnce({ select: selectMock });

    const result = await getTokenHistory('tok-bad');

    expect(result.success).toBe(false);
    expect(result.data).toEqual([]);
  });
});

// ─── getKDSSettings ──────────────────────────────────────────────────────────

describe('getKDSSettings', () => {
  it('returns settings when found', async () => {
    const settings = { id: 's1', display_mode: 'grid' };
    const singleMock = vi.fn().mockResolvedValueOnce({ data: settings, error: null });
    const eqMock = vi.fn().mockReturnValue({ single: singleMock });
    const selectMock = vi.fn().mockReturnValue({ eq: eqMock });
    mockSupabase.from.mockReturnValueOnce({ select: selectMock });

    const result = await getKDSSettings('biz-1');

    expect(result.success).toBe(true);
    expect(result.data).toEqual(settings);
  });

  it('returns null data when not found (PGRST116)', async () => {
    const singleMock = vi.fn().mockResolvedValueOnce({
      data: null,
      error: { code: 'PGRST116', message: 'Not found' },
    });
    const eqMock = vi.fn().mockReturnValue({ single: singleMock });
    const selectMock = vi.fn().mockReturnValue({ eq: eqMock });
    mockSupabase.from.mockReturnValueOnce({ select: selectMock });

    const result = await getKDSSettings('biz-1');

    expect(result.success).toBe(true);
    expect(result.data).toBeNull();
  });
});

// ─── createTokensBatch ───────────────────────────────────────────────────────

describe('createTokensBatch', () => {
  it('creates a token for each sale ID', async () => {
    mockSupabase.rpc
      .mockResolvedValueOnce({ data: [{ token_number: 1 }], error: null })
      .mockResolvedValueOnce({ data: [{ token_number: 2 }], error: null });

    const result = await createTokensBatch(['s1', 's2'], 'biz-1');

    expect(result.success).toBe(true);
    expect(result.created).toBe(2);
    expect(result.failed).toBe(0);
    expect(mockSupabase.rpc).toHaveBeenCalledTimes(2);
  });

  it('reports partial failures', async () => {
    mockSupabase.rpc
      .mockResolvedValueOnce({ data: [{ token_number: 1 }], error: null })
      .mockResolvedValueOnce({ data: null, error: new Error('DB down') });

    const result = await createTokensBatch(['s1', 's2'], 'biz-1');

    expect(result.success).toBe(false);
    expect(result.created).toBe(1);
    expect(result.failed).toBe(1);
  });
});

// ─── getTokenQueuePosition ───────────────────────────────────────────────────

describe('getTokenQueuePosition', () => {
  it('returns queue data when found', async () => {
    const queueData = { queue_position: 3, estimated_ready_time: '2024-01-01T10:00:00Z', estimated_minutes: 15 };
    const singleMock = vi.fn().mockResolvedValueOnce({ data: queueData, error: null });
    const eqMock = vi.fn().mockReturnValue({ single: singleMock });
    const selectMock = vi.fn().mockReturnValue({ eq: eqMock });
    mockSupabase.from.mockReturnValueOnce({ select: selectMock });

    const result = await getTokenQueuePosition('tok-1');

    expect(result.success).toBe(true);
    expect(result.data?.queue_position).toBe(3);
  });

  it('returns null data on PGRST116', async () => {
    const singleMock = vi.fn().mockResolvedValueOnce({
      data: null,
      error: { code: 'PGRST116' },
    });
    const eqMock = vi.fn().mockReturnValue({ single: singleMock });
    const selectMock = vi.fn().mockReturnValue({ eq: eqMock });
    mockSupabase.from.mockReturnValueOnce({ select: selectMock });

    const result = await getTokenQueuePosition('tok-1');

    expect(result.success).toBe(true);
    expect(result.data).toBeNull();
  });
});

// ─── updateTokenQueuePosition ────────────────────────────────────────────────

describe('updateTokenQueuePosition', () => {
  it('upserts queue position and returns result', async () => {
    const updated = { token_id: 'tok-1', queue_position: 2 };
    const singleMock = vi.fn().mockResolvedValueOnce({ data: updated, error: null });
    const selectMock = vi.fn().mockReturnValue({ single: singleMock });
    const upsertMock = vi.fn().mockReturnValue({ select: selectMock });
    mockSupabase.from.mockReturnValueOnce({ upsert: upsertMock });

    const result = await updateTokenQueuePosition('tok-1', 2, 10);

    expect(result.success).toBe(true);
    expect(result.data).toEqual(updated);
    expect(upsertMock).toHaveBeenCalledWith(
      expect.objectContaining({ token_id: 'tok-1', queue_position: 2, estimated_minutes: 10 })
    );
  });

  it('returns failure on DB error', async () => {
    const singleMock = vi.fn().mockResolvedValueOnce({ data: null, error: new Error('Upsert failed') });
    const selectMock = vi.fn().mockReturnValue({ single: singleMock });
    const upsertMock = vi.fn().mockReturnValue({ select: selectMock });
    mockSupabase.from.mockReturnValueOnce({ upsert: upsertMock });

    const result = await updateTokenQueuePosition('tok-1', 1, 5);

    expect(result.success).toBe(false);
    expect(result.error).toBe('Upsert failed');
  });
});
