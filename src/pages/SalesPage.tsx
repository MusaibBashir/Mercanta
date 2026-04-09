import { useState, useRef, useEffect, useMemo } from "react";
import { Scan, Keyboard, Plus, Trash2, IndianRupee, Search, CreditCard, Banknote, Smartphone, RefreshCw, PauseCircle, PlayCircle, Printer, Camera, Star, X, CheckCircle } from "lucide-react";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Textarea } from "../components/ui/textarea";
import { toast } from "sonner";
import { useInventory } from "../context/InventoryContext";
import { useAuth } from "../context/AuthContext";
import { PageContainer } from "../components/layout/PageContainer";
import { printReceipt } from "../utils/printReceipt";
import { CameraScanner } from "../components/CameraScanner";
import { useRazorpay } from "react-razorpay";
import { createOrderToken, printTokenReceipt } from "../services/tokenService";
import { getRestaurantMenu, MenuItem } from "../services/menuService";

interface SaleItem {
    id: string;
    sku: string;
    name: string;
    quantity: number;
    price: number;
    barcode?: string;
    discount?: number;
    discountType?: 'percent' | 'flat';
    discountValue?: number;
}

export function SalesPage() {
    const { getInventoryBySku, recordSale, inventory, getCustomerByPhone } = useInventory();
    const { profile, franchise, activeBusinessAccount, hasPermission } = useAuth();
    const canSell = hasPermission('sales', 'write');

    // Draft key scoped per business account so accounts don't share drafts
    const DRAFT_KEY = `draft_sale_${activeBusinessAccount?.id ?? 'default'}`;

    // Menu items for restaurants
    const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
    const [loadingMenu, setLoadingMenu] = useState(false);

    // Franchise users: show only THEIR items. Admin: show all.
    const myInventory = useMemo(() => {
        if (profile?.role === "admin") return inventory;
        if (!franchise?.id) return [];
        return inventory.filter((item: any) => item.franchiseId === franchise.id);
    }, [inventory, profile?.role, franchise?.id]);

    // Load menu if restaurant
    useEffect(() => {
        if (activeBusinessAccount?.business_type === "restaurant" && activeBusinessAccount?.id) {
            setLoadingMenu(true);
            getRestaurantMenu(activeBusinessAccount.id)
                .then(items => setMenuItems(items))
                .catch(err => {
                    console.error("Error loading menu:", err);
                    toast.error("Failed to load menu items");
                })
                .finally(() => setLoadingMenu(false));
        }
    }, [activeBusinessAccount?.id, activeBusinessAccount?.business_type]);
    const [entryMode, setEntryMode] = useState<"barcode" | "manual">("manual");
    const [items, setItems] = useState<SaleItem[]>([]);
    const { Razorpay } = useRazorpay();
    // Per-tenant key takes priority; fall back to shared .env key
    const razorpayKey = activeBusinessAccount?.settings?.razorpay_key_id
        || import.meta.env.VITE_RAZORPAY_KEY_ID;

    useEffect(() => {
        if (razorpayKey) {
            console.log(`[SalesPage] Razorpay key found: ${razorpayKey.substring(0, 4)}...`);
        } else {
            console.warn("[SalesPage] Razorpay key is MISSING from environment.");
        }
    }, [razorpayKey]);

    // Form fields
    const [selectedSku, setSelectedSku] = useState("");
    const [itemName, setItemName] = useState("");
    const [quantity, setQuantity] = useState(1);
    const [price, setPrice] = useState(0);
    const [barcode, setBarcode] = useState("");

    // Customer details
    const [customerName, setCustomerName] = useState("");
    const [customerPhone, setCustomerPhone] = useState("");
    const [customerEmail, setCustomerEmail] = useState("");
    const [additionalNotes, setAdditionalNotes] = useState("");
    const [isLookingUpCustomer, setIsLookingUpCustomer] = useState(false);

    // Restaurant Order State
    const [isRestaurantOrder, setIsRestaurantOrder] = useState(false);
    const [specialInstructions, setSpecialInstructions] = useState("");

    // Auto-enable token creation for restaurant accounts
    useEffect(() => {
        if (activeBusinessAccount?.business_type === "restaurant") {
            setIsRestaurantOrder(true);
        }
    }, [activeBusinessAccount?.business_type]);

    // Payment Method State
    const [paymentMethod, setPaymentMethod] = useState<'cash' | 'upi' | 'card'>('cash');

    // Print toggle state
    const [printReceiptEnabled, setPrintReceiptEnabled] = useState(false);
    const [printTokenEnabled, setPrintTokenEnabled] = useState(false);
    const [isSpecialInstructionsOpen, setIsSpecialInstructionsOpen] = useState(false);
    const [isDiscountOpen, setIsDiscountOpen] = useState(false);

    // Customer section collapsed state
    const [isCustomerSectionOpen, setIsCustomerSectionOpen] = useState(false);

    // Advanced Pricing State
    const [cartDiscountType, setCartDiscountType] = useState<'percent' | 'flat'>('flat');
    const [cartDiscountValue, setCartDiscountValue] = useState(0);
    const [taxRate, setTaxRate] = useState(0);

    // Points State
    const [customerPointsBalance, setCustomerPointsBalance] = useState(0);
    const [pointsToUse, setPointsToUse] = useState(0);

    // Dynamic Computations
    const subtotal = useMemo(() => {
        return items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    }, [items]);

    const itemsDiscountTotal = useMemo(() => {
        return items.reduce((sum, item) => sum + (item.discount || 0), 0);
    }, [items]);

    const cartDiscountAmount = useMemo(() => {
        if (!cartDiscountValue) return 0;
        const subtotalAfterItems = subtotal - itemsDiscountTotal;
        if (cartDiscountType === 'percent') {
            return subtotalAfterItems * (cartDiscountValue / 100);
        }
        return cartDiscountValue;
    }, [subtotal, itemsDiscountTotal, cartDiscountType, cartDiscountValue]);

    const totalDiscount = itemsDiscountTotal + cartDiscountAmount;

    const taxableAmount = Math.max(0, subtotal - totalDiscount);
    const taxAmount = taxableAmount * (taxRate / 100);
    const totalBeforePoints = taxableAmount + taxAmount;

    // Points logic: 1 point = 1 rupee. Cannot use more points than balance or grand total.
    const maxPointsUsable = Math.min(customerPointsBalance, Math.floor(totalBeforePoints));
    const actualPointsUsed = Math.min(pointsToUse, maxPointsUsable);
    const grandTotal = totalBeforePoints - actualPointsUsed;

    // Held Sale State
    const [hasHeldSale, setHasHeldSale] = useState(false);

    // Camera Scanner State
    const [isScanning, setIsScanning] = useState(false);

    // Order confirmation modal (mobile restaurant)
    const [orderConfirmModal, setOrderConfirmModal] = useState<{
        tokenNumber: number;
        customerName: string;
        items: Array<{ name: string; quantity: number; price: number }>;
        total: number;
    } | null>(null);

    useEffect(() => {
        if (!orderConfirmModal) return;
        const timer = setTimeout(() => setOrderConfirmModal(null), 25000);
        return () => clearTimeout(timer);
    }, [orderConfirmModal]);

    useEffect(() => {
        // Check if there's a held sale on mount
        const heldSale = localStorage.getItem('heldSale');
        if (heldSale) {
            setHasHeldSale(true);
        }
    }, []);

    // Restore draft cart when the active account becomes available (survives tab-switch reloads)
    const draftRestoredRef = useRef(false);
    useEffect(() => {
        if (!activeBusinessAccount?.id || draftRestoredRef.current) return;
        draftRestoredRef.current = true;
        try {
            const raw = localStorage.getItem(DRAFT_KEY);
            if (!raw) return;
            const draft = JSON.parse(raw);
            if (!draft.items?.length && !draft.customerName) return;
            setItems(draft.items ?? []);
            setCustomerName(draft.customerName ?? '');
            setCustomerPhone(draft.customerPhone ?? '');
            setCustomerEmail(draft.customerEmail ?? '');
            setAdditionalNotes(draft.additionalNotes ?? '');
            setSpecialInstructions(draft.specialInstructions ?? '');
            setCartDiscountType(draft.cartDiscountType ?? 'flat');
            setCartDiscountValue(draft.cartDiscountValue ?? 0);
            setTaxRate(draft.taxRate ?? 0);
            setPaymentMethod(draft.paymentMethod ?? 'cash');
            setPointsToUse(draft.pointsToUse ?? 0);
            toast.info('Cart restored from your last session.');
        } catch { /* corrupted draft — ignore */ }
    }, [activeBusinessAccount?.id]);

    // Auto-save cart to localStorage so a tab-switch reload doesn't lose work
    useEffect(() => {
        if (!activeBusinessAccount?.id) return;
        if (items.length > 0 || customerName) {
            localStorage.setItem(DRAFT_KEY, JSON.stringify({
                items, customerName, customerPhone, customerEmail,
                additionalNotes, specialInstructions,
                cartDiscountType, cartDiscountValue,
                taxRate, paymentMethod, pointsToUse, isRestaurantOrder,
            }));
        } else {
            localStorage.removeItem(DRAFT_KEY);
        }
    }, [items, customerName, customerPhone, customerEmail, additionalNotes,
        specialInstructions, cartDiscountType, cartDiscountValue,
        taxRate, paymentMethod, pointsToUse, isRestaurantOrder, activeBusinessAccount?.id]);

    // Fuzzy search state
    const [searchQuery, setSearchQuery] = useState("");
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    // Levenshtein distance for fuzzy matching
    const levenshteinDistance = (a: string, b: string): number => {
        const matrix: number[][] = [];
        for (let i = 0; i <= b.length; i++) matrix[i] = [i];
        for (let j = 0; j <= a.length; j++) matrix[0][j] = j;
        for (let i = 1; i <= b.length; i++) {
            for (let j = 1; j <= a.length; j++) {
                if (b[i - 1] === a[j - 1]) {
                    matrix[i][j] = matrix[i - 1][j - 1];
                } else {
                    matrix[i][j] = Math.min(
                        matrix[i - 1][j - 1] + 1,
                        matrix[i][j - 1] + 1,
                        matrix[i - 1][j] + 1
                    );
                }
            }
        }
        return matrix[b.length][a.length];
    };

    // Fuzzy filtered inventory items (or menu items for restaurants)
    const filteredInventory = useMemo(() => {
        const itemsToSearch = activeBusinessAccount?.business_type === "restaurant" ? menuItems : myInventory;
        
        if (!searchQuery.trim()) return itemsToSearch;
        const query = searchQuery.toLowerCase();
        
        const levenshtein = (a: string, b: string): number => {
            const matrix: number[][] = [];
            for (let i = 0; i <= b.length; i++) matrix[i] = [i];
            for (let j = 0; j <= a.length; j++) matrix[0][j] = j;
            for (let i = 1; i <= b.length; i++) {
                for (let j = 1; j <= a.length; j++) {
                    if (b[i - 1] === a[j - 1]) {
                        matrix[i][j] = matrix[i - 1][j - 1];
                    } else {
                        matrix[i][j] = Math.min(
                            matrix[i - 1][j - 1] + 1,
                            matrix[i][j - 1] + 1,
                            matrix[i - 1][j] + 1
                        );
                    }
                }
            }
            return matrix[b.length][a.length];
        };
        
        return itemsToSearch
            .map((item: any) => {
                const name = activeBusinessAccount?.business_type === "restaurant" 
                    ? item.item_name.toLowerCase() 
                    : item.itemName.toLowerCase();
                const sku = item.sku?.toLowerCase() || "";
                // Exact substring match gets highest priority
                if (name.includes(query) || sku.includes(query)) {
                    return { ...item, score: 0 };
                }
                // Fuzzy match on name and sku
                const nameDistance = levenshtein(query, name.substring(0, query.length));
                const skuDistance = sku ? levenshtein(query, sku.substring(0, query.length)) : Infinity;
                const minDistance = Math.min(nameDistance, skuDistance);
                // Allow matches within a reasonable threshold
                const threshold = Math.max(2, Math.floor(query.length / 3));
                if (minDistance <= threshold) {
                    return { ...item, score: minDistance };
                }
                return null;
            })
            .filter(Boolean)
            .sort((a: any, b: any) => a.score - b.score);
    }, [searchQuery, myInventory, menuItems, activeBusinessAccount?.business_type]);

    // Close dropdown on outside click or Escape
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsDropdownOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    // Global Keyboard Shortcuts
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // Escape: Close dropdowns
            if (e.key === 'Escape') {
                setIsDropdownOpen(false);
            }

            // F2: Focus Search
            if (e.key === 'F2') {
                e.preventDefault();
                const searchInput = document.getElementById('itemSearch');
                if (searchInput) {
                    searchInput.focus();
                }
            }

            // F4: Complete Sale
            if (e.key === 'F4') {
                e.preventDefault();
                handleCompleteSale();
            }

            // Ctrl+H (or Cmd+H): Hold Sale
            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'h') {
                e.preventDefault();
                handleHoldSale();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [items, customerName, paymentMethod, grandTotal]); // Dependencies needed for complete sale/hold sale handlers

    const handleSelectItem = (itemIdentifier: string) => {
        if (activeBusinessAccount?.business_type === "restaurant") {
            // For restaurants, itemIdentifier is the menu item name
            const menuItem = menuItems.find((item: MenuItem) => item.item_name === itemIdentifier);
            if (!menuItem) return;
            const existing = items.find(i => i.sku === menuItem.id);
            if (existing) {
                setItems(items.map(i => i.sku === menuItem.id ? { ...i, quantity: i.quantity + 1 } : i));
            } else {
                setItems([...items, {
                    id: Date.now().toString(),
                    sku: menuItem.id,
                    name: menuItem.item_name,
                    quantity: 1,
                    price: menuItem.price,
                    discount: 0,
                    discountType: 'flat' as const,
                    discountValue: 0
                }]);
            }
            toast.success(`Added ${menuItem.item_name}`);
        } else {
            // For franchises, itemIdentifier is the SKU
            const inventoryItem = getInventoryBySku(itemIdentifier);
            if (!inventoryItem) return;
            if (inventoryItem.quantity < 1) {
                toast.error("Out of stock");
                return;
            }
            const existing = items.find(i => i.sku === inventoryItem.sku);
            if (existing) {
                if (inventoryItem.quantity < existing.quantity + 1) {
                    toast.error(`Only ${inventoryItem.quantity} units available in stock`);
                    return;
                }
                setItems(items.map(i => i.sku === inventoryItem.sku ? { ...i, quantity: i.quantity + 1 } : i));
            } else {
                setItems([...items, {
                    id: Date.now().toString(),
                    sku: inventoryItem.sku,
                    name: inventoryItem.itemName,
                    quantity: 1,
                    price: inventoryItem.price,
                    barcode: inventoryItem.barcode,
                    discount: 0,
                    discountType: 'flat' as const,
                    discountValue: 0
                }]);
            }
            toast.success(`Added ${inventoryItem.itemName}`);
        }
        setSearchQuery("");
        setIsDropdownOpen(false);
    };

    // Handle phone number change with auto-lookup
    const handlePhoneChange = async (phone: string) => {
        setCustomerPhone(phone);

        // Only lookup when phone has reasonable length (10+ digits)
        if (phone.replace(/\D/g, '').length >= 10) {
            setIsLookingUpCustomer(true);
            try {
                const customer = await getCustomerByPhone(phone);
                if (customer) {
                    setCustomerName(customer.name);
                    setCustomerEmail(customer.email || "");
                    setCustomerPointsBalance(customer.pointsBalance || 0);
                    toast.success(`Customer found: ${customer.name}`);
                } else {
                    setCustomerPointsBalance(0);
                }
            } catch (err) {
                console.error('Error looking up customer:', err);
            } finally {
                setIsLookingUpCustomer(false);
            }
        }
    };

    const handleAddItem = () => {
        if (!selectedSku) {
            toast.error("Please select an item");
            return;
        }

        if (quantity <= 0) {
            toast.error("Please enter a valid quantity");
            return;
        }

        if (activeBusinessAccount?.business_type === "restaurant") {
            // For restaurants, selectedSku is the menu item ID
            const menuItem = menuItems.find((item: MenuItem) => item.id === selectedSku);
            if (!menuItem) {
                toast.error("Menu item not found");
                return;
            }

            const newItem: SaleItem = {
                id: Date.now().toString(),
                sku: menuItem.id,
                name: menuItem.item_name,
                quantity,
                price: menuItem.price,
                discount: 0,
                discountType: 'flat',
                discountValue: 0
            };

            setItems([...items, newItem]);
            toast.success("Item added to order");
        } else {
            // For franchises, use inventory logic
            const inventoryItem = getInventoryBySku(selectedSku);
            if (!inventoryItem) {
                toast.error("Item not found in inventory");
                return;
            }

            if (inventoryItem.quantity < quantity) {
                toast.error(`Only ${inventoryItem.quantity} units available in stock`);
                return;
            }

            const newItem: SaleItem = {
                id: Date.now().toString(),
                sku: inventoryItem.sku,
                name: inventoryItem.itemName,
                quantity,
                price: inventoryItem.price,
                barcode: inventoryItem.barcode,
                discount: 0,
                discountType: 'flat',
                discountValue: 0
            };

            setItems([...items, newItem]);
            toast.success("Item added to sale");
        }

        // Reset item fields
        setSelectedSku("");
        setItemName("");
        setQuantity(1);
        setPrice(0);
        setBarcode("");
        setSearchQuery("");
    };

    const handleRemoveItem = (id: string) => {
        setItems(items.filter(item => item.id !== id));
        toast.success("Item removed");
    };

    const handleUpdateItemDiscount = (id: string, type: 'percent' | 'flat', value: number) => {
        setItems(items.map(item => {
            if (item.id === id) {
                let discountAmount = 0;
                const itemTotal = item.price * item.quantity;
                if (type === 'percent') {
                    discountAmount = itemTotal * (value / 100);
                } else {
                    discountAmount = value;
                }
                return {
                    ...item,
                    discountType: type,
                    discountValue: value,
                    discount: discountAmount
                };
            }
            return item;
        }));
    };

    const handleUpdateItemQuantity = (id: string, newQuantity: number) => {
        if (newQuantity <= 0) return;
        setItems(items.map(item => {
            if (item.id === id) {
                // Skip stock check for restaurants
                if (activeBusinessAccount?.business_type !== "restaurant") {
                    // Check stock (optional but good practice) for franchises only
                    const inventoryItem = myInventory.find((i: any) => i.sku === item.sku);
                    if (inventoryItem && inventoryItem.quantity < newQuantity) {
                        toast.error(`Only ${inventoryItem.quantity} units available in stock for ${item.name}`);
                        return item; // Keep old quantity
                    }
                }

                // Recalculate discount if it's a percentage
                let discountAmount = item.discount || 0;
                if (item.discountType === 'percent' && item.discountValue) {
                    const newItemTotal = item.price * newQuantity;
                    discountAmount = newItemTotal * (item.discountValue / 100);
                }

                return { ...item, quantity: newQuantity, discount: discountAmount };
            }
            return item;
        }));
    };

    const handleUpdateItemPrice = (id: string, newPrice: number) => {
        if (newPrice < 0) return;
        setItems(items.map(item => {
            if (item.id === id) {
                // Recalculate discount if it's a percentage
                let discountAmount = item.discount || 0;
                if (item.discountType === 'percent' && item.discountValue) {
                    const newItemTotal = newPrice * item.quantity;
                    discountAmount = newItemTotal * (item.discountValue / 100);
                }

                return { ...item, price: newPrice, discount: discountAmount };
            }
            return item;
        }));
    };

    const handleScanBarcode = (scannedBarcode?: string) => {
        if (activeBusinessAccount?.business_type === "restaurant") {
            toast.error("Barcode scanning is not available for restaurants");
            return;
        }

        const barcodeToLookup = scannedBarcode || barcode;
        if (!barcodeToLookup.trim()) {
            toast.error("Please enter a barcode");
            return;
        }

        // Find item by barcode
        const inventoryItem = myInventory.find((item: any) => item.barcode === barcodeToLookup);

        if (inventoryItem) {
            setSelectedSku(inventoryItem.sku);
            setItemName(inventoryItem.itemName);
            setPrice(inventoryItem.price);
            setBarcode(barcodeToLookup);
            toast.success(`Found: ${inventoryItem.itemName}`);
        } else {
            toast.error("Barcode not found in inventory");
        }
    };

    // Per-tenant shop identity — settings override franchise/defaults
    const shopName = activeBusinessAccount?.settings?.shop_address
        ? (activeBusinessAccount.display_name || activeBusinessAccount.business_name)
        : (activeBusinessAccount?.display_name || activeBusinessAccount?.business_name || franchise?.name || "Mercanta");
    const shopAddress = activeBusinessAccount?.settings?.shop_address
        || (franchise?.region ? `${franchise.region}, ${franchise.state}` : "");

    const handleCompleteSale = async () => {
        if (!canSell) {
            toast.error("You don't have permission to record sales.");
            return;
        }
        if (items.length === 0) {
            toast.error("Please add at least one item");
            return;
        }

        // Default to "Walk-in" if no customer name provided
        const finalCustomerName = customerName.trim() || "Walk-in";
        if (!customerName.trim()) {
            setCustomerName(finalCustomerName);
        }

        const processSale = async (transactionId?: string, printWindow?: Window | null, skipReceiptAndReset?: boolean) => {
            // Use finalCustomerName (defaults to "Walk-in" if blank)
            const effectiveCustomerName = finalCustomerName;
            // Record the sale and update inventory
            const saleResult = await recordSale({
                items: items.map(item => ({
                    sku: item.sku,
                    itemName: item.name,
                    quantity: item.quantity,
                    price: item.price,
                    discount: item.discount,
                    discountType: item.discountType,
                    discountValue: item.discountValue,
                })),
                customerName: effectiveCustomerName,
                customerPhone,
                customerEmail,
                total: grandTotal,
                subtotal,
                discountTotal: totalDiscount,
                taxRate,
                taxAmount,
                paymentMethod,
                paymentDetails: (transactionId ? { razorpay_payment_id: transactionId } : undefined) as any,
                pointsUsed: actualPointsUsed
            }, {
                // Skip inventory checks for restaurant orders
                skipInventoryCheck: activeBusinessAccount?.business_type === "restaurant"
            });

            const success = saleResult.success;

            if (skipReceiptAndReset) {
                // For card/UPI: receipt was already printed and cart was already reset
                // immediately after payment. Just propagate failure so the caller can toast.
                if (!success) throw new Error("DB record failed");

                // Create token for restaurant orders in UPI/card flow
                if (activeBusinessAccount?.business_type === "restaurant" && activeBusinessAccount && saleResult.saleId) {
                    try {
                        const tokenResult = await createOrderToken({
                            sale_id: saleResult.saleId,
                            business_account_id: activeBusinessAccount.id,
                            customer_name: effectiveCustomerName,
                            order_items: items.map(item => `${item.name} x${item.quantity}`).join(", "),
                            notes: specialInstructions,
                            is_restaurant_order: true
                        });
                        if (tokenResult.success && tokenResult.data) {
                            const itemsStr = items.map(item => `${item.name} x${item.quantity}`).join("\n");
                            if (printTokenEnabled) {
                                printTokenReceipt(
                                    tokenResult.data.token_number,
                                    effectiveCustomerName,
                                    itemsStr,
                                    grandTotal,
                                    specialInstructions
                                );
                            }
                            toast.success(`Order #${tokenResult.data.token_number} created!`);
                            setOrderConfirmModal({
                                tokenNumber: tokenResult.data.token_number,
                                customerName: effectiveCustomerName,
                                items: items.map(i => ({ name: i.name, quantity: i.quantity, price: i.price })),
                                total: grandTotal,
                            });
                        } else if (!tokenResult.success) {
                            toast.error(`Token creation failed: ${tokenResult.error}`);
                        }
                    } catch (error) {
                        console.error("Token creation error:", error);
                        toast.error("Failed to create order token");
                    }
                }
                return;
            }

            if (success) {
                // Feature 2: Create token for restaurant orders
                if (activeBusinessAccount?.business_type === "restaurant" && activeBusinessAccount && saleResult.saleId) {
                    try {
                        const tokenResult = await createOrderToken({
                            sale_id: saleResult.saleId,
                            business_account_id: activeBusinessAccount.id,
                            customer_name: effectiveCustomerName,
                            order_items: items.map(item => `${item.name} x${item.quantity}`).join(", "),
                            notes: specialInstructions,
                            is_restaurant_order: true
                        });

                        if (tokenResult.success && tokenResult.data) {
                            // Print token receipt if enabled
                            const itemsStr = items.map(item => `${item.name} x${item.quantity}`).join("\n");
                            if (printTokenEnabled) {
                                printTokenReceipt(
                                    tokenResult.data.token_number,
                                    effectiveCustomerName,
                                    itemsStr,
                                    grandTotal,
                                    specialInstructions
                                );
                            }
                            toast.success(`Order #${tokenResult.data.token_number} created!`);
                            setOrderConfirmModal({
                                tokenNumber: tokenResult.data.token_number,
                                customerName: effectiveCustomerName,
                                items: items.map(i => ({ name: i.name, quantity: i.quantity, price: i.price })),
                                total: grandTotal,
                            });
                        } else if (!tokenResult.success) {
                            toast.error(`Token creation failed: ${tokenResult.error}`);
                        }
                    } catch (error) {
                        console.error("Token creation error:", error);
                        toast.error("Failed to create order token");
                    }
                }

                // Print receipt in a new window (cash path)
                if (printReceiptEnabled) printReceipt(
                    {
                        date: new Date().toISOString(),
                        customerName: effectiveCustomerName,
                        customerPhone,
                        customerEmail,
                        items: items.map(item => ({
                            itemName: item.name,
                            quantity: item.quantity,
                            price: item.price,
                            discount: item.discount,
                            discountType: item.discountType,
                            discountValue: item.discountValue,
                        })),
                        subtotal,
                        discountTotal: totalDiscount,
                        taxRate,
                        taxAmount,
                        total: grandTotal,
                        paymentMethod,
                        transactionId,
                    },
                    {
                        name: shopName,
                        address: shopAddress,
                    },
                    printWindow
                );

                // Reset form
                handleClearCart();
                toast.success("Sale completed successfully!");
            } else {
                const errorMsg = profile?.role === "admin" 
                    ? `Sale failed: Database error`
                    : "Failed to complete sale. Check console for details.";
                toast.error(errorMsg);
            }
        };


        if (paymentMethod === 'card' || paymentMethod === 'upi') {
            if (!razorpayKey) {
                toast.error("Razorpay Sandbox Key is missing in .env configurations.");
                return;
            }

            // Capture a snapshot of all the data needed to print the receipt right now,
            // before any async DB operations that would delay printing.
            const receiptItems = items.map(item => ({
                itemName: item.name,
                quantity: item.quantity,
                price: item.price,
                discount: item.discount,
                discountType: item.discountType,
                discountValue: item.discountValue,
            }));
            const receiptSubtotal = subtotal;
            const receiptDiscountTotal = totalDiscount;
            const receiptTaxRate = taxRate;
            const receiptTaxAmount = taxAmount;
            const receiptGrandTotal = grandTotal;
            const receiptCustomerName = finalCustomerName;
            const receiptCustomerPhone = customerPhone;
            const receiptCustomerEmail = customerEmail;
            const receiptPaymentMethod = paymentMethod;
            const receiptShopName = shopName;
            const receiptShopAddress = shopAddress;

            // Open window synchronously to bypass popup blocker
            const printTarget = window.open("", "_blank");
            if (printTarget) {
                printTarget.document.write("<html><head><title>Processing Payment...</title></head><body style='font-family:sans-serif;padding:2rem;text-align:center;'><h2>Processing Payment...</h2><p>Please complete the payment in the Razorpay popup.<br>This window will update with your receipt automatically.</p></body></html>");
            }

            const options = {
                key: razorpayKey,
                amount: Math.round(grandTotal * 100).toString(),
                currency: "INR",
                name: shopName,
                description: `Purchase Payment`,
                handler: async function (response: any) {
                    const transactionId = response.razorpay_payment_id;
                    toast.success(`Payment successful! Txn ID: ${transactionId}`);

                    // Print the receipt IMMEDIATELY — all data is already captured above.
                    // Do NOT wait for the DB recordSale call.
                    if (printReceiptEnabled) printReceipt(
                        {
                            date: new Date().toISOString(),
                            customerName: receiptCustomerName,
                            customerPhone: receiptCustomerPhone,
                            customerEmail: receiptCustomerEmail,
                            items: receiptItems,
                            subtotal: receiptSubtotal,
                            discountTotal: receiptDiscountTotal,
                            taxRate: receiptTaxRate,
                            taxAmount: receiptTaxAmount,
                            total: receiptGrandTotal,
                            paymentMethod: receiptPaymentMethod,
                            transactionId,
                        },
                        {
                            name: receiptShopName,
                            address: receiptShopAddress,
                        },
                        printTarget
                    );

                    // Reset the cart immediately so the cashier can start the next sale.
                    handleClearCart();
                    toast.success("Sale completed successfully!");

                    // Record the sale to the database in the background.
                    // If it fails, show an error toast — the receipt has already been printed.
                    processSale(transactionId, null, true).catch(() => {
                        toast.error("Payment recorded but sale DB entry failed. Please log this manually.");
                    });
                },
                modal: {
                    ondismiss: function () {
                        if (printTarget && !printTarget.closed) {
                            printTarget.close();
                        }
                    }
                },
                prefill: {
                    name: finalCustomerName,
                    email: customerEmail,
                    contact: customerPhone,
                },
                theme: {
                    color: "#9333ea", // purple-600
                },
            };

            const rzp = new Razorpay(options as any);
            rzp.on("payment.failed", function (response: any) {
                toast.error(`Payment Failed: ${response.error.description || "Unknown error"}`);
                if (printTarget && !printTarget.closed) {
                    printTarget.close();
                }
            });
            rzp.open();
        } else {
            // Process cash or split immediately
            await processSale();
        }
    };

    const handleClearCart = () => {
        localStorage.removeItem(DRAFT_KEY);
        setItems([]);
        setCustomerName("");
        setCustomerPhone("");
        setCustomerEmail("");
        setAdditionalNotes("");
        setCartDiscountType('flat');
        setCartDiscountValue(0);
        // setTaxRate(0); // Keeping tax rate context
        setPaymentMethod('cash');
        setCustomerPointsBalance(0);
        setPointsToUse(0);
    };

    const handleHoldSale = () => {
        if (items.length === 0) {
            toast.error("Cart is empty");
            return;
        }

        const saleData = {
            items,
            customerName,
            customerPhone,
            customerEmail,
            additionalNotes,
            cartDiscountType,
            cartDiscountValue,
            taxRate
        };

        localStorage.setItem('heldSale', JSON.stringify(saleData));
        setHasHeldSale(true);
        handleClearCart();
        toast.success("Sale placed on hold");
    };

    const handleResumeSale = () => {
        const heldSale = localStorage.getItem('heldSale');
        if (heldSale) {
            try {
                const saleData = JSON.parse(heldSale);
                setItems(saleData.items || []);
                setCustomerName(saleData.customerName || "");
                setCustomerPhone(saleData.customerPhone || "");
                setCustomerEmail(saleData.customerEmail || "");
                setAdditionalNotes(saleData.additionalNotes || "");
                setCartDiscountType(saleData.cartDiscountType || 'flat');
                setCartDiscountValue(saleData.cartDiscountValue || 0);
                setTaxRate(saleData.taxRate || 0);

                localStorage.removeItem('heldSale');
                setHasHeldSale(false);
                toast.success("Sale resumed");
            } catch (error) {
                console.error("Error parsing held sale:", error);
                toast.error("Failed to resume sale");
            }
        } else {
            toast.error("No held sale found");
        }
    };


    return (
        <PageContainer
            title="New Sale"
            subtitle="Add items and process payment"
            icon={<IndianRupee className="w-5 h-5 text-purple-600" />}
            iconBgColor="bg-purple-100"
        >
            <div className="flex flex-col gap-4 lg:grid lg:grid-cols-2 lg:gap-6">

                {/* ── LEFT COLUMN ── Item entry + Cart ── */}
                <div className="space-y-4">

                    {/* Search + Add Item Card */}
                    <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm space-y-3">

                        {/* Entry mode toggle (franchise only) */}
                        {activeBusinessAccount?.business_type !== "restaurant" && (
                            <div className="flex gap-1 p-1 bg-gray-100 rounded-xl">
                                <button
                                    onClick={() => setEntryMode("manual")}
                                    className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2 ${entryMode === "manual" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}
                                >
                                    <Keyboard className="w-4 h-4" />
                                    Manual
                                </button>
                                <button
                                    onClick={() => setEntryMode("barcode")}
                                    className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2 ${entryMode === "barcode" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}
                                >
                                    <Scan className="w-4 h-4" />
                                    Barcode
                                </button>
                            </div>
                        )}

                        {/* Barcode input (franchise + barcode mode) */}
                        {activeBusinessAccount?.business_type !== "restaurant" && entryMode === "barcode" && (
                            <div className="space-y-3">
                                <div className="flex gap-2">
                                    <Input
                                        id="barcode"
                                        value={barcode}
                                        onChange={(e) => setBarcode(e.target.value)}
                                        placeholder="Scan or type barcode..."
                                        className="flex-1"
                                        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleScanBarcode(); } }}
                                    />
                                    <Button onClick={() => handleScanBarcode()} variant="outline" className="px-3" title="Search Barcode">
                                        <Scan className="w-4 h-4" />
                                    </Button>
                                </div>
                                <div className="relative flex items-center">
                                    <div className="flex-grow border-t border-gray-200"></div>
                                    <span className="flex-shrink-0 mx-3 text-gray-400 text-xs">OR</span>
                                    <div className="flex-grow border-t border-gray-200"></div>
                                </div>
                                <Button onClick={() => setIsScanning(true)} variant="outline" className="w-full text-blue-600 border-blue-200 hover:bg-blue-50">
                                    <Camera className="w-4 h-4 mr-2" />
                                    Scan with Camera
                                </Button>
                                {isScanning && (
                                    <CameraScanner onScan={(decodedText) => { handleScanBarcode(decodedText); }} onClose={() => setIsScanning(false)} />
                                )}
                            </div>
                        )}

                        {/* Fuzzy search input */}
                        <div ref={dropdownRef} className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none" />
                            <input
                                id="itemSearch"
                                type="text"
                                value={searchQuery}
                                onChange={(e: any) => {
                                    setSearchQuery(e.target.value);
                                    setIsDropdownOpen(true);
                                    if (!e.target.value) { setSelectedSku(""); setItemName(""); setPrice(0); }
                                }}
                                onFocus={() => setIsDropdownOpen(true)}
                                placeholder={activeBusinessAccount?.business_type === "restaurant" ? "Search menu items..." : "Search items... (F2)"}
                                className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-purple-400 focus:border-transparent text-base"
                                autoComplete="off"
                            />
                            {isDropdownOpen && (
                                <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg max-h-64 overflow-y-auto">
                                    {filteredInventory.length === 0 ? (
                                        <div className="px-4 py-4 text-sm text-gray-500 text-center">
                                            No items found{searchQuery && " — try a different search"}
                                        </div>
                                    ) : (
                                        filteredInventory.map((item: any) => {
                                            const isRestaurant = activeBusinessAccount?.business_type === "restaurant";
                                            const itemId = isRestaurant ? item.id : item.sku;
                                            const displayName = isRestaurant ? item.item_name : item.itemName;
                                            return (
                                                <button
                                                    key={itemId}
                                                    type="button"
                                                    onClick={() => handleSelectItem(isRestaurant ? displayName : item.sku)}
                                                    className="w-full text-left px-4 py-3 hover:bg-purple-50 border-b border-gray-100 last:border-b-0 transition-colors"
                                                >
                                                    <div className="flex justify-between items-center">
                                                        <div>
                                                            <p className="text-sm font-semibold text-gray-900">{displayName}</p>
                                                            {isRestaurant ? (
                                                                <p className="text-xs text-gray-500">{item.category}</p>
                                                            ) : (
                                                                <p className="text-xs text-gray-500">SKU: {item.sku}</p>
                                                            )}
                                                        </div>
                                                        <div className="text-right ml-3 shrink-0">
                                                            <p className="text-sm font-bold text-purple-700">₹{item.price.toFixed(2)}</p>
                                                            {!isRestaurant && (
                                                                <p className={`text-xs ${item.quantity > 0 ? "text-emerald-600" : "text-red-500"}`}>
                                                                    {item.quantity} in stock
                                                                </p>
                                                            )}
                                                        </div>
                                                    </div>
                                                </button>
                                            );
                                        })
                                    )}
                                </div>
                            )}
                        </div>

                    </div>

                    {/* Cart Items Card */}
                    <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
                        {/* Cart header */}
                        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
                            <h2 className="font-bold text-gray-900 text-base">
                                Cart <span className="text-gray-400 font-normal text-sm">({items.length} item{items.length !== 1 ? "s" : ""})</span>
                            </h2>
                            <div className="flex gap-2">
                                {hasHeldSale && items.length === 0 && (
                                    <button
                                        onClick={handleResumeSale}
                                        className="flex items-center gap-1 text-xs font-medium text-orange-600 bg-orange-50 border border-orange-200 rounded-lg px-2 py-1 hover:bg-orange-100 transition-colors"
                                    >
                                        <PlayCircle className="w-3.5 h-3.5" />
                                        Resume
                                    </button>
                                )}
                                {items.length > 0 && (
                                    <>
                                        <button
                                            onClick={handleHoldSale}
                                            className="flex items-center gap-1 text-xs font-medium text-blue-600 bg-blue-50 border border-blue-200 rounded-lg px-2 py-1 hover:bg-blue-100 transition-colors"
                                        >
                                            <PauseCircle className="w-3.5 h-3.5" />
                                            Hold
                                        </button>
                                        <button
                                            onClick={handleClearCart}
                                            className="flex items-center gap-1 text-xs font-medium text-red-600 bg-red-50 border border-red-200 rounded-lg px-2 py-1 hover:bg-red-100 transition-colors"
                                        >
                                            <RefreshCw className="w-3.5 h-3.5" />
                                            Clear
                                        </button>
                                    </>
                                )}
                            </div>
                        </div>

                        {/* Cart body */}
                        {items.length === 0 ? (
                            <div className="text-center py-10 text-gray-400">
                                <p className="text-sm">Cart is empty</p>
                                <p className="text-xs mt-1">Search and add items above</p>
                            </div>
                        ) : (
                            <div className="divide-y divide-gray-100">
                                {items.map((item) => (
                                    <div key={item.id} className="flex items-center gap-3 px-4 py-3">
                                        <div className="flex-1 min-w-0">
                                            <p className="font-medium text-gray-900 text-sm truncate">{item.name}</p>
                                            <p className="text-xs text-gray-500 mt-0.5">₹{item.price.toFixed(2)} each</p>
                                        </div>
                                        {/* Qty stepper */}
                                        <div className="flex items-center gap-1 shrink-0">
                                            <button
                                                onClick={() => handleUpdateItemQuantity(item.id, item.quantity - 1)}
                                                className="w-7 h-7 rounded-lg bg-gray-100 text-gray-700 font-bold hover:bg-gray-200 flex items-center justify-center transition-colors text-base"
                                            >−</button>
                                            <span className="w-7 text-center font-semibold text-gray-900 text-sm">{item.quantity}</span>
                                            <button
                                                onClick={() => handleUpdateItemQuantity(item.id, item.quantity + 1)}
                                                className="w-7 h-7 rounded-lg bg-gray-100 text-gray-700 font-bold hover:bg-gray-200 flex items-center justify-center transition-colors text-base"
                                            >+</button>
                                        </div>
                                        <div className="text-right shrink-0 w-20">
                                            <p className="font-semibold text-gray-900 text-sm">
                                                ₹{((item.quantity * item.price) - (item.discount || 0)).toFixed(2)}
                                            </p>
                                            {(item.discount || 0) > 0 && (
                                                <p className="text-xs text-emerald-600">−₹{(item.discount || 0).toFixed(2)}</p>
                                            )}
                                        </div>
                                        <button
                                            onClick={() => handleRemoveItem(item.id)}
                                            className="w-7 h-7 rounded-lg hover:bg-red-100 flex items-center justify-center transition-colors shrink-0"
                                        >
                                            <Trash2 className="w-3.5 h-3.5 text-red-500" />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* Cart subtotal (visible on mobile, below cart) */}
                        {items.length > 0 && (
                            <div className="border-t border-gray-100 px-4 py-3 flex justify-between items-center bg-gray-50 lg:hidden">
                                <span className="text-sm text-gray-600">Subtotal</span>
                                <span className="font-bold text-gray-900">₹{subtotal.toFixed(2)}</span>
                            </div>
                        )}
                    </div>
                </div>

                {/* ── RIGHT COLUMN ── Payment + Options ── */}
                <div className="space-y-4">

                    {/* Customer Section (collapsible) */}
                    <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
                        <button
                            onClick={() => setIsCustomerSectionOpen(o => !o)}
                            className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors"
                        >
                            <div className="flex items-center gap-2">
                                <span className="font-semibold text-gray-900 text-sm">Customer</span>
                                <span className="text-xs text-gray-400">(optional)</span>
                                {customerName && (
                                    <span className="text-xs text-purple-700 bg-purple-50 px-2 py-0.5 rounded-full font-medium">{customerName}</span>
                                )}
                                {isLookingUpCustomer && (
                                    <span className="text-xs text-blue-500">Looking up...</span>
                                )}
                            </div>
                            <span className="text-gray-400 text-lg leading-none">{isCustomerSectionOpen ? "−" : "+"}</span>
                        </button>

                        {isCustomerSectionOpen && (
                            <div className="px-4 pb-4 space-y-3 border-t border-gray-100 pt-3">
                                <div>
                                    <label className="block text-xs font-medium text-gray-600 mb-1">Phone</label>
                                    <Input
                                        type="tel"
                                        value={customerPhone}
                                        onChange={(e) => handlePhoneChange(e.target.value)}
                                        placeholder="Enter phone to auto-fill"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-gray-600 mb-1">Name</label>
                                    <Input
                                        value={customerName}
                                        onChange={(e) => setCustomerName(e.target.value)}
                                        placeholder="Leave blank for Walk-in"
                                    />
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Special Instructions (restaurant only, collapsible) */}
                    {isRestaurantOrder && (
                        <div className="bg-white border border-orange-100 rounded-2xl shadow-sm overflow-hidden">
                            <button
                                onClick={() => setIsSpecialInstructionsOpen(o => !o)}
                                className="w-full flex items-center justify-between px-4 py-3 hover:bg-orange-50 transition-colors"
                            >
                                <div className="flex items-center gap-2">
                                    <span className="text-sm font-semibold text-orange-700">Special Instructions</span>
                                    <span className="text-xs text-gray-400">(optional)</span>
                                    {specialInstructions && (
                                        <span className="text-xs text-orange-600 bg-orange-50 px-2 py-0.5 rounded-full font-medium truncate max-w-[100px]">{specialInstructions}</span>
                                    )}
                                </div>
                                <span className="text-gray-400 text-lg leading-none">{isSpecialInstructionsOpen ? "−" : "+"}</span>
                            </button>
                            {isSpecialInstructionsOpen && (
                                <div className="px-4 pb-4 border-t border-orange-100 pt-3">
                                    <Textarea
                                        value={specialInstructions}
                                        onChange={(e) => setSpecialInstructions(e.target.value)}
                                        placeholder="E.g., No peanuts, Extra sauce, Mild spice..."
                                        rows={2}
                                        className="resize-none text-sm"
                                    />
                                </div>
                            )}
                        </div>
                    )}

                    {/* Print Options */}
                    <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-4 space-y-3">
                        {/* Print toggles */}
                        <div className="flex gap-3">
                            <label className="flex items-center gap-2 cursor-pointer flex-1 p-2 rounded-xl border border-gray-200 hover:bg-gray-50 transition-colors">
                                <input
                                    type="checkbox"
                                    checked={printReceiptEnabled}
                                    onChange={(e) => setPrintReceiptEnabled(e.target.checked)}
                                    className="w-4 h-4 accent-purple-600 rounded"
                                />
                                <div className="flex items-center gap-1.5 min-w-0">
                                    <Printer className="w-3.5 h-3.5 text-gray-500 shrink-0" />
                                    <span className="text-xs font-medium text-gray-700 truncate">Print Receipt</span>
                                </div>
                            </label>
                            <label className="flex items-center gap-2 cursor-pointer flex-1 p-2 rounded-xl border border-gray-200 hover:bg-gray-50 transition-colors">
                                <input
                                    type="checkbox"
                                    checked={printTokenEnabled}
                                    onChange={(e) => setPrintTokenEnabled(e.target.checked)}
                                    className="w-4 h-4 accent-orange-500 rounded"
                                />
                                <div className="flex items-center gap-1.5 min-w-0">
                                    <Printer className="w-3.5 h-3.5 text-gray-500 shrink-0" />
                                    <span className="text-xs font-medium text-gray-700 truncate">Print Token</span>
                                </div>
                            </label>
                        </div>
                    </div>

                    {/* Pricing summary + discount + tax */}
                    <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">

                        {/* Discount & Tax (collapsible) */}
                        <button
                            onClick={() => setIsDiscountOpen(o => !o)}
                            className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors"
                        >
                            <div className="flex items-center gap-2">
                                <span className="text-sm font-semibold text-gray-900">Discount & Tax</span>
                                {(cartDiscountValue > 0 || taxRate > 0) && (
                                    <span className="text-xs text-purple-700 bg-purple-50 px-2 py-0.5 rounded-full font-medium">
                                        {cartDiscountValue > 0 && `−${cartDiscountType === 'percent' ? cartDiscountValue + '%' : '₹' + cartDiscountValue}`}
                                        {cartDiscountValue > 0 && taxRate > 0 && ' · '}
                                        {taxRate > 0 && `GST ${taxRate}%`}
                                    </span>
                                )}
                            </div>
                            <span className="text-gray-400 text-lg leading-none">{isDiscountOpen ? "−" : "+"}</span>
                        </button>

                        {isDiscountOpen && (
                            <div className="px-4 pb-4 border-t border-gray-100 pt-3">
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="block text-xs font-medium text-gray-600 mb-1">Cart Discount</label>
                                        <div className="flex gap-1">
                                            <div className="flex rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                                                <button
                                                    onClick={() => setCartDiscountType('flat')}
                                                    className={`px-2.5 py-1.5 text-xs font-semibold transition-colors ${cartDiscountType === 'flat' ? 'bg-purple-100 text-purple-700' : 'bg-white text-gray-500 hover:bg-gray-50'}`}
                                                >₹</button>
                                                <button
                                                    onClick={() => setCartDiscountType('percent')}
                                                    className={`px-2.5 py-1.5 text-xs font-semibold border-l border-gray-200 transition-colors ${cartDiscountType === 'percent' ? 'bg-purple-100 text-purple-700' : 'bg-white text-gray-500 hover:bg-gray-50'}`}
                                                >%</button>
                                            </div>
                                            <Input
                                                type="number"
                                                min="0"
                                                className="flex-1 min-w-0"
                                                value={cartDiscountValue || ''}
                                                onChange={(e) => setCartDiscountValue(parseFloat(e.target.value) || 0)}
                                                placeholder={cartDiscountType === 'percent' ? "%" : "Amt"}
                                            />
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-gray-600 mb-1">Tax</label>
                                        <select
                                            className="w-full border border-gray-200 rounded-lg py-2 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400"
                                            value={taxRate}
                                            onChange={(e) => setTaxRate(parseFloat(e.target.value))}
                                        >
                                            <option value="0">No Tax</option>
                                            <option value="5">GST 5%</option>
                                            <option value="12">GST 12%</option>
                                            <option value="18">GST 18%</option>
                                            <option value="28">GST 28%</option>
                                        </select>
                                    </div>
                                </div>
                            </div>
                        )}

                        <div className="px-4 pb-4 pt-3 border-t border-gray-100 space-y-2">
                            <div className="flex justify-between text-sm">
                                <span className="text-gray-500">Subtotal</span>
                                <span className="font-medium text-gray-900">₹{subtotal.toFixed(2)}</span>
                            </div>
                            {totalDiscount > 0 && (
                                <div className="flex justify-between text-sm text-emerald-600">
                                    <span>Discount</span>
                                    <span className="font-medium">−₹{totalDiscount.toFixed(2)}</span>
                                </div>
                            )}
                            {taxAmount > 0 && (
                                <div className="flex justify-between text-sm">
                                    <span className="text-gray-500">Tax ({taxRate}%)</span>
                                    <span className="font-medium text-gray-900">+₹{taxAmount.toFixed(2)}</span>
                                </div>
                            )}
                            {customerPointsBalance > 0 && (
                                <div className="pt-2 border-t border-gray-100">
                                    <div className="flex items-center justify-between mb-2">
                                        <label htmlFor="pointsUsed" className="flex items-center gap-1.5 text-sm text-indigo-700 font-medium">
                                            <Star className="w-4 h-4 fill-indigo-500 text-indigo-500" />
                                            Use Points
                                        </label>
                                        <span className="text-xs text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full">
                                            {customerPointsBalance} pts
                                        </span>
                                    </div>
                                    <div className="flex gap-2 items-center">
                                        <Input
                                            id="pointsUsed"
                                            type="number"
                                            min="0"
                                            max={maxPointsUsable}
                                            value={pointsToUse}
                                            onChange={(e) => setPointsToUse(Math.min(parseInt(e.target.value) || 0, maxPointsUsable))}
                                            className="w-24 border-indigo-200"
                                        />
                                        <span className="text-sm text-gray-500">= −₹{actualPointsUsed.toFixed(2)}</span>
                                        <Button variant="secondary" size="sm" className="ml-auto text-xs bg-indigo-100 text-indigo-700 hover:bg-indigo-200" onClick={() => setPointsToUse(maxPointsUsable)}>
                                            Max
                                        </Button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Payment Method */}
                    <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-4 space-y-3">
                        <h3 className="text-sm font-semibold text-gray-900">Payment Method</h3>
                        <div className="grid grid-cols-3 gap-2">
                            <button
                                onClick={() => setPaymentMethod('cash')}
                                className={`flex flex-col items-center justify-center py-3 px-2 rounded-xl border-2 transition-colors ${paymentMethod === 'cash' ? 'border-emerald-500 bg-emerald-50 text-emerald-700' : 'border-gray-200 bg-white text-gray-500 hover:bg-gray-50'}`}
                            >
                                <Banknote className="w-5 h-5 mb-1" />
                                <span className="text-xs font-semibold">Cash</span>
                            </button>
                            <button
                                onClick={() => setPaymentMethod('upi')}
                                className={`flex flex-col items-center justify-center py-3 px-2 rounded-xl border-2 transition-colors ${paymentMethod === 'upi' ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-200 bg-white text-gray-500 hover:bg-gray-50'}`}
                            >
                                <Smartphone className="w-5 h-5 mb-1" />
                                <span className="text-xs font-semibold">UPI</span>
                            </button>
                            <button
                                onClick={() => setPaymentMethod('card')}
                                className={`flex flex-col items-center justify-center py-3 px-2 rounded-xl border-2 transition-colors ${paymentMethod === 'card' ? 'border-purple-500 bg-purple-50 text-purple-700' : 'border-gray-200 bg-white text-gray-500 hover:bg-gray-50'}`}
                            >
                                <CreditCard className="w-5 h-5 mb-1" />
                                <span className="text-xs font-semibold">Card</span>
                            </button>
                        </div>
                    </div>

                    {/* Grand Total + Charge button */}
                    <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-4 space-y-4">
                        <div className="flex justify-between items-end">
                            <div>
                                <p className="text-xs text-gray-500 mb-0.5">Grand Total</p>
                                <p className="text-3xl font-bold text-gray-900">₹{grandTotal.toFixed(2)}</p>
                                <p className="text-xs text-gray-400 mt-0.5">Earns {Math.floor(grandTotal / 100)} Points</p>
                            </div>
                            {totalDiscount > 0 && (
                                <div className="text-right">
                                    <p className="text-xs text-gray-400 line-through">₹{(grandTotal + totalDiscount).toFixed(2)}</p>
                                    <p className="text-xs text-emerald-600 font-medium">Saved ₹{totalDiscount.toFixed(2)}</p>
                                </div>
                            )}
                        </div>

                        <button
                            onClick={handleCompleteSale}
                            className="w-full py-4 rounded-xl text-white font-bold text-lg flex items-center justify-center gap-2 transition-opacity hover:opacity-90 active:opacity-80"
                            style={{ background: "linear-gradient(135deg, #7c3aed, #a855f7)" }}
                        >
                            <IndianRupee className="w-5 h-5" />
                            Charge ₹{grandTotal.toFixed(2)}
                            <span className="text-xs text-purple-200 font-normal ml-1">(F4)</span>
                        </button>

                        <div className="flex justify-center gap-4 text-xs text-gray-400 pt-1">
                            <span><kbd className="bg-gray-100 px-1.5 py-0.5 rounded border border-gray-200 text-gray-500">F2</kbd> Search</span>
                            <span><kbd className="bg-gray-100 px-1.5 py-0.5 rounded border border-gray-200 text-gray-500">F4</kbd> Charge</span>
                            <span><kbd className="bg-gray-100 px-1.5 py-0.5 rounded border border-gray-200 text-gray-500">Ctrl+H</kbd> Hold</span>
                        </div>
                    </div>
                </div>
            </div>
            {/* Order confirmation modal — mobile only, restaurant only */}
            {orderConfirmModal && activeBusinessAccount?.business_type === "restaurant" && (
                <div className="lg:hidden fixed inset-0 z-50 flex items-end justify-center p-4 bg-black/40">
                    <style>{`@keyframes orderBarShrink { from { width: 100% } to { width: 0% } }`}</style>
                    <div className="w-full max-w-sm bg-white rounded-2xl shadow-2xl overflow-hidden">
                        {/* Header */}
                        <div className="bg-emerald-500 px-4 py-3 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <CheckCircle className="w-5 h-5 text-white" />
                                <span className="text-white font-bold text-base">Order Confirmed!</span>
                            </div>
                            <button
                                onClick={() => setOrderConfirmModal(null)}
                                className="text-white/70 hover:text-white transition-colors"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Token number */}
                        <div className="text-center py-4 border-b border-gray-100">
                            <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Token Number</p>
                            <p className="text-6xl font-black text-purple-600">#{orderConfirmModal.tokenNumber}</p>
                            <p className="text-sm text-gray-500 mt-1">{orderConfirmModal.customerName}</p>
                        </div>

                        {/* Items */}
                        <div className="px-4 py-3 space-y-1.5 max-h-36 overflow-y-auto">
                            {orderConfirmModal.items.map((item, i) => (
                                <div key={i} className="flex justify-between text-sm">
                                    <span className="text-gray-700">
                                        {item.name}
                                        <span className="text-gray-400 ml-1">×{item.quantity}</span>
                                    </span>
                                    <span className="font-medium text-gray-900">₹{(item.price * item.quantity).toFixed(2)}</span>
                                </div>
                            ))}
                        </div>

                        {/* Total */}
                        <div className="px-4 py-3 bg-gray-50 border-t border-gray-100 flex justify-between items-center">
                            <span className="font-semibold text-gray-600">Total</span>
                            <span className="font-bold text-gray-900 text-lg">₹{orderConfirmModal.total.toFixed(2)}</span>
                        </div>

                        {/* Auto-dismiss progress bar */}
                        <div
                            className="h-1 bg-emerald-500"
                            style={{ animation: 'orderBarShrink 2.5s linear forwards' }}
                        />
                    </div>
                </div>
            )}
        </PageContainer>
    );
}
