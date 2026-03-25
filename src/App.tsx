import { useState, useMemo } from "react";
import { HashRouter, Routes, Route, Link, Navigate, useOutletContext } from "react-router-dom";
import { DashboardFilters, FilterState } from "./components/DashboardFilters";
import { SalesTrendChart } from "./components/SalesTrendChart";
import { RevenueBreakdownChart } from "./components/RevenueBreakdownChart";
import { YoYGrowthChart } from "./components/YoYGrowthChart";
import { PerformanceMetricsChart } from "./components/PerformanceMetricsChart";
import { RegionSalesChart } from "./components/RegionSalesChart";
import { HamburgerMenu } from "./components/HamburgerMenu";
import { InventoryAlertsCard } from "./components/InventoryAlertsCard";
import { sampleData, categories, regions, DataPoint } from "./data/sampleData";
import { Card, CardContent } from "./components/ui/card";
import { BarChart3, TrendingUp, Users, IndianRupee, Filter, Shield, Store } from "lucide-react";
import { Toaster } from "./components/ui/sonner";
import { InventoryProvider } from "./context/InventoryContext";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { LoginPage } from "./pages/LoginPage";
import { BusinessSetupModal } from "./components/BusinessSetupModal";
import { KitchenDisplaySystem } from "./components/KitchenDisplaySystem";
import { TokenTracker } from "./components/TokenTracker";
import { RestaurantSettings } from "./components/RestaurantSettings";
import { RestaurantMenuPage } from "./pages/RestaurantMenuPage";
import { AdminDashboard } from "./pages/admin/AdminDashboard";
import { ManageFranchisesPage } from "./pages/admin/ManageFranchisesPage";
import { FranchiseDetailPage } from "./pages/admin/FranchiseDetailPage";
import { FinancialReportsPage } from "./pages/admin/FinancialReportsPage";
import { AdminInventoryPage } from "./pages/admin/AdminInventoryPage";
import { StockOrdersPage } from "./pages/admin/StockOrdersPage";
import { FranchiseDashboard } from "./pages/franchise/FranchiseDashboard";
import { OrderStockPage } from "./pages/franchise/OrderStockPage";
import {
  LandingPage,
  SalesPage,
  AddItemsPage,
  InventoryPage,
  ForecastPage,
  SalesHistoryPage,
  CustomersPage,
} from "./pages";

function RoleRedirect() {
  const { user, profile, isLoading, error, signOut, activeBusinessAccount, businessAccounts } = useAuth();
  const [showBusinessSetup, setShowBusinessSetup] = useState(false);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-gray-200 border-t-gray-900 rounded-full animate-spin" />
      </div>
    );
  }
  if (!user) return <Navigate to="/" replace />;

  // If profile failed to load or doesn't exist
  if (!profile) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center max-w-md p-8 bg-white rounded-xl shadow-sm border border-gray-200">
          <div className="w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-orange-600 text-xl font-bold">!</span>
          </div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">
            {error ? "Authentication Error" : "Profile Not Found"}
          </h2>
          <p className="text-sm text-gray-600 mb-4">
            {error || "Your user account exists but no profile was created. Please contact your administrator."}
          </p>
          <div className="text-xs text-gray-400 mb-4 space-y-1">
            <p>User ID: {user.id}</p>
            {error && <p className="font-mono bg-gray-100 p-1 rounded">{error}</p>}
          </div>
          <button
            onClick={() => { signOut(); }}
            className="px-4 py-2 bg-gray-900 text-white rounded-lg text-sm hover:bg-gray-800"
          >
            Back to Login
          </button>
        </div>
      </div>
    );
  }

  // Feature 1: If user has no business accounts, show setup modal
  if (!activeBusinessAccount || businessAccounts.length === 0) {
    return (
      <>
        <BusinessSetupModal
          isOpen={true}
          onComplete={() => {
            // Reload to show the new dashboard with business account context
            window.location.href = "/#/app";
          }}
        />
      </>
    );
  }

  if (profile.role === "admin") return <Navigate to="/admin" replace />;
  return <Navigate to="/dashboard" replace />;
}

export default function App() {
  return (
    <AuthProvider>
      <InventoryProvider>
        <HashRouter>
          <Routes>
            {/* Public landing */}
            <Route path="/" element={<LandingPage />} />

            {/* Auth */}
            <Route path="/login" element={<LoginPage />} />
            <Route path="/app" element={<RoleRedirect />} />

            {/* Admin routes */}
            <Route path="/admin" element={<ProtectedRoute requiredRole="admin"><AdminDashboard /></ProtectedRoute>} />
            <Route path="/admin/franchises" element={<ProtectedRoute requiredRole="admin"><ManageFranchisesPage /></ProtectedRoute>} />
            <Route path="/admin/franchise/:id" element={<ProtectedRoute requiredRole="admin"><FranchiseDetailPage /></ProtectedRoute>} />
            <Route path="/admin/reports" element={<ProtectedRoute requiredRole="admin"><FinancialReportsPage /></ProtectedRoute>} />
            <Route path="/admin/inventory" element={<ProtectedRoute requiredRole="admin"><AdminInventoryPage /></ProtectedRoute>} />
            <Route path="/admin/stock-orders" element={<ProtectedRoute requiredRole="admin"><StockOrdersPage /></ProtectedRoute>} />

            {/* Franchise dashboard */}
            <Route path="/dashboard" element={<ProtectedRoute requiredRole="franchise"><FranchiseDashboard /></ProtectedRoute>} />
            <Route path="/order-stock" element={<ProtectedRoute requiredRole="franchise"><OrderStockPage /></ProtectedRoute>} />

            {/* Role-specific shared pages */}
            <Route path="/sales" element={<ProtectedRoute requiredRole="franchise"><SalesPage /></ProtectedRoute>} />
            <Route path="/add-items" element={<ProtectedRoute requiredRole="admin"><AddItemsPage /></ProtectedRoute>} />

            {/* Restaurant routes */}
            <Route path="/kitchen" element={<ProtectedRoute><KitchenDisplaySystem /></ProtectedRoute>} />
            <Route path="/tokens" element={<ProtectedRoute><TokenTracker /></ProtectedRoute>} />
            <Route path="/menu" element={<ProtectedRoute><RestaurantMenuPage /></ProtectedRoute>} />
            <Route path="/settings/restaurant" element={<ProtectedRoute><RestaurantSettings /></ProtectedRoute>} />

            {/* Shared routes (both roles) */}
            <Route path="/inventory" element={<ProtectedRoute><InventoryPage /></ProtectedRoute>} />
            <Route path="/forecast" element={<ProtectedRoute><ForecastPage /></ProtectedRoute>} />
            <Route path="/sales-history" element={<ProtectedRoute><SalesHistoryPage /></ProtectedRoute>} />
            <Route path="/customers" element={<ProtectedRoute><CustomersPage /></ProtectedRoute>} />

            {/* Old dashboard kept for admin analytics view */}
            <Route path="/analytics" element={<ProtectedRoute requiredRole="admin"><Dashboard /></ProtectedRoute>} />

            {/* Catch-all: redirect unknown routes */}
            <Route path="*" element={<Navigate to="/app" replace />} />
          </Routes>
          <Toaster />
        </HashRouter>
      </InventoryProvider>
    </AuthProvider>
  );
}

function Dashboard() {
  const [viewMode, setViewMode] = useState<"admin" | "franchise">("admin");
  const [filters, setFilters] = useState<FilterState>({
    category: "all",
    region: "all",
    timePeriod: "all"
  });

  const [selectedCategory, setSelectedCategory] = useState<string>("");
  const [selectedRegion, setSelectedRegion] = useState<string>("");

  // Filter data based on current filters and selections
  const filteredData = useMemo(() => {
    return sampleData.filter((item: DataPoint) => {
      const categoryMatch = filters.category === "all" || item.category === filters.category;
      const regionMatch = filters.region === "all" || item.region === filters.region;

      let timePeriodMatch = true;
      if (filters.timePeriod !== "all") {
        if (filters.timePeriod === "2024" || filters.timePeriod === "2023") {
          timePeriodMatch = item.year === parseInt(filters.timePeriod);
        } else if (filters.timePeriod.startsWith("Q")) {
          timePeriodMatch = item.quarter === filters.timePeriod && item.year === 2024;
        }
      }

      const selectedCategoryMatch = !selectedCategory || item.category === selectedCategory;
      const selectedRegionMatch = !selectedRegion || item.region === selectedRegion;

      return categoryMatch && regionMatch && timePeriodMatch && selectedCategoryMatch && selectedRegionMatch;
    });
  }, [filters, selectedCategory, selectedRegion]);

  // Calculate summary metrics
  const summaryMetrics = useMemo(() => {
    const currentYearData = filteredData.filter(item => item.year === 2024);
    const totalRevenue = currentYearData.reduce((sum, item) => sum + item.revenue, 0);
    const totalSales = currentYearData.reduce((sum, item) => sum + item.sales, 0);
    const totalCustomers = currentYearData.reduce((sum, item) => sum + item.customers, 0);
    const totalUnits = currentYearData.reduce((sum, item) => sum + item.units, 0);

    const previousYearData = filteredData.filter(item => item.year === 2023);
    const previousRevenue = previousYearData.reduce((sum, item) => sum + item.revenue, 0);
    const revenueGrowth = previousRevenue > 0 ? ((totalRevenue - previousRevenue) / previousRevenue) * 100 : 0;

    return {
      totalRevenue,
      totalSales,
      totalCustomers,
      totalUnits,
      revenueGrowth
    };
  }, [filteredData]);

  const handleChartClick = (data: any) => {
    if (data.category) {
      setSelectedCategory(selectedCategory === data.category ? "" : data.category);
    }
    if (data.region) {
      setSelectedRegion(selectedRegion === data.region ? "" : data.region);
    }
  };

  const clearSelections = () => {
    setSelectedCategory("");
    setSelectedRegion("");
  };

  return (
    <div className="min-h-screen bg-gray-50 font-inter">
      {/* Optimized for 1440×1024 desktop */}
      <div className="w-full max-w-[1400px] mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <HamburgerMenu />
            <div className="w-10 h-10 bg-gray-900 rounded-lg flex items-center justify-center">
              <BarChart3 className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-semibold text-gray-900 tracking-tight">
                Mercanta
              </h1>
              <p className="text-gray-600 mt-1 text-sm">
                Inventory & Sales Management System
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {/* View Mode Toggle */}
            <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-lg p-1 shadow-sm">
              <button
                onClick={() => setViewMode("admin")}
                className={`px-4 py-2 text-sm font-medium rounded-md transition-all duration-200 flex items-center gap-2 ${viewMode === "admin"
                  ? "bg-gray-900 text-white shadow-sm"
                  : "text-gray-600 hover:text-gray-900"
                  }`}
              >
                <Shield className="w-4 h-4" />
                Admin
              </button>
              <button
                onClick={() => setViewMode("franchise")}
                className={`px-4 py-2 text-sm font-medium rounded-md transition-all duration-200 flex items-center gap-2 ${viewMode === "franchise"
                  ? "bg-gray-900 text-white shadow-sm"
                  : "text-gray-600 hover:text-gray-900"
                  }`}
              >
                <Store className="w-4 h-4" />
                Franchise
              </button>
            </div>
            {(selectedCategory || selectedRegion) && viewMode === "admin" && (
              <button
                onClick={clearSelections}
                className="px-4 py-2 text-sm bg-gray-900 hover:bg-gray-800 text-white rounded-lg transition-colors duration-200 flex items-center gap-2"
              >
                <Filter className="w-4 h-4" />
                Clear Selections
              </button>
            )}
          </div>
        </div>

        {/* Global Filters */}
        {viewMode === "admin" && (
          <DashboardFilters
            filters={filters}
            onFiltersChange={setFilters}
            categories={categories}
            regions={regions}
          />
        )}

        {/* Summary Metrics */}
        <div className="grid grid-cols-4 gap-6 mb-8">
          <Card className="border border-gray-200 shadow-sm bg-white">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Total Revenue</p>
                  <p className="text-2xl font-semibold text-gray-900 mt-1">
                    ₹{(summaryMetrics.totalRevenue / 1000000).toFixed(1)}M
                  </p>
                  <p className={`text-sm mt-1 ${summaryMetrics.revenueGrowth >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {summaryMetrics.revenueGrowth >= 0 ? '+' : ''}{summaryMetrics.revenueGrowth.toFixed(1)}% YoY
                  </p>
                </div>
                <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                  <IndianRupee className="w-5 h-5 text-blue-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border border-gray-200 shadow-sm bg-white">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Total Sales</p>
                  <p className="text-2xl font-semibold text-gray-900 mt-1">
                    ₹{(summaryMetrics.totalSales / 1000000).toFixed(1)}M
                  </p>
                  <p className="text-sm text-gray-500 mt-1">Current period</p>
                </div>
                <Link
                  to="/sales-history"
                  className="w-10 h-10 bg-green-100 hover:bg-green-200 rounded-lg flex items-center justify-center transition-colors cursor-pointer"
                  aria-label="View sales history"
                >
                  <TrendingUp className="w-5 h-5 text-green-600" />
                </Link>
              </div>
            </CardContent>
          </Card>

          <Card className="border border-gray-200 shadow-sm bg-white">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Customers</p>
                  <p className="text-2xl font-semibold text-gray-900 mt-1">
                    {(summaryMetrics.totalCustomers / 1000).toFixed(1)}K
                  </p>
                  <p className="text-sm text-gray-500 mt-1">Active users</p>
                </div>
                <Link
                  to="/customers"
                  className="w-10 h-10 bg-purple-100 hover:bg-purple-200 rounded-lg flex items-center justify-center transition-colors cursor-pointer"
                  aria-label="View customers"
                >
                  <Users className="w-5 h-5 text-purple-600" />
                </Link>
              </div>
            </CardContent>
          </Card>

          <Card className="border border-gray-200 shadow-sm bg-white">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Units Sold</p>
                  <p className="text-2xl font-semibold text-gray-900 mt-1">
                    {(summaryMetrics.totalUnits / 1000).toFixed(1)}K
                  </p>
                  <p className="text-sm text-gray-500 mt-1">Total units</p>
                </div>
                <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
                  <BarChart3 className="w-5 h-5 text-orange-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Active Filters Display */}
        {(selectedCategory || selectedRegion) && viewMode === "admin" && (
          <Card className="border border-amber-200 bg-amber-50">
            <CardContent className="p-4">
              <div className="flex items-center gap-4">
                <span className="text-sm font-medium text-amber-800">Active selections:</span>
                {selectedCategory && (
                  <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm font-medium">
                    Category: {selectedCategory}
                  </span>
                )}
                {selectedRegion && (
                  <span className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm font-medium">
                    Region: {selectedRegion}
                  </span>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Admin View - Charts Grid */}
        {viewMode === "admin" && (
          <>
            {/* Charts Grid - 2x2 Layout */}
            <div className="grid grid-cols-2 gap-6 mb-6">
              <SalesTrendChart
                data={filteredData}
                onDataClick={handleChartClick}
                selectedCategory={selectedCategory}
              />

              <RevenueBreakdownChart
                data={filteredData}
                onDataClick={handleChartClick}
                selectedCategory={selectedCategory}
              />

              <YoYGrowthChart
                data={filteredData}
                onDataClick={handleChartClick}
                selectedRegion={selectedRegion}
              />

              <PerformanceMetricsChart
                data={filteredData}
                onDataClick={handleChartClick}
              />
            </div>

            {/* Regional Sales Chart - Full Width */}
            <div className="w-full">
              <RegionSalesChart
                data={filteredData}
                onDataClick={handleChartClick}
                selectedRegion={selectedRegion}
              />
            </div>
          </>
        )}

        {/* Franchise View - Simplified Charts */}
        {viewMode === "franchise" && (
          <div className="grid grid-cols-2 gap-6">
            <SalesTrendChart
              data={filteredData}
              onDataClick={() => { }}
              selectedCategory=""
            />

            <InventoryAlertsCard />
          </div>
        )}
      </div>
    </div>
  );
}