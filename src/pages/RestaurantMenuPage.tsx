import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../context/AuthContext";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Textarea } from "../components/ui/textarea";
import { toast } from "sonner";
import { Plus, Edit2, Trash2, X, Check, Flame, Leaf, Search, FolderMinus } from "lucide-react";
import { PageContainer } from "../components/layout/PageContainer";

interface MenuItem {
  id: string;
  category: string;
  item_name: string;
  description: string;
  price: number;
  prep_time_minutes: number;
  is_available: boolean;
  is_vegetarian: boolean;
  is_spicy: boolean;
  image_url?: string;
}

interface MenuCategory {
  id: string;
  category_name: string;
  item_count: number;
}

export function RestaurantMenuPage() {
  const { activeBusinessAccount } = useAuth();
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [categories, setCategories] = useState<MenuCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<string>("All");
  const [editingId, setEditingId] = useState<string | null>(null);

  const [showForm, setShowForm] = useState(false);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [formData, setFormData] = useState({
    item_name: "",
    category: "",
    description: "",
    price: "",
    prep_time_minutes: "15",
    is_vegetarian: false,
    is_spicy: false,
  });

  // Fetch menu and categories
  useEffect(() => {
    if (!activeBusinessAccount) return;
    fetchMenuData();
  }, [activeBusinessAccount?.id]);

  const fetchMenuData = async () => {
    if (!activeBusinessAccount) return;

    try {
      setLoading(true);

      // Fetch menu items
      const { data: items, error: itemsError } = await supabase!.rpc(
        "get_restaurant_menu",
        { p_business_account_id: activeBusinessAccount.id }
      );

      if (itemsError) throw itemsError;

      // Fetch categories
      const { data: cats, error: catsError } = await supabase!.rpc(
        "get_menu_categories",
        { p_business_account_id: activeBusinessAccount.id }
      );

      if (catsError) throw catsError;

      const allItems: MenuItem[] = items || [];
      setMenuItems(allItems);

      // Merge registered categories with any categories found in menu items
      // (items may have categories not yet added to menu_categories table)
      const registeredCats: MenuCategory[] = cats || [];
      const registeredNames = new Set(registeredCats.map((c) => c.category_name));
      const extraCats: MenuCategory[] = [...new Set(allItems.map((i) => i.category))]
        .filter((name) => name && !registeredNames.has(name))
        .map((name) => ({
          id: name, // use name as stable key for unregistered cats
          category_name: name,
          item_count: allItems.filter((i) => i.category === name).length,
        }));
      const mergedCats = [...registeredCats, ...extraCats];
      setCategories(mergedCats);

      // Initialize first category
      if (mergedCats.length > 0) {
        setSelectedCategory(mergedCats[0].category_name);
      }
    } catch (error) {
      console.error("Error fetching menu:", error);
      toast.error("Failed to load menu");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteCategory = async (category: MenuCategory) => {
    const itemCount = menuItems.filter((i) => i.category === category.category_name).length;
    const message = itemCount > 0
      ? `Delete "${category.category_name}"? It has ${itemCount} item(s) — they will remain but appear under an unregistered category.`
      : `Delete category "${category.category_name}"?`;
    if (!window.confirm(message)) return;

    // Only registered categories (with a real UUID id) exist in menu_categories
    const isRegistered = category.id !== category.category_name;
    if (!isRegistered) {
      toast.error("This category is not registered in the database — no record to delete.");
      return;
    }

    try {
      const { error } = await supabase!
        .from("menu_categories")
        .delete()
        .eq("id", category.id);
      if (error) throw error;
      toast.success(`Category "${category.category_name}" deleted`);
      if (selectedCategory === category.category_name) setSelectedCategory("All");
      fetchMenuData();
    } catch (error) {
      console.error("Error deleting category:", error);
      toast.error("Failed to delete category");
    }
  };

  const handleAddCategory = async () => {
    if (!newCategoryName.trim()) return;

    try {
      const { error } = await supabase!.from("menu_categories").insert([
        {
          business_account_id: activeBusinessAccount!.id,
          category_name: newCategoryName.trim(),
          sort_order: categories.length,
        },
      ]);

      if (error) throw error;
      toast.success("Category added");
      setNewCategoryName("");
      setShowCategoryModal(false);
      fetchMenuData();
    } catch (error) {
      console.error("Error adding category:", error);
      toast.error("Failed to add category");
    }
  };

  const handleSaveItem = async () => {
    if (!formData.item_name || !formData.category || !formData.price) {
      toast.error("Please fill in all required fields");
      return;
    }

    try {
      if (editingId) {
        // Update
        const { error } = await supabase!
          .from("restaurant_menu")
          .update({
            item_name: formData.item_name,
            category: formData.category,
            description: formData.description,
            price: parseFloat(formData.price),
            prep_time_minutes: parseInt(formData.prep_time_minutes),
            is_vegetarian: formData.is_vegetarian,
            is_spicy: formData.is_spicy,
            updated_at: new Date().toISOString(),
          })
          .eq("id", editingId);

        if (error) throw error;
        toast.success("Menu item updated");
      } else {
        // Create
        const { error } = await supabase!.from("restaurant_menu").insert([
          {
            business_account_id: activeBusinessAccount!.id,
            item_name: formData.item_name,
            category: formData.category,
            description: formData.description,
            price: parseFloat(formData.price),
            prep_time_minutes: parseInt(formData.prep_time_minutes),
            is_vegetarian: formData.is_vegetarian,
            is_spicy: formData.is_spicy,
          },
        ]);

        if (error) throw error;
        toast.success("Menu item added");
      }

      setShowForm(false);
      setEditingId(null);
      setFormData({
        item_name: "",
        category: "",
        description: "",
        price: "",
        prep_time_minutes: "15",
        is_vegetarian: false,
        is_spicy: false,
      });

      fetchMenuData();
    } catch (error) {
      console.error("Error saving menu item:", error);
      toast.error("Failed to save menu item");
    }
  };

  const handleEditItem = (item: MenuItem) => {
    setFormData({
      item_name: item.item_name,
      category: item.category,
      description: item.description,
      price: item.price.toString(),
      prep_time_minutes: item.prep_time_minutes.toString(),
      is_vegetarian: item.is_vegetarian,
      is_spicy: item.is_spicy,
    });
    setEditingId(item.id);
    setShowForm(true);
  };

  const handleDeleteItem = async (id: string) => {
    if (!window.confirm("Are you sure you want to delete this item?")) return;

    try {
      const { error } = await supabase!
        .from("restaurant_menu")
        .delete()
        .eq("id", id);

      if (error) throw error;
      toast.success("Menu item deleted");
      fetchMenuData();
    } catch (error) {
      console.error("Error deleting menu item:", error);
      toast.error("Failed to delete menu item");
    }
  };

  const handleToggleAvailability = async (id: string, current: boolean) => {
    try {
      const { error } = await supabase!
        .from("restaurant_menu")
        .update({ is_available: !current })
        .eq("id", id);

      if (error) throw error;
      toast.success(
        `Item ${!current ? "available" : "unavailable"}`
      );
      fetchMenuData();
    } catch (error) {
      console.error("Error toggling availability:", error);
      toast.error("Failed to update availability");
    }
  };

  const filteredItems = menuItems
    .filter((item) => selectedCategory === "All" || item.category === selectedCategory)
    .filter((item) =>
      searchQuery.trim() === "" ||
      item.item_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.description?.toLowerCase().includes(searchQuery.toLowerCase())
    );

  if (loading) {
    return (
      <PageContainer title="Restaurant Menu">
        <div className="flex items-center justify-center h-64">
          Loading menu...
        </div>
      </PageContainer>
    );
  }

  return (
    <PageContainer title="Restaurant Menu">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-4xl font-bold">Restaurant Menu</h1>
          <div className="flex gap-2">
            <Button onClick={() => setShowCategoryModal(true)} variant="outline">
              + Add Category
            </Button>
            <Button
              onClick={() => {
                setEditingId(null);
                setFormData({
                  item_name: "",
                  category: categories[0]?.category_name || "",
                  description: "",
                  price: "",
                  prep_time_minutes: "15",
                  is_vegetarian: false,
                  is_spicy: false,
                });
                setShowForm(true);
              }}
              className="bg-green-600 hover:bg-green-700"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Item
            </Button>
          </div>
        </div>

        {/* Search Bar */}
        <div className="relative mb-6">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search items by name or description..."
            className="pl-9"
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Categories Sidebar */}
          <div className="lg:col-span-1">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Categories</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <button
                  onClick={() => setSelectedCategory("All")}
                  className={`w-full text-left px-3 py-2 rounded transition ${
                    selectedCategory === "All"
                      ? "bg-green-100 text-green-800 font-medium"
                      : "hover:bg-gray-100"
                  }`}
                >
                  All Items ({menuItems.length})
                </button>
                {categories.map((category) => (
                  <div
                    key={category.id}
                    className={`flex items-center gap-1 rounded transition ${
                      selectedCategory === category.category_name
                        ? "bg-green-100 text-green-800"
                        : "hover:bg-gray-100"
                    }`}
                  >
                    <button
                      onClick={() => setSelectedCategory(category.category_name)}
                      className="flex-1 text-left px-3 py-2 text-sm font-medium"
                    >
                      {category.category_name} ({category.item_count})
                    </button>
                    <button
                      onClick={() => handleDeleteCategory(category)}
                      className="p-1.5 mr-1 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors shrink-0"
                      title="Delete category"
                    >
                      <FolderMinus className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>

          {/* Menu Items */}
          <div className="lg:col-span-3 space-y-4">
            {filteredItems.length === 0 ? (
              <Card className="p-8 text-center text-gray-500">
                <p>No items in this category yet. Add one to get started!</p>
              </Card>
            ) : (
              filteredItems.map((item) => (
                <Card
                  key={item.id}
                  className={`border-l-4 transition-opacity ${
                    item.is_available ? "border-l-green-500" : "opacity-60 bg-gray-50 border-l-gray-300"
                  }`}
                >
                  <CardContent className="pt-6">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <h3 className="text-lg font-semibold">
                            {item.item_name}
                          </h3>
                          {!item.is_available && (
                            <span className="text-xs bg-red-100 text-red-800 px-2 py-1 rounded">
                              Unavailable
                            </span>
                          )}
                          {item.is_vegetarian && (
                            <Leaf className="w-4 h-4 text-green-600" />
                          )}
                          {item.is_spicy && (
                            <Flame className="w-4 h-4 text-red-600" />
                          )}
                        </div>
                        <p className="text-gray-600 text-sm mb-2">
                          {item.description}
                        </p>
                        <div className="flex items-center gap-4 text-sm text-gray-500">
                          <span className="font-medium text-gray-900">
                            ₹{item.price.toFixed(2)}
                          </span>
                          <span>{item.prep_time_minutes} min prep</span>
                          <span className="text-xs bg-gray-100 px-2 py-1 rounded">
                            {item.category}
                          </span>
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex gap-2 ml-4">
                        <Button
                          onClick={() => handleToggleAvailability(item.id, item.is_available)}
                          variant="outline"
                          size="sm"
                          className={item.is_available ? "text-green-600 border-green-300 hover:bg-green-50" : "text-gray-500 hover:bg-gray-100"}
                          title={item.is_available ? "Mark unavailable" : "Mark available"}
                        >
                          {item.is_available ? (
                            <><Check className="w-3 h-3 mr-1" />On</>
                          ) : (
                            <><X className="w-3 h-3 mr-1" />Off</>
                          )}
                        </Button>
                        <Button
                          onClick={() => handleEditItem(item)}
                          variant="outline"
                          size="sm"
                        >
                          <Edit2 className="w-4 h-4" />
                        </Button>
                        <Button
                          onClick={() => handleDeleteItem(item.id)}
                          variant="outline"
                          size="sm"
                          className="text-red-600 hover:bg-red-50"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </div>

        {/* Add Category Modal */}
        {showCategoryModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <Card className="w-full max-w-sm mx-4">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle>Add Category</CardTitle>
                <button
                  onClick={() => { setShowCategoryModal(false); setNewCategoryName(""); }}
                  className="text-gray-500 hover:text-gray-700"
                >
                  <X className="w-5 h-5" />
                </button>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="category_name">Category Name</Label>
                  <Input
                    id="category_name"
                    value={newCategoryName}
                    onChange={(e) => setNewCategoryName(e.target.value)}
                    placeholder="e.g., Starters, Mains, Desserts"
                    onKeyDown={(e) => e.key === "Enter" && handleAddCategory()}
                    autoFocus
                  />
                </div>
                <div className="flex gap-2 pt-2">
                  <Button
                    variant="outline"
                    onClick={() => { setShowCategoryModal(false); setNewCategoryName(""); }}
                    className="flex-1"
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleAddCategory}
                    className="flex-1 bg-green-600 hover:bg-green-700"
                    disabled={!newCategoryName.trim()}
                  >
                    Add Category
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Add/Edit Form Modal */}
        {showForm && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <Card className="w-full max-w-md mx-4">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle>
                  {editingId ? "Edit Menu Item" : "Add Menu Item"}
                </CardTitle>
                <button
                  onClick={() => setShowForm(false)}
                  className="text-gray-500 hover:text-gray-700"
                >
                  <X className="w-5 h-5" />
                </button>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="item_name">Item Name *</Label>
                  <Input
                    id="item_name"
                    value={formData.item_name}
                    onChange={(e) =>
                      setFormData({ ...formData, item_name: e.target.value })
                    }
                    placeholder="e.g., Margherita Pizza"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="category">Category *</Label>
                  <select
                    id="category"
                    value={formData.category}
                    onChange={(e) =>
                      setFormData({ ...formData, category: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  >
                    <option value="">Select category</option>
                    {categories.map((cat) => (
                      <option key={cat.id} value={cat.category_name}>
                        {cat.category_name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) =>
                      setFormData({ ...formData, description: e.target.value })
                    }
                    placeholder="Describe the dish..."
                    rows={2}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="price">Price *</Label>
                    <Input
                      id="price"
                      type="number"
                      step="0.01"
                      value={formData.price}
                      onChange={(e) =>
                        setFormData({ ...formData, price: e.target.value })
                      }
                      placeholder="0.00"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="prep_time">Prep Time (min)</Label>
                    <Input
                      id="prep_time"
                      type="number"
                      value={formData.prep_time_minutes}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          prep_time_minutes: e.target.value,
                        })
                      }
                      placeholder="15"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="is_vegetarian"
                      checked={formData.is_vegetarian}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          is_vegetarian: e.target.checked,
                        })
                      }
                      className="w-4 h-4"
                    />
                    <label htmlFor="is_vegetarian" className="text-sm">
                      🌱 Vegetarian
                    </label>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="is_spicy"
                      checked={formData.is_spicy}
                      onChange={(e) =>
                        setFormData({ ...formData, is_spicy: e.target.checked })
                      }
                      className="w-4 h-4"
                    />
                    <label htmlFor="is_spicy" className="text-sm">
                      🌶️ Spicy
                    </label>
                  </div>
                </div>

                <div className="flex gap-2 pt-4">
                  <Button
                    variant="outline"
                    onClick={() => setShowForm(false)}
                    className="flex-1"
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleSaveItem}
                    className="flex-1 bg-green-600 hover:bg-green-700"
                  >
                    {editingId ? "Update Item" : "Add Item"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </PageContainer>
  );
}
