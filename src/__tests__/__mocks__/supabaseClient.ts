/**
 * Shared Supabase mock — imported automatically by vi.mock('../lib/supabaseClient')
 * in each test file.
 *
 * Exposes `mockSupabase` so individual tests can configure return values:
 *
 *   import { mockSupabase } from '../__mocks__/supabaseClient';
 *   mockSupabase.rpc.mockResolvedValueOnce({ data: [...], error: null });
 */
import { vi } from 'vitest';

// Build a chainable query-builder stub
function makeQueryBuilder(resolvedValue: { data: unknown; error: unknown } = { data: null, error: null }) {
  const builder: Record<string, unknown> = {};
  const methods = ['select', 'insert', 'update', 'delete', 'upsert', 'eq', 'order', 'single'];
  for (const m of methods) {
    builder[m] = vi.fn(() => builder);
  }
  // Terminal resolution
  (builder as any).then = (resolve: (v: unknown) => void) => Promise.resolve(resolvedValue).then(resolve);
  return builder;
}

export const mockQueryBuilder = makeQueryBuilder();

export const mockSupabase = {
  rpc: vi.fn().mockResolvedValue({ data: null, error: null }),
  from: vi.fn(() => mockQueryBuilder),
  channel: vi.fn(() => ({
    on: vi.fn().mockReturnThis(),
    subscribe: vi.fn().mockReturnThis(),
  })),
  removeChannel: vi.fn(),
};

export const supabase = mockSupabase;
export const isSupabaseAvailable = vi.fn(() => true);
