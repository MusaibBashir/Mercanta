import { supabase } from "../lib/supabaseClient";

export interface MenuItem {
  id: string;
  business_account_id: string;
  category: string;
  item_name: string;
  description: string;
  price: number;
  prep_time_minutes: number;
  is_available: boolean;
  is_vegetarian: boolean;
  is_spicy: boolean;
  image_url?: string;
  sort_order?: number;
  created_at: string;
  updated_at: string;
  created_by: string;
}

export interface MenuCategory {
  id: string;
  business_account_id: string;
  category_name: string;
  sort_order: number;
  item_count?: number;
  created_at: string;
  updated_at: string;
}

/**
 * Fetch all menu items for a restaurant
 */
export async function getRestaurantMenu(
  businessAccountId: string,
  onlyAvailable: boolean = false
) {
  try {
    const { data, error } = await supabase!.rpc("get_restaurant_menu", {
      p_business_account_id: businessAccountId,
      p_available_only: onlyAvailable,
    });

    if (error) throw error;
    return data as MenuItem[];
  } catch (error) {
    console.error("Error fetching menu:", error);
    throw error;
  }
}

/**
 * Fetch all menu categories for a restaurant
 */
export async function getMenuCategories(businessAccountId: string) {
  try {
    const { data, error } = await supabase!.rpc("get_menu_categories", {
      p_business_account_id: businessAccountId,
    });

    if (error) throw error;
    return data as MenuCategory[];
  } catch (error) {
    console.error("Error fetching menu categories:", error);
    throw error;
  }
}

/**
 * Create a new menu item
 */
export async function createMenuItem(
  businessAccountId: string,
  itemData: Omit<MenuItem, "id" | "business_account_id" | "created_at" | "updated_at" | "created_by">
) {
  try {
    const { data, error } = await supabase!.from("restaurant_menu").insert([
      {
        business_account_id: businessAccountId,
        ...itemData,
      },
    ]).select();

    if (error) throw error;
    return data?.[0] as MenuItem;
  } catch (error) {
    console.error("Error creating menu item:", error);
    throw error;
  }
}

/**
 * Update an existing menu item
 */
export async function updateMenuItem(
  itemId: string,
  updates: Partial<Omit<MenuItem, "id" | "business_account_id" | "created_at" | "updated_at" | "created_by">>
) {
  try {
    const { data, error } = await supabase!
      .from("restaurant_menu")
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq("id", itemId)
      .select();

    if (error) throw error;
    return data?.[0] as MenuItem;
  } catch (error) {
    console.error("Error updating menu item:", error);
    throw error;
  }
}

/**
 * Delete a menu item
 */
export async function deleteMenuItem(itemId: string) {
  try {
    const { error } = await supabase!
      .from("restaurant_menu")
      .delete()
      .eq("id", itemId);

    if (error) throw error;
  } catch (error) {
    console.error("Error deleting menu item:", error);
    throw error;
  }
}

/**
 * Toggle menu item availability
 */
export async function toggleMenuItemAvailability(
  itemId: string,
  currentAvailability: boolean
) {
  try {
    const { data, error } = await supabase!.rpc(
      "toggle_menu_item_availability",
      {
        p_item_id: itemId,
      }
    );

    if (error) throw error;
    return data;
  } catch (error) {
    console.error("Error toggling menu item availability:", error);
    throw error;
  }
}

/**
 * Create a new menu category
 */
export async function createMenuCategory(
  businessAccountId: string,
  categoryName: string,
  sortOrder: number = 0
) {
  try {
    const { data, error } = await supabase!.from("menu_categories").insert([
      {
        business_account_id: businessAccountId,
        category_name: categoryName,
        sort_order: sortOrder,
      },
    ]).select();

    if (error) throw error;
    return data?.[0] as MenuCategory;
  } catch (error) {
    console.error("Error creating menu category:", error);
    throw error;
  }
}

/**
 * Update menu category
 */
export async function updateMenuCategory(
  categoryId: string,
  updates: Partial<Omit<MenuCategory, "id" | "business_account_id" | "created_at" | "updated_at">>
) {
  try {
    const { data, error } = await supabase!
      .from("menu_categories")
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq("id", categoryId)
      .select();

    if (error) throw error;
    return data?.[0] as MenuCategory;
  } catch (error) {
    console.error("Error updating menu category:", error);
    throw error;
  }
}

/**
 * Delete menu category
 */
export async function deleteMenuCategory(categoryId: string) {
  try {
    const { error } = await supabase!
      .from("menu_categories")
      .delete()
      .eq("id", categoryId);

    if (error) throw error;
  } catch (error) {
    console.error("Error deleting menu category:", error);
    throw error;
  }
}

/**
 * Subscribe to real-time menu updates for a restaurant
 */
export function subscribeToMenuUpdates(
  businessAccountId: string,
  callback: (items: MenuItem[]) => void
) {
  const channel = supabase!
    .channel(`menu:${businessAccountId}`)
    .on("postgres_changes", { event: "*", schema: "public", table: "restaurant_menu" }, () => {
      getRestaurantMenu(businessAccountId).then(callback);
    })
    .subscribe();

  return () => {
    supabase!.removeChannel(channel);
  };
}

/**
 * Subscribe to real-time category updates
 */
export function subscribeToCategories(
  businessAccountId: string,
  callback: (categories: MenuCategory[]) => void
) {
  const channel = supabase!
    .channel(`menu_cats:${businessAccountId}`)
    .on("postgres_changes", { event: "*", schema: "public", table: "menu_categories" }, () => {
      getMenuCategories(businessAccountId).then(callback);
    })
    .subscribe();

  return () => {
    supabase!.removeChannel(channel);
  };
}

/**
 * Batch import menu items (useful for importing from CSV or other sources)
 */
export async function batchImportMenuItems(
  businessAccountId: string,
  items: Array<Omit<MenuItem, "id" | "business_account_id" | "created_at" | "updated_at" | "created_by">>
) {
  try {
    const { data, error } = await supabase!.from("restaurant_menu").insert(
      items.map((item) => ({
        business_account_id: businessAccountId,
        ...item,
      }))
    ).select();

    if (error) throw error;
    return data as MenuItem[];
  } catch (error) {
    console.error("Error importing menu items:", error);
    throw error;
  }
}

/**
 * Get menu grouped by category with item counts
 */
export async function getMenuByCategory(businessAccountId: string) {
  try {
    const items = await getRestaurantMenu(businessAccountId);
    const categories = await getMenuCategories(businessAccountId);

    const grouped = categories.map((cat) => ({
      ...cat,
      items: items.filter((item) => item.category === cat.category_name),
    }));

    return grouped;
  } catch (error) {
    console.error("Error grouping menu by category:", error);
    throw error;
  }
}
