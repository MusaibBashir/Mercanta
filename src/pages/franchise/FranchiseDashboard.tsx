import { useMemo } from "react";
import { Link } from "react-router-dom";
import { useAuth, Franchise } from "../../context/AuthContext";
import { useInventory } from "../../context/InventoryContext";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { HamburgerMenu } from "../../components/HamburgerMenu";
import {
    AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
    Tooltip, ResponsiveContainer, Legend, Cell
} from "recharts";
import {
    Store, TrendingUp, Package, IndianRupee, ShoppingCart,
    Users, AlertCircle, LogOut, MapPin, Truck, BarChart3, Settings
} from "lucide-react";
import { toast } from "sonner";
import { useDashboardSettings } from "../../hooks/useDashboardSettings";
import {
    DropdownMenu, DropdownMenuContent, DropdownMenuLabel,
    DropdownMenuSeparator, DropdownMenuCheckboxItem, DropdownMenuTrigger
} from "../../components/ui/dropdown-menu";

// ── Helpers ──────────────────────────────────────────────────────────────────
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const CHART_COLORS = {
    revenue: "#10b981",    // emerald for franchise
    revenueFill: "#10b98114",
    sales: "#f97316",      // orange
    bar1: "#10b981",
    bar2: "#3b82f6",
    bar3: "#f97316",
    bar4: "#8b5cf6",
    bar5: "#ec4899",
};

function fmt(n: number) {
    if (n >= 1_00_000) return `₹${(n / 1_00_000).toFixed(1)}L`;
    if (n >= 1_000) return `₹${(n / 1_000).toFixed(1)}K`;
    return `₹${n.toFixed(0)}`;
}

const tooltipStyle = {
    backgroundColor: "white",
    border: "1px solid #e5e7eb",
    borderRadius: "10px",
    boxShadow: "0 4px 20px rgba(0,0,0,0.08)",
    padding: "10px 14px",
    fontSize: 12,
    color: "#1f2937", // Explicitly setting color to fix white text issue
};

// ── Component ─────────────────────────────────────────────────────────────────
export function FranchiseDashboard() {
    const { profile, franchise, signOut } = useAuth();
    const { salesHistory, inventory, getLowStockItems } = useInventory();

    const { settings, toggleSetting } = useDashboardSettings('franchise', {
        showActionStrip: true,
        showKpis: true,
        showStorePerformance: true,
        showBestsellers: true,
        showRecentTransactions: true,
    });

    // ── Data Prep ──
    const myInventory = useMemo(() =>
        inventory.filter((item: any) => item.franchiseId && item.franchiseId === franchise?.id),
        [inventory, franchise?.id]
    );

    const analytics = useMemo(() => {
        // Own sales only
        const mySales = salesHistory.filter((s: any) => s.franchiseId === franchise?.id);

        const totalRevenue = mySales.reduce((sum: number, s: any) => sum + s.total, 0);
        const totalSales = mySales.length;
        const totalItems = myInventory.length;
        const totalStock = myInventory.reduce((sum: number, i: any) => sum + i.quantity, 0);
        const lowStockItems = getLowStockItems(20).filter((i: any) => i.franchiseId === franchise?.id);
        const inventoryValue = myInventory.reduce((sum: number, i: any) => sum + (i.price * i.quantity), 0);

        // Monthly trend (last 12 months)
        const now = new Date();
        const monthBuckets: Record<string, { label: string; revenue: number; sales: number }> = {};
        for (let i = 11; i >= 0; i--) {
            const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
            const key = `${d.getFullYear()}-${d.getMonth()}`;
            monthBuckets[key] = { label: MONTHS[d.getMonth()], revenue: 0, sales: 0 };
        }
        mySales.forEach((sale: any) => {
            const d = new Date(sale.date);
            const key = `${d.getFullYear()}-${d.getMonth()}`;
            if (monthBuckets[key]) {
                monthBuckets[key].revenue += sale.total;
                monthBuckets[key].sales += 1;
            }
        });
        const monthlyTrend = Object.values(monthBuckets);

        // Top 5 products by revenue
        const productSales: Record<string, { name: string; qty: number; revenue: number }> = {};
        mySales.forEach((sale: any) => {
            (sale.items || []).forEach((item: any) => {
                if (!productSales[item.sku]) productSales[item.sku] = { name: item.itemName, qty: 0, revenue: 0 };
                productSales[item.sku].qty += item.quantity;
                productSales[item.sku].revenue += item.quantity * item.price;
            });
        });
        const topProducts = Object.entries(productSales)
            .map(([sku, d]) => ({ sku, ...d }))
            .sort((a, b) => b.revenue - a.revenue)
            .slice(0, 6);

        // Recent sales
        const recentSales = mySales.slice(0, 8); // Top 8 most recent

        // Today's stats
        const today = new Date().toISOString().split("T")[0];
        const todaySales = mySales.filter((s: any) => s.date?.startsWith(today));
        const todayRevenue = todaySales.reduce((sum: number, s: any) => sum + s.total, 0);

        // MoM growth
        const lastTwo = monthlyTrend.slice(-2);
        const momGrowth = lastTwo.length === 2 && lastTwo[0].revenue > 0
            ? ((lastTwo[1].revenue - lastTwo[0].revenue) / lastTwo[0].revenue) * 100
            : 0;

        return {
            totalRevenue, totalSales, totalItems, totalStock, lowStockItems,
            inventoryValue, topProducts, recentSales, todaySales, todayRevenue,
            monthlyTrend, momGrowth
        };
    }, [salesHistory, myInventory, getLowStockItems, franchise?.id]);

    const handleSignOut = async () => {
        await signOut();
        toast.success("Signed out");
    };

    return (
        <div className="min-h-screen page-bg font-inter pb-12">
            <div className="w-full max-w-[1500px] mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 page-enter">

                {/* ── Header ── */}
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <HamburgerMenu />
                        <div>
                            <h1 className="flex items-center gap-3">
                                <img src="/logo-transparent.png" className="h-16 w-auto object-contain" alt="Mercanta Logo" />
                                <span className="text-gray-300 font-light hidden sm:inline ml-2">|</span>
                                <span className="text-2xl hidden sm:inline ml-2 font-semibold">{franchise?.name || "My Franchise"}</span>
                            </h1>
                            <p className="text-sm text-gray-500 mt-1 font-medium flex items-center gap-1.5">
                                <MapPin className="w-3.5 h-3.5" />
                                {franchise?.region}, {franchise?.state} · Logged in as {profile?.full_name}
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <Link to="/sales">
                            <Button className="gap-2 text-sm shadow-md" style={{ background: "linear-gradient(135deg, #7c3aed, #a855f7)" }}>
                                <ShoppingCart className="w-4 h-4" /> New Sale
                            </Button>
                        </Link>

                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="outline" size="icon" className="border-gray-300">
                                    <Settings className="w-4 h-4 text-gray-600" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-56">
                                <DropdownMenuLabel>Dashboard Widgets</DropdownMenuLabel>
                                <DropdownMenuSeparator />
                                <DropdownMenuCheckboxItem checked={settings.showActionStrip} onCheckedChange={() => toggleSetting('showActionStrip')}>
                                    Quick Actions
                                </DropdownMenuCheckboxItem>
                                <DropdownMenuCheckboxItem checked={settings.showKpis} onCheckedChange={() => toggleSetting('showKpis')}>
                                    Core KPIs
                                </DropdownMenuCheckboxItem>
                                <DropdownMenuCheckboxItem checked={settings.showStorePerformance} onCheckedChange={() => toggleSetting('showStorePerformance')}>
                                    Store Performance
                                </DropdownMenuCheckboxItem>
                                <DropdownMenuCheckboxItem checked={settings.showBestsellers} onCheckedChange={() => toggleSetting('showBestsellers')}>
                                    Bestsellers
                                </DropdownMenuCheckboxItem>
                                <DropdownMenuCheckboxItem checked={settings.showRecentTransactions} onCheckedChange={() => toggleSetting('showRecentTransactions')}>
                                    Recent Transactions
                                </DropdownMenuCheckboxItem>
                            </DropdownMenuContent>
                        </DropdownMenu>

                        <Button variant="ghost" onClick={handleSignOut} className="gap-2 text-gray-600 text-sm">
                            <LogOut className="w-4 h-4" /> Sign Out
                        </Button>
                    </div>
                </div>

                {/* ── Action Strip ── */}
                {settings.showActionStrip && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {[
                        { to: "/sales",      icon: ShoppingCart, label: "Point of Sale",    sub: "Ring up customers",           color: "bg-emerald-50 text-emerald-600", ring: "hover:ring-2 hover:ring-emerald-200" },
                        { to: "/inventory",  icon: Package,      label: "Local Inventory",  sub: `${analytics.totalItems} items in stock`, color: "bg-blue-50 text-blue-600",    ring: "hover:ring-2 hover:ring-blue-200" },
                        { to: "/order-stock",icon: Truck,        label: "Order Stock",      sub: "Request from admin",          color: "bg-indigo-50 text-indigo-600",  ring: "hover:ring-2 hover:ring-indigo-200" },
                        { to: "/customers",  icon: Users,        label: "Customers",        sub: "View directory",              color: "bg-amber-50 text-amber-600",    ring: "hover:ring-2 hover:ring-amber-200" },
                    ].map((link) => (
                        <Link key={link.to} to={link.to}>
                            <Card className={`border border-gray-200 bg-white card-lift cursor-pointer ${link.ring}`}>
                                <CardContent className="p-4 flex items-center gap-4">
                                    <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${link.color}`}>
                                        <link.icon className="w-5 h-5" />
                                    </div>
                                    <div>
                                        <p className="text-sm font-semibold text-gray-900">{link.label}</p>
                                        <p className="text-[11px] text-gray-500 mt-0.5">{link.sub}</p>
                                    </div>
                                </CardContent>
                            </Card>
                        </Link>
                    ))}
                </div>
                )}

                {/* ── KPI Strip ── */}
                {settings.showKpis && (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                    <Card className="border-none shadow-lg text-white" style={{ background: "linear-gradient(135deg, #7c3aed 0%, #a855f7 100%)" }}>
                        <CardContent className="p-5">
                            <div className="flex items-start justify-between">
                                <div>
                                    <p className="text-xs font-semibold text-purple-200 uppercase tracking-wider">Today's Revenue</p>
                                    <p className="text-3xl font-bold mt-1">₹{analytics.todayRevenue.toFixed(0)}</p>
                                    <p className="text-sm mt-1.5 font-medium text-purple-200">{analytics.todaySales.length} sales today</p>
                                </div>
                                <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-white/20">
                                    <TrendingUp className="w-4 h-4 text-white" />
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                    {[
                        { label: "Total Revenue", value: fmt(analytics.totalRevenue), sub: `${analytics.momGrowth >= 0 ? "+" : ""}${analytics.momGrowth.toFixed(1)}% MoM`, icon: IndianRupee, accent: "bg-emerald-50 text-emerald-600", positive: analytics.momGrowth >= 0 },
                        { label: "Total Sales", value: analytics.totalSales.toLocaleString(), sub: "all time", icon: ShoppingCart, accent: "bg-blue-50 text-blue-600", positive: true },
                        { label: "Total Stock Units", value: analytics.totalStock.toLocaleString(), sub: `Value: ${fmt(analytics.inventoryValue)}`, icon: Package, accent: "bg-orange-50 text-orange-600", positive: true },
                        { label: "Low Stock Items", value: analytics.lowStockItems.length, sub: "≤20 units remaining", icon: AlertCircle, accent: "bg-red-50 text-red-600", positive: analytics.lowStockItems.length === 0 },
                    ].map(kpi => (
                        <Card key={kpi.label} className={`bg-white border shadow-sm ${!kpi.positive && kpi.label === 'Low Stock Items' ? 'border-red-200' : 'border-gray-200'}`}>
                            <CardContent className="p-5">
                                <div className="flex items-start justify-between">
                                    <div>
                                        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{kpi.label}</p>
                                        <p className="text-3xl font-bold text-gray-900 mt-1">{kpi.value}</p>
                                        <p className={`text-sm mt-1.5 font-medium ${kpi.positive ? "text-gray-500" : "text-red-500"}`}>{kpi.sub}</p>
                                    </div>
                                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${kpi.accent}`}>
                                        <kpi.icon className="w-4 h-4" />
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
                )}

                {/* ── Row 3: Revenue Trend + Top Products ── */}
                {(settings.showStorePerformance || settings.showBestsellers) && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Revenue Trend – spans 2/3 */}
                    {settings.showStorePerformance && (
                    <Card className={`bg-white border border-gray-200 shadow-sm ${settings.showBestsellers ? 'lg:col-span-2' : 'lg:col-span-3'}`}>
                        <CardHeader className="pb-2">
                            <div className="flex items-start justify-between">
                                <div>
                                    <CardTitle className="text-base font-semibold text-gray-900">Store Performance</CardTitle>
                                    <p className="text-xs text-gray-400 mt-0.5">Revenue & Sales over last 12 months</p>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent className="pt-2 pb-4 px-4">
                            {analytics.monthlyTrend.some(m => m.revenue > 0) ? (
                                <ResponsiveContainer width="100%" height={260}>
                                    <AreaChart data={analytics.monthlyTrend} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                                        <defs>
                                            <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor={CHART_COLORS.revenue} stopOpacity={0.18} />
                                                <stop offset="95%" stopColor={CHART_COLORS.revenue} stopOpacity={0} />
                                            </linearGradient>
                                            <linearGradient id="salesGrad" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor={CHART_COLORS.sales} stopOpacity={0.15} />
                                                <stop offset="95%" stopColor={CHART_COLORS.sales} stopOpacity={0} />
                                            </linearGradient>
                                        </defs>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                                        <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
                                        <YAxis tickFormatter={v => fmt(v)} tick={{ fontSize: 11, fill: "#9ca3af" }} axisLine={false} tickLine={false} width={50} />
                                        <Tooltip contentStyle={tooltipStyle} formatter={(v: number, name: string) => [name === "revenue" ? fmt(v) : v, name === "revenue" ? "Revenue" : "Sales"]} />
                                        <Legend formatter={v => v === "revenue" ? "Revenue" : "Sales"} iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
                                        <Area type="monotone" dataKey="revenue" stroke={CHART_COLORS.revenue} strokeWidth={2.5} fill="url(#revGrad)" dot={false} activeDot={{ r: 5, strokeWidth: 0 }} />
                                        <Area type="monotone" dataKey="sales" stroke={CHART_COLORS.sales} strokeWidth={2} fill="url(#salesGrad)" dot={false} activeDot={{ r: 4, strokeWidth: 0 }} />
                                    </AreaChart>
                                </ResponsiveContainer>
                            ) : (
                                <div className="h-[260px] flex items-center justify-center text-sm text-gray-400">No sales data yet</div>
                            )}
                        </CardContent>
                    </Card>
                    )}

                    {/* Top Products by Revenue – spans 1/3 */}
                    {settings.showBestsellers && (
                    <Card className={`bg-white border border-gray-200 shadow-sm ${settings.showStorePerformance ? '' : 'lg:col-span-3'}`}>
                        <CardHeader className="pb-2">
                            <div>
                                <CardTitle className="text-base font-semibold text-gray-900">Bestsellers</CardTitle>
                                <p className="text-xs text-gray-400 mt-0.5">Your top products by revenue</p>
                            </div>
                        </CardHeader>
                        <CardContent className="pt-0 px-4 pb-4">
                            {analytics.topProducts.length === 0 ? (
                                <div className="h-[260px] flex items-center justify-center text-sm text-gray-400">No sales data yet</div>
                            ) : (
                                <div className="space-y-4 mt-3">
                                    {analytics.topProducts.map((p: any, i: number) => {
                                        const pct = analytics.topProducts[0].revenue > 0
                                            ? (p.revenue / analytics.topProducts[0].revenue) * 100 : 0;
                                        const colors = [CHART_COLORS.bar1, CHART_COLORS.bar2, CHART_COLORS.bar3, CHART_COLORS.bar4, CHART_COLORS.bar5, "#a855f7"];
                                        return (
                                            <div key={p.sku}>
                                                <div className="flex items-center justify-between mb-1.5">
                                                    <span className="text-sm font-medium text-gray-800 truncate max-w-[150px]" title={p.name}>{p.name}</span>
                                                    <span className="text-sm font-bold text-gray-900 ml-2">{fmt(p.revenue)}</span>
                                                </div>
                                                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                                                    <div
                                                        className="h-full rounded-full transition-all duration-500"
                                                        style={{ width: `${pct}%`, backgroundColor: colors[i] }}
                                                    />
                                                </div>
                                                <p className="text-[11px] text-gray-400 mt-1">{p.qty} units sold</p>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                    )}
                </div>
                )}

                {/* ── Row 4: Recent Sales List ── */}
                {settings.showRecentTransactions && (
                <Card className="bg-white border border-gray-200 shadow-sm">
                    <CardHeader className="pb-2">
                        <div className="flex items-start justify-between">
                            <div>
                                <CardTitle className="text-base font-semibold text-gray-900">Recent Transactions</CardTitle>
                                <p className="text-xs text-gray-400 mt-0.5">Your store's latest sales activity</p>
                            </div>
                            <Link to="/sales-history">
                                <Button variant="ghost" size="sm" className="text-xs gap-1 text-emerald-600 hover:text-emerald-700 -mt-1">
                                    View full history
                                </Button>
                            </Link>
                        </div>
                    </CardHeader>
                    <CardContent className="p-0">
                        {analytics.recentSales.length === 0 ? (
                            <div className="h-[200px] flex flex-col items-center justify-center gap-3 text-sm text-gray-400">
                                <ShoppingCart className="w-10 h-10 text-gray-200" />
                                <p>No sales yet</p>
                                <Link to="/sales">
                                    <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 gap-1"><ShoppingCart className="w-4 h-4" /> Make Front Desk Sale</Button>
                                </Link>
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full">
                                    <thead>
                                        <tr className="border-b border-gray-100 bg-gray-50/60">
                                            <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500">Date & Time</th>
                                            <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500">Customer</th>
                                            <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500">Items</th>
                                            <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500">Payment</th>
                                            <th className="px-5 py-3 text-right text-xs font-semibold text-gray-500">Amount</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {analytics.recentSales.map((sale: any) => (
                                            <tr key={sale.id} className="border-b border-gray-50 hover:bg-gray-50/60 transition-colors">
                                                <td className="px-5 py-3 text-sm text-gray-500">
                                                    {new Date(sale.date).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}
                                                </td>
                                                <td className="px-5 py-3">
                                                    <p className="text-sm font-medium text-gray-900">{sale.customerName}</p>
                                                    {sale.customerPhone && <p className="text-xs text-gray-400">{sale.customerPhone}</p>}
                                                </td>
                                                <td className="px-5 py-3 text-sm text-gray-600">
                                                    {sale.items?.length || 0} unique items
                                                </td>
                                                <td className="px-5 py-3">
                                                    <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-gray-100 text-gray-700 uppercase">
                                                        {sale.paymentMethod || 'CASH'}
                                                    </span>
                                                </td>
                                                <td className="px-5 py-3 text-sm font-bold text-gray-900 text-right">
                                                    ₹{sale.total.toFixed(2)}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </CardContent>
                </Card>
                )}

            </div>
        </div>
    );
}
