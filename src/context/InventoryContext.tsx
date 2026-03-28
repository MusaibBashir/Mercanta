import { createContext, useContext, useState, useEffect, useRef, ReactNode, useCallback } from "react";
import { supabase, isSupabaseAvailable } from "../lib/supabaseClient";
import { AuthContext } from "./AuthContext";

export interface InventoryItem {
  id: string;
  sku: string;
  barcode?: string;
  itemName: string;
  category: string;
  price: number;
  quantity: number;
  description?: string;
  dateAdded: string;
  lastUpdated: string;
  franchiseId?: string;
}

export interface SaleItem {
  sku: string;
  itemName: string;
  quantity: number;
  price: number;
  discount?: number;
  discountType?: 'percent' | 'flat';
  discountValue?: number;
}

export interface SaleRecord {
  id: string;
  items: SaleItem[];
  customerName: string;
  customerPhone?: string;
  customerEmail?: string;
  total: number;
  date: string;
  franchiseId?: string;
  subtotal?: number;
  discountTotal?: number;
  taxRate?: number;
  taxAmount?: number;
  paymentMethod?: 'cash' | 'upi' | 'card' | 'split';
  paymentDetails?: Record<string, number>;
  transactionId?: string;
  pointsEarned?: number;
  pointsUsed?: number;
}

export interface Customer {
  id: string;
  name: string;
  phone?: string;
  email?: string;
  pointsBalance: number;
  createdAt: string;
}

export interface StockOrderItem {
  sku: string;
  itemName: string;
  quantity: number;
}

export interface StockOrder {
  id: string;
  franchiseId: string;
  franchiseName: string;
  items: StockOrderItem[];
  status: 'pending' | 'approved' | 'rejected';
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

interface InventoryContextType {
  inventory: InventoryItem[];
  salesHistory: SaleRecord[];
  customers: Customer[];
  stockOrders: StockOrder[];
  isLoading: boolean;
  error: string | null;
  addInventoryItem: (item: Omit<InventoryItem, "id" | "dateAdded" | "lastUpdated">) => Promise<boolean>;
  updateInventoryItem: (id: string, updates: Partial<InventoryItem>) => Promise<boolean>;
  updateInventoryQuantity: (sku: string, quantityChange: number) => Promise<boolean>;
  deleteInventoryItem: (id: string) => Promise<boolean>;
  getInventoryBySku: (sku: string) => InventoryItem | undefined;
  getCustomerByPhone: (phone: string) => Promise<Customer | null>;
  recordSale: (sale: Omit<SaleRecord, "id" | "date" | "pointsEarned">, options?: { skipInventoryCheck?: boolean }) => Promise<{ success: boolean; saleId?: string }>;
  addCustomer: (customer: Omit<Customer, "id" | "createdAt" | "pointsBalance">) => Promise<Customer | null>;
  getTotalInventoryValue: () => number;
  getTotalInventoryCount: () => number;
  getLowStockItems: (threshold?: number) => InventoryItem[];
  refreshData: () => Promise<void>;
  createStockOrder: (order: { franchiseId: string; franchiseName: string; items: StockOrderItem[]; notes?: string }) => Promise<boolean>;
  approveStockOrder: (orderId: string) => Promise<boolean>;
  rejectStockOrder: (orderId: string) => Promise<boolean>;
}


const InventoryContext = createContext<InventoryContextType | undefined>(undefined);

// Empty fallback when Supabase is not available
// Data should come from Supabase database
const fallbackInventory: InventoryItem[] = [];


export function InventoryProvider({ children }: { children: ReactNode }) {
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [salesHistory, setSalesHistory] = useState<SaleRecord[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [stockOrders, setStockOrders] = useState<StockOrder[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Get auth context for franchise filtering (returns undefined if AuthProvider not yet mounted)
  const authContext = useContext(AuthContext);

  // Use a ref so fetchData always reads the LATEST auth values without needing them as deps
  const authRef = useRef(authContext);
  authRef.current = authContext;

  // Convert Supabase row to InventoryItem
  const mapInventoryRow = (row: any): InventoryItem => ({
    id: row.id,
    sku: row.sku,
    barcode: row.barcode,
    itemName: row.item_name,
    category: row.category,
    price: parseFloat(row.price),
    quantity: row.quantity,
    description: row.description,
    dateAdded: row.date_added,
    lastUpdated: row.last_updated,
    franchiseId: row.franchise_id,
  });

  // Convert Supabase row to Customer
  const mapCustomerRow = (row: any): Customer => ({
    id: row.id,
    name: row.name,
    phone: row.phone,
    email: row.email,
    pointsBalance: row.points_balance || 0,
    createdAt: row.created_at,
  });

  // Fetch all data from Supabase
  const fetchData = useCallback(async () => {
    if (!isSupabaseAvailable() || !supabase) {
      // Use fallback data
      setInventory(fallbackInventory);
      setSalesHistory([]);
      setCustomers([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    // Read auth values from ref (always latest)
    const auth = authRef.current;
    const isAdmin = auth?.profile?.role === 'admin';
    const franchiseId = auth?.franchise?.id;

    try {
      const businessAccountId = auth?.activeBusinessAccount?.id;
      const INVENTORY_LIMIT = 500;
      const SALES_LIMIT = 200;

      // Fetch inventory — admin sees all, franchise sees own + admin warehouse
      let inventoryQuery = supabase
        .from('inventory')
        .select('*')
        .is('deleted_at', null)
        .order('item_name')
        .limit(INVENTORY_LIMIT);
      if (!isAdmin && franchiseId) {
        // Franchise users see their own inventory + admin warehouse (franchise_id is null)
        inventoryQuery = inventoryQuery.or(`franchise_id.eq.${franchiseId},franchise_id.is.null`);
      } else if (!isAdmin && businessAccountId) {
        inventoryQuery = inventoryQuery.eq('business_account_id', businessAccountId);
      }
      const { data: inventoryData, error: inventoryError } = await inventoryQuery;

      if (inventoryError) throw inventoryError;
      setInventory((inventoryData || []).map(mapInventoryRow));

      // Fetch customers scoped to active business account (or unscoped for legacy)
      let customersQuery = supabase
        .from('customers')
        .select('*')
        .order('name')
        .limit(500);
      if (businessAccountId) {
        customersQuery = customersQuery.or(`business_account_id.eq.${businessAccountId},business_account_id.is.null`);
      }
      const { data: customersData, error: customersError } = await customersQuery;

      if (customersError) throw customersError;
      setCustomers((customersData || []).map(mapCustomerRow));

      // Fetch sales with items — franchise users only see their own (paginated)
      let salesQuery = supabase
        .from('sales')
        .select(`
          id,
          customer_name,
          total,
          date,
          franchise_id,
          sale_items (
            sku,
            item_name,
            quantity,
            price
          )
        `)
        .is('deleted_at', null)
        .order('date', { ascending: false })
        .limit(SALES_LIMIT);
      if (!isAdmin && franchiseId) {
        salesQuery = salesQuery.eq('franchise_id', franchiseId);
      } else if (!isAdmin && businessAccountId) {
        salesQuery = salesQuery.eq('business_account_id', businessAccountId);
      }
      const { data: salesData, error: salesError } = await salesQuery;

      if (salesError) throw salesError;

      const mappedSales: SaleRecord[] = (salesData || []).map((sale: any) => ({
        id: sale.id,
        customerName: sale.customer_name,
        total: parseFloat(sale.total),
        date: sale.date,
        franchiseId: sale.franchise_id,
        subtotal: sale.subtotal ? parseFloat(sale.subtotal) : undefined,
        discountTotal: sale.discount_total ? parseFloat(sale.discount_total) : undefined,
        taxAmount: sale.tax_amount ? parseFloat(sale.tax_amount) : undefined,
        paymentMethod: sale.payment_method,
        paymentDetails: sale.payment_details,
        pointsEarned: sale.points_earned,
        pointsUsed: sale.points_used,
        items: (sale.sale_items || []).map((item: any) => ({
          sku: item.sku,
          itemName: item.item_name,
          quantity: item.quantity,
          price: parseFloat(item.price),
          discount: item.discount ? parseFloat(item.discount) : undefined,
          discountType: item.discount_type,
          discountValue: item.discount_value ? parseFloat(item.discount_value) : undefined,
        })),
      }));
      setSalesHistory(mappedSales);

      // Fetch stock orders
      try {
        let ordersQuery = supabase
          .from('stock_orders')
          .select('*')
          .order('created_at', { ascending: false });
        if (!isAdmin && franchiseId) {
          ordersQuery = ordersQuery.eq('franchise_id', franchiseId);
        }
        const { data: ordersData, error: ordersError } = await ordersQuery;

        if (!ordersError && ordersData) {
          // Fetch items for each order
          const orderIds = ordersData.map((o: any) => o.id);
          let allOrderItems: any[] = [];
          if (orderIds.length > 0) {
            const { data: itemsData } = await supabase
              .from('stock_order_items')
              .select('*')
              .in('order_id', orderIds);
            allOrderItems = itemsData || [];
          }

          const mapped: StockOrder[] = ordersData.map((o: any) => ({
            id: o.id,
            franchiseId: o.franchise_id,
            franchiseName: o.franchise_name,
            status: o.status,
            notes: o.notes,
            createdAt: o.created_at,
            updatedAt: o.updated_at,
            items: allOrderItems
              .filter((i: any) => i.order_id === o.id)
              .map((i: any) => ({
                sku: i.sku,
                itemName: i.item_name,
                quantity: i.quantity,
              })),
          }));
          setStockOrders(mapped);
        }
      } catch (stockErr) {
        // Stock orders table may not exist yet — silently skip
        console.warn('Stock orders fetch skipped:', stockErr);
      }

    } catch (err: any) {
      console.error('Error fetching data:', err);
      setError(err.message || 'Failed to fetch data');
      // Fallback to empty arrays on error
      setInventory(fallbackInventory);
    } finally {
      setIsLoading(false);
    }
  }, []); // Stable reference — reads auth from ref

  // Fetch data only AFTER auth is done loading
  useEffect(() => {
    // Don't fetch until auth finishes loading
    if (authContext?.isLoading) return;
    fetchData();
  }, [authContext?.isLoading, authContext?.profile?.role, authContext?.franchise?.id, fetchData]);

  // Supabase Realtime: auto-refresh when inventory/stock_orders/stock_order_items change
  useEffect(() => {
    if (!isSupabaseAvailable() || !supabase) return;

    const channel = supabase
      .channel('inventory-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'inventory' }, () => {
        fetchData();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'stock_orders' }, () => {
        fetchData();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'stock_order_items' }, () => {
        fetchData();
      })
      .subscribe();

    return () => {
      supabase!.removeChannel(channel);
    };
  }, [fetchData]);

  // Add inventory item
  const addInventoryItem = async (
    item: Omit<InventoryItem, "id" | "dateAdded" | "lastUpdated">
  ): Promise<boolean> => {
    if (!isSupabaseAvailable() || !supabase) {
      // Fallback: add to local state
      const newItem: InventoryItem = {
        ...item,
        id: Date.now().toString(),
        dateAdded: new Date().toISOString(),
        lastUpdated: new Date().toISOString(),
      };
      setInventory((prev) => [...prev, newItem]);
      return true;
    }

    try {
      const insertData: any = {
        sku: item.sku,
        barcode: item.barcode,
        item_name: item.itemName,
        category: item.category,
        price: item.price,
        quantity: item.quantity,
        description: item.description,
      };
      // Admin adds to warehouse (franchise_id stays null)
      // Only franchise users would have franchise_id, but they shouldn't add items
      // This keeps it as admin warehouse stock
      const { data, error } = await supabase
        .from('inventory')
        .insert(insertData)
        .select()
        .single();

      if (error) throw error;
      setInventory((prev) => [...prev, mapInventoryRow(data)]);
      return true;
    } catch (err: any) {
      console.error('Error adding inventory item:', err);
      setError(err.message);
      return false;
    }
  };

  // Update inventory item
  const updateInventoryItem = async (
    id: string,
    updates: Partial<InventoryItem>
  ): Promise<boolean> => {
    if (!isSupabaseAvailable() || !supabase) {
      setInventory((prev) =>
        prev.map((item) =>
          item.id === id
            ? { ...item, ...updates, lastUpdated: new Date().toISOString() }
            : item
        )
      );
      return true;
    }

    try {
      const dbUpdates: any = {};
      if (updates.sku !== undefined) dbUpdates.sku = updates.sku;
      if (updates.barcode !== undefined) dbUpdates.barcode = updates.barcode;
      if (updates.itemName !== undefined) dbUpdates.item_name = updates.itemName;
      if (updates.category !== undefined) dbUpdates.category = updates.category;
      if (updates.price !== undefined) dbUpdates.price = updates.price;
      if (updates.quantity !== undefined) dbUpdates.quantity = updates.quantity;
      if (updates.description !== undefined) dbUpdates.description = updates.description;

      const { error } = await supabase
        .from('inventory')
        .update(dbUpdates)
        .eq('id', id);

      if (error) throw error;
      await fetchData(); // Refresh to get updated last_updated
      return true;
    } catch (err: any) {
      console.error('Error updating inventory item:', err);
      setError(err.message);
      return false;
    }
  };

  // Update inventory quantity
  const updateInventoryQuantity = async (
    sku: string,
    quantityChange: number
  ): Promise<boolean> => {
    const item = inventory.find((i) => i.sku === sku);
    if (!item) return false;

    const newQuantity = item.quantity + quantityChange;
    if (newQuantity < 0) return false;

    return updateInventoryItem(item.id, { quantity: newQuantity });
  };

  // Soft-delete inventory item (sets deleted_at, preserved in audit log)
  const deleteInventoryItem = async (id: string): Promise<boolean> => {
    if (!isSupabaseAvailable() || !supabase) {
      setInventory((prev) => prev.filter((item) => item.id !== id));
      return true;
    }

    try {
      const { error } = await supabase!.rpc('soft_delete_inventory_item', {
        p_item_id: id,
      });

      if (error) throw error;
      setInventory((prev) => prev.filter((item) => item.id !== id));
      return true;
    } catch (err: any) {
      console.error('Error deleting inventory item:', err);
      setError(err.message);
      return false;
    }
  };

  // Get inventory by SKU — franchise-aware: prefer the franchise's own row
  const getInventoryBySku = (sku: string): InventoryItem | undefined => {
    const franchiseId = authRef.current?.franchise?.id;
    if (franchiseId) {
      const franchiseItem = inventory.find(
        (item) => item.sku === sku && item.franchiseId === franchiseId
      );
      if (franchiseItem) return franchiseItem;
    }
    // Admin or fallback: return any matching row
    return inventory.find((item) => item.sku === sku);
  };

  // Get customer by phone number
  const getCustomerByPhone = async (phone: string): Promise<Customer | null> => {
    if (!phone.trim()) return null;

    // First check local state
    const localCustomer = customers.find((c: Customer) => c.phone === phone);
    if (localCustomer) return localCustomer;

    // Then check database
    if (!isSupabaseAvailable() || !supabase) return null;

    try {
      const { data, error } = await supabase
        .from('customers')
        .select('*')
        .eq('phone', phone)
        .maybeSingle();

      if (error || !data) return null;

      return {
        id: data.id,
        name: data.name,
        phone: data.phone,
        email: data.email,
        pointsBalance: data.points_balance || 0,
        createdAt: data.created_at,
      };
    } catch (err) {
      console.error('Error fetching customer by phone:', err);
      return null;
    }
  };

  // Find or create customer by phone number (unique identifier)
  const findOrCreateCustomer = async (
    customerName: string,
    customerPhone?: string,
    customerEmail?: string
  ): Promise<Customer | null> => {
    if (!isSupabaseAvailable() || !supabase) return null;

    try {
      const businessAccountId = authContext?.activeBusinessAccount?.id || null;

      // If phone is provided, use it as the unique identifier (scoped to this tenant)
      if (customerPhone) {
        const phoneQuery = supabase
          .from('customers')
          .select('*')
          .eq('phone', customerPhone);
        // Scope lookup to this tenant if we have a business account
        if (businessAccountId) {
          phoneQuery.eq('business_account_id', businessAccountId);
        }
        const { data: existingCustomer } = await phoneQuery.maybeSingle();

        if (existingCustomer) {
          return mapCustomerRow(existingCustomer);
        }
      }

      // Create new customer scoped to the active business account
      const { data: newCustomer, error } = await supabase
        .from('customers')
        .insert({
          name: customerName,
          phone: customerPhone || null,
          email: customerEmail || null,
          business_account_id: businessAccountId,
        })
        .select('*')
        .single();

      if (error) {
        console.error('Error creating customer:', error);
        return null;
      }

      // Add to local state
      if (newCustomer) {
        setCustomers((prev: Customer[]) => [...prev, mapCustomerRow(newCustomer)]);
      }

      return newCustomer ? mapCustomerRow(newCustomer) : null;
    } catch (err) {
      console.error('Error finding/creating customer:', err);
      return null;
    }
  };


  // Record sale
  const recordSale = async (
    sale: Omit<SaleRecord, "id" | "date" | "pointsEarned">,
    options?: { skipInventoryCheck?: boolean }
  ): Promise<{ success: boolean; saleId?: string }> => {
    // Check stock availability (skip for restaurants)
    if (!options?.skipInventoryCheck) {
      for (const saleItem of sale.items) {
        const inventoryItem = getInventoryBySku(saleItem.sku);
        if (!inventoryItem || inventoryItem.quantity < saleItem.quantity) {
          setError(`Insufficient stock for ${saleItem.itemName}`);
          return { success: false };
        }
      }
    }

    // Points logic
    const spentAmount = sale.total;
    const pointsEarned = Math.floor(spentAmount / 100); // 1 point per 100 spent
    const pointsUsed = sale.pointsUsed || 0;

    if (!isSupabaseAvailable() || !supabase) {
      // Fallback: local state
      const newSale: SaleRecord = {
        ...sale,
        id: Date.now().toString(),
        date: new Date().toISOString(),
        pointsEarned,
      };
      setSalesHistory((prev: SaleRecord[]) => [newSale, ...prev]);
      // Deduct inventory
      for (const saleItem of sale.items) {
        await updateInventoryQuantity(saleItem.sku, -saleItem.quantity);
      }
      return { success: true, saleId: newSale.id };
    }

    try {
      // Find or create customer
      const customer = await findOrCreateCustomer(
        sale.customerName,
        sale.customerPhone,
        sale.customerEmail
      );

      const customerId = customer?.id;

      // Calculate new points balance
      if (customerId) {
        let newBalance = (customer.pointsBalance || 0) + pointsEarned - pointsUsed;
        // Ensure balance doesn't go negative
        if (newBalance < 0) newBalance = 0;

        const { error: pointsError } = await supabase
          .from('customers')
          .update({ points_balance: newBalance })
          .eq('id', customerId);

        if (pointsError) console.error("Error updating customer points:", pointsError);
      }

      // Insert sale with customer_id and franchise_id and new fields
      // Note: points_earned/points_used are tracked on the customers table (points_balance),
      // not as columns on the sales table.
      const saleInsert: any = {
        customer_id: customerId,
        customer_name: sale.customerName,
        total: sale.total,
        subtotal: sale.subtotal,
        discount_total: sale.discountTotal,
        tax_rate: sale.taxRate,
        tax_amount: sale.taxAmount,
        payment_method: sale.paymentMethod || 'cash',
        payment_details: sale.paymentMethod === 'split'
          ? sale.paymentDetails
          : (sale.transactionId ? { razorpay_payment_id: sale.transactionId } : sale.paymentDetails),
      };
      if (authContext?.franchise?.id) {
        saleInsert.franchise_id = authContext.franchise.id;
      }
      // Add business_account_id if available (for multi-tenancy in restaurants/new model)
      if (authContext?.activeBusinessAccount?.id) {
        saleInsert.business_account_id = authContext.activeBusinessAccount.id;
      }
      if (authContext?.activeBusinessAccount?.business_type === "restaurant") {
        saleInsert.is_restaurant_order = true;
      }
      const { data: saleData, error: saleError } = await supabase
        .from('sales')
        .insert(saleInsert)
        .select()
        .single();

      if (saleError) {
        console.error('Sale insert error details:', saleError);
        throw saleError;
      }

      // Insert sale items
      const saleItems = sale.items.map((item: SaleItem) => ({
        sale_id: saleData.id,
        sku: item.sku,
        item_name: item.itemName,
        quantity: item.quantity,
        price: item.price,
        discount: item.discount,
        discount_type: item.discountType,
        discount_value: item.discountValue,
      }));

      const { error: itemsError } = await supabase
        .from('sale_items')
        .insert(saleItems);

      if (itemsError) throw itemsError;

      // Deduct inventory — target the franchise's own row when applicable
      // Skip for restaurants (skipInventoryCheck = true)
      if (!options?.skipInventoryCheck) {
        for (const saleItem of sale.items) {
          const franchiseId = authContext?.franchise?.id;
          let item: InventoryItem | undefined;
          if (franchiseId) {
            item = inventory.find(
              (i: InventoryItem) => i.sku === saleItem.sku && i.franchiseId === franchiseId
            );
          }
          if (!item) {
            item = inventory.find((i: InventoryItem) => i.sku === saleItem.sku);
          }
          if (item) {
            await supabase
              .from('inventory')
              .update({ quantity: item.quantity - saleItem.quantity })
              .eq('id', item.id);
          }
        }
      }

      // Refresh data
      await fetchData();
      return { success: true, saleId: saleData.id };
    } catch (err: any) {
      console.error('Error recording sale:', err);
      setError(err.message);
      return { success: false };
    }
  };


  // Add customer
  const addCustomer = async (
    customer: Omit<Customer, "id" | "createdAt" | "pointsBalance">
  ): Promise<Customer | null> => {
    if (!isSupabaseAvailable() || !supabase) {
      const newCustomer: Customer = {
        ...customer,
        id: Date.now().toString(),
        pointsBalance: 0,
        createdAt: new Date().toISOString(),
      };
      setCustomers((prev) => [...prev, newCustomer]);
      return newCustomer;
    }

    try {
      const { data, error } = await supabase
        .from('customers')
        .insert({
          name: customer.name,
          phone: customer.phone,
          email: customer.email,
        })
        .select()
        .single();

      if (error) throw error;
      const newCustomer = mapCustomerRow(data);
      setCustomers((prev) => [...prev, newCustomer]);
      return newCustomer;
    } catch (err: any) {
      console.error('Error adding customer:', err);
      setError(err.message);
      return null;
    }
  };

  // Utility functions
  const getTotalInventoryValue = (): number => {
    return inventory.reduce((total, item) => total + item.price * item.quantity, 0);
  };

  const getTotalInventoryCount = (): number => {
    return inventory.reduce((total, item) => total + item.quantity, 0);
  };

  const getLowStockItems = (threshold: number = 20): InventoryItem[] => {
    return inventory.filter((item) => item.quantity <= threshold);
  };

  const refreshData = async (): Promise<void> => {
    await fetchData();
  };

  // Create a stock order (franchise requests stock from admin)
  const createStockOrder = async (order: {
    franchiseId: string;
    franchiseName: string;
    items: StockOrderItem[];
    notes?: string;
  }): Promise<boolean> => {
    if (!isSupabaseAvailable() || !supabase) return false;
    try {
      // Insert the order
      const { data: orderData, error: orderError } = await supabase
        .from('stock_orders')
        .insert({
          franchise_id: order.franchiseId,
          franchise_name: order.franchiseName,
          notes: order.notes || null,
          status: 'pending',
        })
        .select()
        .single();

      if (orderError) throw orderError;

      // Insert the items
      const itemsInsert = order.items.map(item => ({
        order_id: orderData.id,
        sku: item.sku,
        item_name: item.itemName,
        quantity: item.quantity,
      }));
      const { error: itemsError } = await supabase
        .from('stock_order_items')
        .insert(itemsInsert);

      if (itemsError) throw itemsError;

      await fetchData();
      return true;
    } catch (err: any) {
      console.error('Error creating stock order:', err);
      setError(err.message);
      return false;
    }
  };

  // Approve a stock order (admin: transfer inventory from warehouse to franchise)
  // Updates the franchise_id column from NULL to the franchise's ID
  const approveStockOrder = async (orderId: string): Promise<boolean> => {
    if (!isSupabaseAvailable() || !supabase) return false;
    try {
      const order = stockOrders.find((o: any) => o.id === orderId);
      if (!order) throw new Error('Order not found');

      if (!order.items || order.items.length === 0) {
        // No items — just update status
        await supabase
          .from('stock_orders')
          .update({ status: 'approved', updated_at: new Date().toISOString() })
          .eq('id', orderId);
        await fetchData();
        return true;
      }

      // 1. Update order status
      const { error: statusError } = await supabase
        .from('stock_orders')
        .update({ status: 'approved', updated_at: new Date().toISOString() })
        .eq('id', orderId);

      if (statusError) throw statusError;

      // 2. Fetch fresh inventory from Supabase
      const { data: freshInventory, error: fetchError } = await supabase
        .from('inventory')
        .select('*');

      if (fetchError || !freshInventory) {
        await fetchData();
        return true;
      }

      const warehouseItems = freshInventory.filter((r: any) => r.franchise_id === null);

      // 3. Transfer: update franchise_id from NULL to franchise ID
      for (const item of order.items) {
        const warehouseRow = warehouseItems.find((r: any) => r.sku === item.sku);

        if (!warehouseRow || warehouseRow.quantity < item.quantity) {
          console.error('Insufficient or missing warehouse stock for SKU:', item.sku);
          continue;
        }

        // Check if franchise already has this SKU
        const franchiseRow = freshInventory.find(
          (r: any) => r.sku === item.sku && r.franchise_id === order.franchiseId
        );

        if (item.quantity === warehouseRow.quantity && !franchiseRow) {
          // Exact match — transfer entire row by updating franchise_id
          const { error } = await supabase
            .from('inventory')
            .update({
              franchise_id: order.franchiseId,
              last_updated: new Date().toISOString()
            })
            .eq('id', warehouseRow.id);

          if (error) console.error('Error transferring inventory row:', error);
        } else {
          // Partial qty or franchise already has this SKU — split
          const newWarehouseQty = warehouseRow.quantity - item.quantity;
          const { error: deductError } = await supabase
            .from('inventory')
            .update({
              quantity: newWarehouseQty,
              last_updated: new Date().toISOString()
            })
            .eq('id', warehouseRow.id);

          if (deductError) {
            console.error('Error reducing warehouse qty:', deductError);
            continue;
          }

          if (franchiseRow) {
            // Add to existing franchise row
            const { error } = await supabase
              .from('inventory')
              .update({
                quantity: franchiseRow.quantity + item.quantity,
                last_updated: new Date().toISOString()
              })
              .eq('id', franchiseRow.id);

            if (error) console.error('Error updating franchise inventory:', error);
          } else {
            // Create new franchise row
            const { error } = await supabase
              .from('inventory')
              .insert({
                sku: warehouseRow.sku,
                barcode: warehouseRow.barcode,
                item_name: warehouseRow.item_name,
                category: warehouseRow.category,
                price: warehouseRow.price,
                quantity: item.quantity,
                description: warehouseRow.description,
                franchise_id: order.franchiseId,
              });

            if (error) console.error('Error creating franchise inventory:', error);
          }
        }
      }

      await fetchData();
      return true;
    } catch (err: any) {
      console.error('Error approving stock order:', err);
      setError(err.message);
      return false;
    }
  };

  // Reject a stock order
  const rejectStockOrder = async (orderId: string): Promise<boolean> => {
    if (!isSupabaseAvailable() || !supabase) return false;
    try {
      const { error } = await supabase
        .from('stock_orders')
        .update({ status: 'rejected', updated_at: new Date().toISOString() })
        .eq('id', orderId);

      if (error) throw error;
      await fetchData();
      return true;
    } catch (err: any) {
      console.error('Error rejecting stock order:', err);
      setError(err.message);
      return false;
    }
  };

  return (
    <InventoryContext.Provider
      value={{
        inventory,
        salesHistory,
        customers,
        stockOrders,
        isLoading,
        error,
        addInventoryItem,
        updateInventoryItem,
        updateInventoryQuantity,
        deleteInventoryItem,
        getInventoryBySku,
        getCustomerByPhone,
        recordSale,
        addCustomer,
        getTotalInventoryValue,
        getTotalInventoryCount,
        getLowStockItems,
        refreshData,
        createStockOrder,
        approveStockOrder,
        rejectStockOrder,
      }}
    >
      {children}
    </InventoryContext.Provider>
  );
}

export function useInventory() {
  const context = useContext(InventoryContext);
  if (context === undefined) {
    throw new Error("useInventory must be used within an InventoryProvider");
  }
  return context;
}