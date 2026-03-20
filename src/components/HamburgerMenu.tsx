import { useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { Menu, Plus, Package, TrendingUp, IndianRupee, Store, BarChart3, Users, History, LogOut, Home, FileText, ClipboardList, ShoppingCart, Monitor, Clock, Settings, UtensilsCrossed } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetTrigger,
} from "./ui/sheet";
import { Button } from "./ui/button";
import { useAuth } from "../context/AuthContext";
import { AccountSwitcher } from "./AccountSwitcher";

const ROLE_CONFIG = {
  admin:      { label: "Admin",      bg: "bg-violet-100",  text: "text-violet-700",  dot: "bg-violet-500"  },
  restaurant: { label: "Restaurant", bg: "bg-orange-100",  text: "text-orange-700",  dot: "bg-orange-500"  },
  franchise:  { label: "Franchise",  bg: "bg-sky-100",     text: "text-sky-700",     dot: "bg-sky-500"     },
};

// Icon accent colours per nav item
const ITEM_ACCENT: Record<string, string> = {
  "/admin":                "text-violet-600 bg-violet-50",
  "/admin/franchises":     "text-indigo-600 bg-indigo-50",
  "/admin/reports":        "text-emerald-600 bg-emerald-50",
  "/analytics":            "text-blue-600 bg-blue-50",
  "/add-items":            "text-sky-600 bg-sky-50",
  "/admin/inventory":      "text-teal-600 bg-teal-50",
  "/admin/stock-orders":   "text-cyan-600 bg-cyan-50",
  "/customers":            "text-amber-600 bg-amber-50",
  "/forecast":             "text-rose-600 bg-rose-50",
  "/dashboard":            "text-violet-600 bg-violet-50",
  "/sales":                "text-emerald-600 bg-emerald-50",
  "/inventory":            "text-blue-600 bg-blue-50",
  "/order-stock":          "text-indigo-600 bg-indigo-50",
  "/sales-history":        "text-gray-600 bg-gray-100",
  "/menu":                 "text-orange-600 bg-orange-50",
  "/kitchen":              "text-red-600 bg-red-50",
  "/tokens":               "text-teal-600 bg-teal-50",
  "/settings/restaurant":  "text-gray-600 bg-gray-100",
};

export function HamburgerMenu() {
  const [open, setOpen] = useState(false);
  const { profile, signOut, activeBusinessAccount } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const isAdmin = profile?.role === "admin";
  const isRestaurant = activeBusinessAccount?.business_type === "restaurant";

  const adminItems = [
    { label: "Admin Dashboard",   icon: Home,          to: "/admin" },
    { label: "Manage Franchises", icon: Store,         to: "/admin/franchises" },
    { label: "Financial Reports", icon: FileText,      to: "/admin/reports" },
    { label: "Analytics",         icon: BarChart3,     to: "/analytics" },
    { label: "Add Items",         icon: Plus,          to: "/add-items" },
    { label: "Inventory Details", icon: Package,       to: "/admin/inventory" },
    { label: "Stock Orders",      icon: ClipboardList, to: "/admin/stock-orders" },
    { label: "Customers",         icon: Users,         to: "/customers" },
    { label: "Forecast",          icon: TrendingUp,    to: "/forecast" },
  ];

  const franchiseItems = [
    { label: "Dashboard",         icon: Home,          to: "/dashboard" },
    { label: "Sales",             icon: IndianRupee,   to: "/sales" },
    { label: "Inventory Details", icon: Package,       to: "/inventory" },
    { label: "Order Stock",       icon: ShoppingCart,  to: "/order-stock" },
    { label: "Sales History",     icon: History,       to: "/sales-history" },
    { label: "Customers",         icon: Users,         to: "/customers" },
    { label: "Forecast",          icon: TrendingUp,    to: "/forecast" },
  ];

  const restaurantItems = [
    { label: "Dashboard",         icon: Home,            to: "/dashboard" },
    { label: "Orders",            icon: IndianRupee,     to: "/sales" },
    { label: "Menu",              icon: UtensilsCrossed, to: "/menu" },
    { label: "Kitchen Display",   icon: Monitor,         to: "/kitchen" },
    { label: "Order Tracking",    icon: Clock,           to: "/tokens" },
    { label: "Sales History",     icon: History,         to: "/sales-history" },
    { label: "Customers",         icon: Users,           to: "/customers" },
    { label: "Settings",          icon: Settings,        to: "/settings/restaurant" },
  ];

  const menuItems = isAdmin ? adminItems : isRestaurant ? restaurantItems : franchiseItems;
  const roleKey = isAdmin ? "admin" : isRestaurant ? "restaurant" : "franchise";
  const role = ROLE_CONFIG[roleKey];

  const handleSignOut = async () => {
    setOpen(false);
    await signOut();
    navigate("/login");
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="hover:bg-purple-50 hover:text-purple-700 transition-colors rounded-xl"
          aria-label="Open menu"
        >
          <Menu className="w-5 h-5" />
        </Button>
      </SheetTrigger>

      <SheetContent side="left" className="w-72 p-0 bg-white border-r border-gray-100 flex flex-col">
        <SheetHeader className="sr-only">
          <SheetTitle>Navigation</SheetTitle>
          <SheetDescription>Main navigation menu</SheetDescription>
        </SheetHeader>

        {/* Logo area */}
        <div className="px-6 pt-6 pb-4 border-b border-gray-100">
          <img src="/logo-transparent.png" alt="Mercanta Logo" className="h-10 w-auto object-contain" />
        </div>

        {/* Account switcher + role badge */}
        <div className="px-4 pt-4 pb-3 space-y-3">
          <AccountSwitcher onAccountSwitch={() => setOpen(false)} />
          <div className="flex items-center gap-2">
            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${role.bg} ${role.text}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${role.dot}`} />
              {role.label}
            </span>
            <span className="text-xs text-gray-400 truncate">{profile?.full_name}</span>
          </div>
        </div>

        {/* Navigation items */}
        <nav className="flex-1 overflow-y-auto px-3 pb-3 space-y-0.5">
          <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest px-3 py-2">Navigation</p>
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.to;
            const accent = ITEM_ACCENT[item.to] || "text-gray-600 bg-gray-100";
            return (
              <Link
                key={item.to}
                to={item.to}
                onClick={() => setOpen(false)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 group ${
                  isActive
                    ? "bg-violet-50 text-violet-700"
                    : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                }`}
              >
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-colors ${
                  isActive ? "bg-violet-100 text-violet-600" : accent
                }`}>
                  <Icon className="w-4 h-4" />
                </div>
                <span>{item.label}</span>
                {isActive && (
                  <span className="ml-auto w-1.5 h-1.5 rounded-full bg-violet-500" />
                )}
              </Link>
            );
          })}
        </nav>

        {/* Sign Out */}
        <div className="px-3 pb-6 pt-2 border-t border-gray-100">
          <button
            onClick={handleSignOut}
            className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-gray-500 hover:bg-red-50 hover:text-red-600 transition-all w-full group"
          >
            <div className="w-8 h-8 bg-gray-100 group-hover:bg-red-100 rounded-lg flex items-center justify-center transition-colors">
              <LogOut className="w-4 h-4 group-hover:text-red-500 transition-colors" />
            </div>
            Sign Out
          </button>
        </div>
      </SheetContent>
    </Sheet>
  );
}