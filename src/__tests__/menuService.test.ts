import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../lib/supabaseClient', () => import('./__mocks__/supabaseClient'));

import { mockSupabase } from './__mocks__/supabaseClient';
import {
  getRestaurantMenu,
  getMenuCategories,
  createMenuItem,
  updateMenuItem,
  deleteMenuItem,
  toggleMenuItemAvailability,
  createMenuCategory,
  updateMenuCategory,
  deleteMenuCategory,
  batchImportMenuItems,
  getMenuByCategory,
} from '../services/menuService';
import type { MenuItem, MenuCategory } from '../services/menuService';

beforeEach(() => {
  vi.clearAllMocks();
});

// ─── Fixtures ────────────────────────────────────────────────────────────────

const makeItem = (overrides: Partial<MenuItem> = {}): MenuItem => ({
  id: 'item-1',
  business_account_id: 'biz-1',
  category: 'Mains',
  item_name: 'Chicken Curry',
  description: 'Spicy',
  price: 250,
  prep_time_minutes: 15,
  is_available: true,
  is_vegetarian: false,
  is_spicy: true,
  sort_order: 1,
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
  created_by: 'user-1',
  ...overrides,
});

const makeCategory = (overrides: Partial<MenuCategory> = {}): MenuCategory => ({
  id: 'cat-1',
  business_account_id: 'biz-1',
  category_name: 'Mains',
  sort_order: 0,
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
  ...overrides,
});

// ─── getRestaurantMenu ───────────────────────────────────────────────────────

describe('getRestaurantMenu', () => {
  it('calls get_restaurant_menu RPC with correct params', async () => {
    const items = [makeItem()];
    mockSupabase.rpc.mockResolvedValueOnce({ data: items, error: null });

    const result = await getRestaurantMenu('biz-1', true);

    expect(result).toEqual(items);
    expect(mockSupabase.rpc).toHaveBeenCalledWith('get_restaurant_menu', {
      p_business_account_id: 'biz-1',
      p_available_only: true,
    });
  });

  it('defaults onlyAvailable to false', async () => {
    mockSupabase.rpc.mockResolvedValueOnce({ data: [], error: null });
    await getRestaurantMenu('biz-1');
    expect(mockSupabase.rpc).toHaveBeenCalledWith('get_restaurant_menu', {
      p_business_account_id: 'biz-1',
      p_available_only: false,
    });
  });

  it('throws on RPC error', async () => {
    mockSupabase.rpc.mockResolvedValueOnce({ data: null, error: new Error('RPC failed') });
    await expect(getRestaurantMenu('biz-bad')).rejects.toThrow('RPC failed');
  });
});

// ─── getMenuCategories ───────────────────────────────────────────────────────

describe('getMenuCategories', () => {
  it('returns categories from RPC', async () => {
    const cats = [makeCategory()];
    mockSupabase.rpc.mockResolvedValueOnce({ data: cats, error: null });

    const result = await getMenuCategories('biz-1');
    expect(result).toEqual(cats);
  });

  it('throws on error', async () => {
    mockSupabase.rpc.mockResolvedValueOnce({ data: null, error: new Error('Cat error') });
    await expect(getMenuCategories('biz-bad')).rejects.toThrow('Cat error');
  });
});

// ─── createMenuItem ──────────────────────────────────────────────────────────

describe('createMenuItem', () => {
  it('inserts item and returns first record', async () => {
    const item = makeItem();
    const selectMock = vi.fn().mockResolvedValueOnce({ data: [item], error: null });
    const insertMock = vi.fn().mockReturnValue({ select: selectMock });
    mockSupabase.from.mockReturnValueOnce({ insert: insertMock });

    const result = await createMenuItem('biz-1', {
      category: 'Mains',
      item_name: 'Chicken Curry',
      description: 'Spicy',
      price: 250,
      prep_time_minutes: 15,
      is_available: true,
      is_vegetarian: false,
      is_spicy: true,
    });

    expect(result).toEqual(item);
    expect(mockSupabase.from).toHaveBeenCalledWith('restaurant_menu');
  });

  it('throws on insert error', async () => {
    const selectMock = vi.fn().mockResolvedValueOnce({ data: null, error: new Error('Insert fail') });
    const insertMock = vi.fn().mockReturnValue({ select: selectMock });
    mockSupabase.from.mockReturnValueOnce({ insert: insertMock });

    await expect(createMenuItem('biz-1', {
      category: 'X',
      item_name: 'X',
      description: '',
      price: 0,
      prep_time_minutes: 0,
      is_available: true,
      is_vegetarian: false,
      is_spicy: false,
    })).rejects.toThrow('Insert fail');
  });
});

// ─── updateMenuItem ──────────────────────────────────────────────────────────

describe('updateMenuItem', () => {
  it('updates item and returns updated record', async () => {
    const updated = makeItem({ price: 300 });
    const selectMock = vi.fn().mockResolvedValueOnce({ data: [updated], error: null });
    const eqMock = vi.fn().mockReturnValue({ select: selectMock });
    const updateMock = vi.fn().mockReturnValue({ eq: eqMock });
    mockSupabase.from.mockReturnValueOnce({ update: updateMock });

    const result = await updateMenuItem('item-1', { price: 300 });

    expect(result).toEqual(updated);
    expect(eqMock).toHaveBeenCalledWith('id', 'item-1');
  });

  it('throws on update error', async () => {
    const selectMock = vi.fn().mockResolvedValueOnce({ data: null, error: new Error('Update fail') });
    const eqMock = vi.fn().mockReturnValue({ select: selectMock });
    const updateMock = vi.fn().mockReturnValue({ eq: eqMock });
    mockSupabase.from.mockReturnValueOnce({ update: updateMock });

    await expect(updateMenuItem('item-1', { price: -1 })).rejects.toThrow('Update fail');
  });
});

// ─── deleteMenuItem ──────────────────────────────────────────────────────────

describe('deleteMenuItem', () => {
  it('deletes item without error', async () => {
    const eqMock = vi.fn().mockResolvedValueOnce({ error: null });
    const deleteMock = vi.fn().mockReturnValue({ eq: eqMock });
    mockSupabase.from.mockReturnValueOnce({ delete: deleteMock });

    await expect(deleteMenuItem('item-1')).resolves.toBeUndefined();
    expect(eqMock).toHaveBeenCalledWith('id', 'item-1');
  });

  it('throws when delete fails', async () => {
    const eqMock = vi.fn().mockResolvedValueOnce({ error: new Error('Delete fail') });
    const deleteMock = vi.fn().mockReturnValue({ eq: eqMock });
    mockSupabase.from.mockReturnValueOnce({ delete: deleteMock });

    await expect(deleteMenuItem('item-bad')).rejects.toThrow('Delete fail');
  });
});

// ─── toggleMenuItemAvailability ──────────────────────────────────────────────

describe('toggleMenuItemAvailability', () => {
  it('calls toggle_menu_item_availability RPC', async () => {
    mockSupabase.rpc.mockResolvedValueOnce({ data: true, error: null });

    const result = await toggleMenuItemAvailability('item-1', true);
    expect(result).toBe(true);
    expect(mockSupabase.rpc).toHaveBeenCalledWith('toggle_menu_item_availability', {
      p_item_id: 'item-1',
    });
  });

  it('throws on RPC error', async () => {
    mockSupabase.rpc.mockResolvedValueOnce({ data: null, error: new Error('Toggle fail') });
    await expect(toggleMenuItemAvailability('item-bad', false)).rejects.toThrow('Toggle fail');
  });
});

// ─── createMenuCategory ──────────────────────────────────────────────────────

describe('createMenuCategory', () => {
  it('inserts category and returns first record', async () => {
    const cat = makeCategory();
    const selectMock = vi.fn().mockResolvedValueOnce({ data: [cat], error: null });
    const insertMock = vi.fn().mockReturnValue({ select: selectMock });
    mockSupabase.from.mockReturnValueOnce({ insert: insertMock });

    const result = await createMenuCategory('biz-1', 'Mains', 0);

    expect(result).toEqual(cat);
    expect(mockSupabase.from).toHaveBeenCalledWith('menu_categories');
  });

  it('uses default sort_order of 0', async () => {
    const cat = makeCategory();
    const selectMock = vi.fn().mockResolvedValueOnce({ data: [cat], error: null });
    const insertMock = vi.fn().mockReturnValue({ select: selectMock });
    mockSupabase.from.mockReturnValueOnce({ insert: insertMock });

    await createMenuCategory('biz-1', 'Drinks');
    expect(insertMock).toHaveBeenCalledWith([
      expect.objectContaining({ sort_order: 0 }),
    ]);
  });
});

// ─── updateMenuCategory ──────────────────────────────────────────────────────

describe('updateMenuCategory', () => {
  it('updates category name', async () => {
    const updated = makeCategory({ category_name: 'Starters' });
    const selectMock = vi.fn().mockResolvedValueOnce({ data: [updated], error: null });
    const eqMock = vi.fn().mockReturnValue({ select: selectMock });
    const updateMock = vi.fn().mockReturnValue({ eq: eqMock });
    mockSupabase.from.mockReturnValueOnce({ update: updateMock });

    const result = await updateMenuCategory('cat-1', { category_name: 'Starters' });
    expect(result.category_name).toBe('Starters');
  });
});

// ─── deleteMenuCategory ──────────────────────────────────────────────────────

describe('deleteMenuCategory', () => {
  it('deletes category by id', async () => {
    const eqMock = vi.fn().mockResolvedValueOnce({ error: null });
    const deleteMock = vi.fn().mockReturnValue({ eq: eqMock });
    mockSupabase.from.mockReturnValueOnce({ delete: deleteMock });

    await expect(deleteMenuCategory('cat-1')).resolves.toBeUndefined();
    expect(eqMock).toHaveBeenCalledWith('id', 'cat-1');
  });
});

// ─── batchImportMenuItems ────────────────────────────────────────────────────

describe('batchImportMenuItems', () => {
  it('inserts multiple items and returns them', async () => {
    const items = [makeItem({ id: 'i1' }), makeItem({ id: 'i2' })];
    const selectMock = vi.fn().mockResolvedValueOnce({ data: items, error: null });
    const insertMock = vi.fn().mockReturnValue({ select: selectMock });
    mockSupabase.from.mockReturnValueOnce({ insert: insertMock });

    const input = items.map(({ id, business_account_id, created_at, updated_at, created_by, ...rest }) => rest);
    const result = await batchImportMenuItems('biz-1', input);

    expect(result).toEqual(items);
    expect(insertMock).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ business_account_id: 'biz-1' }),
      ])
    );
  });
});

// ─── getMenuByCategory ───────────────────────────────────────────────────────

describe('getMenuByCategory', () => {
  it('groups items under their matching category', async () => {
    const cat = makeCategory({ category_name: 'Mains' });
    const item = makeItem({ category: 'Mains' });

    // First RPC call: getRestaurantMenu; second: getMenuCategories
    mockSupabase.rpc
      .mockResolvedValueOnce({ data: [item], error: null })
      .mockResolvedValueOnce({ data: [cat], error: null });

    const result = await getMenuByCategory('biz-1');

    expect(result).toHaveLength(1);
    expect(result[0].category_name).toBe('Mains');
    expect(result[0].items).toEqual([item]);
  });

  it('returns empty items array for categories with no matching items', async () => {
    const cat = makeCategory({ category_name: 'Desserts' });
    const item = makeItem({ category: 'Mains' });

    mockSupabase.rpc
      .mockResolvedValueOnce({ data: [item], error: null })
      .mockResolvedValueOnce({ data: [cat], error: null });

    const result = await getMenuByCategory('biz-1');
    expect(result[0].items).toEqual([]);
  });
});
