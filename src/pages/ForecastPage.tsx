import { useState, useMemo, useEffect, useCallback } from "react";
import { TrendingUp, TrendingDown, Activity, AlertCircle, Search, X, Loader2, WifiOff, Brain, LineChart as LineChartIcon, RefreshCw } from "lucide-react";
import { useInventory } from "../context/InventoryContext";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Badge } from "../components/ui/badge";
import { PageContainer } from "../components/layout/PageContainer";
import { checkBackendHealth, getCachedForecasts, refreshForecasts, ForecastDataPoint } from "../services/forecastService";
import {
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    Area,
    AreaChart,
    ReferenceLine,
} from "recharts";

// Forecast method types
type ForecastMethod = "prophet" | "simple";

// Helper function to generate sales history from salesHistory context
function generateHistoricalSales(salesHistory: any[], inventory: any[]) {
    const salesByQuarter: { [key: string]: { [sku: string]: number } } = {};
    const quarterLabels = ["Q1 2024", "Q2 2024", "Q3 2024", "Q4 2024"];

    // Initialize quarters
    quarterLabels.forEach((q) => {
        salesByQuarter[q] = {};
        inventory.forEach((item) => {
            salesByQuarter[q][item.sku] = 0;
        });
    });

    // Aggregate sales from history
    salesHistory.forEach((sale) => {
        const date = new Date(sale.date);
        const quarter = Math.floor(date.getMonth() / 3) + 1;
        const year = date.getFullYear();
        const quarterLabel = `Q${quarter} ${year}`;

        if (salesByQuarter[quarterLabel]) {
            sale.items.forEach((item: any) => {
                if (salesByQuarter[quarterLabel][item.sku] !== undefined) {
                    salesByQuarter[quarterLabel][item.sku] += item.quantity;
                }
            });
        }
    });

    // Generate mock historical data for demonstration
    inventory.forEach((item) => {
        const baseRate = Math.floor(Math.random() * 30) + 10;
        quarterLabels.forEach((q, idx) => {
            const variation = Math.random() * 0.3 - 0.15;
            const growth = idx * 0.1;
            salesByQuarter[q][item.sku] +=
                Math.floor(baseRate * (1 + variation + growth));
        });
    });

    return salesByQuarter;
}

// Helper function to predict future sales using simple linear trend
function predictFutureSalesSimple(
    historicalSales: { [key: string]: { [sku: string]: number } },
    inventory: any[]
) {
    const futureQuarters = ["Q1 2025", "Q2 2025", "Q3 2025", "Q4 2025"];
    const predictions: { [key: string]: { [sku: string]: number } } = {};

    futureQuarters.forEach((q) => {
        predictions[q] = {};
    });

    inventory.forEach((item) => {
        const historicalData = Object.values(historicalSales).map(
            (quarter) => quarter[item.sku] || 0
        );

        const n = historicalData.length;
        const avgSales =
            historicalData.reduce((a, b) => a + b, 0) / n || 0;
        const trend =
            (historicalData[n - 1] - historicalData[0]) / n || 0;

        futureQuarters.forEach((q, idx) => {
            const variation = Math.random() * 0.2 - 0.1;
            const predicted = Math.max(
                0,
                Math.floor(avgSales + trend * (n + idx) * (1 + variation))
            );
            predictions[q][item.sku] = predicted;
        });
    });

    return predictions;
}

// Convert Prophet daily forecasts to quarterly aggregates
function aggregateProphetToQuarterly(
    prophetForecasts: Record<string, ForecastDataPoint[]>,
    inventory: any[]
): { [key: string]: { [sku: string]: number } } {
    const futureQuarters = ["Q1 2025", "Q2 2025", "Q3 2025", "Q4 2025"];
    const predictions: { [key: string]: { [sku: string]: number } } = {};

    futureQuarters.forEach((q) => {
        predictions[q] = {};
        inventory.forEach((item) => {
            predictions[q][item.sku] = 0;
        });
    });

    // Aggregate daily forecasts into quarters
    Object.entries(prophetForecasts).forEach(([sku, forecasts]) => {
        forecasts.forEach((point) => {
            const date = new Date(point.ds);
            const quarter = Math.floor(date.getMonth() / 3) + 1;
            const year = date.getFullYear();
            const quarterLabel = `Q${quarter} ${year}`;

            if (predictions[quarterLabel] && predictions[quarterLabel][sku] !== undefined) {
                predictions[quarterLabel][sku] += Math.round(point.yhat);
            }
        });
    });

    return predictions;
}

// Helper function to analyze trends and provide insights
function analyzeTrends(
    historicalSales: { [key: string]: { [sku: string]: number } },
    predictions: { [key: string]: { [sku: string]: number } },
    sku: string
) {
    const historical = Object.values(historicalSales).map(
        (quarter) => quarter[sku] || 0
    );
    const future = Object.values(predictions).map(
        (quarter) => quarter[sku] || 0
    );

    const avgHistorical =
        historical.reduce((a, b) => a + b, 0) / historical.length || 0;
    const avgFuture = future.reduce((a, b) => a + b, 0) / future.length || 0;

    const growth = avgHistorical > 0
        ? ((avgFuture - avgHistorical) / avgHistorical) * 100
        : 0;

    const recentTrend = historical[historical.length - 1] > historical[0];
    const volatility =
        Math.max(...historical) - Math.min(...historical);
    const isVolatile = volatility > avgHistorical * 0.5;

    const insights: string[] = [];

    if (growth > 20) {
        insights.push("Strong growth trend expected");
    } else if (growth > 5) {
        insights.push("Moderate growth anticipated");
    } else if (growth < -5) {
        insights.push("Declining sales trend");
    } else {
        insights.push("Stable sales pattern");
    }

    if (isVolatile) {
        insights.push("High demand variability");
    }

    if (recentTrend) {
        insights.push("Upward momentum in recent quarters");
    } else {
        insights.push("Recent sales softening");
    }

    const maxIdx = historical.indexOf(Math.max(...historical));
    if (maxIdx === 3 || maxIdx === 0) {
        insights.push("Q4/Q1 seasonal peak observed");
    }

    return {
        growth: growth.toFixed(1),
        trend: growth > 5 ? "up" : growth < -5 ? "down" : "stable",
        insights,
        avgHistorical: avgHistorical.toFixed(1),
        avgFuture: avgFuture.toFixed(1),
    };
}

export function ForecastPage() {
    const { inventory, salesHistory } = useInventory();
    const [searchQuery, setSearchQuery] = useState("");
    const [selectedSku, setSelectedSku] = useState<string | null>(null);

    // Prophet integration state
    const [forecastMethod, setForecastMethod] = useState<ForecastMethod>("prophet");
    const [isBackendAvailable, setIsBackendAvailable] = useState<boolean | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [prophetForecasts, setProphetForecasts] = useState<Record<string, ForecastDataPoint[]> | null>(null);
    const [backendError, setBackendError] = useState<string | null>(null);
    const [showBackendAlert, setShowBackendAlert] = useState(false);
    const [lastGeneratedAt, setLastGeneratedAt] = useState<string | null>(null);

    // Check backend availability on mount
    useEffect(() => {
        const checkBackend = async () => {
            const result = await checkBackendHealth();
            setIsBackendAvailable(result.healthy);
            if (!result.healthy) {
                setForecastMethod("simple");
                setShowBackendAlert(true);
            }
        };
        checkBackend();
    }, []);

    // Load cached forecasts immediately on mount (instant load)
    useEffect(() => {
        const loadCachedData = async () => {
            setIsLoading(true);
            try {
                const cached = await getCachedForecasts();
                if (cached.success && cached.cached && Object.keys(cached.forecasts).length > 0) {
                    setProphetForecasts(cached.forecasts);
                    if (cached.generated_at) {
                        const firstSku = Object.keys(cached.generated_at)[0];
                        setLastGeneratedAt(cached.generated_at[firstSku]);
                    }
                }
            } catch (error) {
                console.error("Error loading cached forecasts:", error);
            } finally {
                setIsLoading(false);
            }
        };
        loadCachedData();
    }, []);

    // Trigger background refresh when page loads
    const triggerRefresh = useCallback(async () => {
        if (!isBackendAvailable || isRefreshing) return;

        setIsRefreshing(true);
        setBackendError(null);

        try {
            const response = await refreshForecasts(undefined, 365, 'D'); // 365 days = ~4 quarters

            if (response.success && response.forecasts) {
                setProphetForecasts(response.forecasts);
                if (response.model_info?.generated_at) {
                    setLastGeneratedAt(response.model_info.generated_at);
                }
            } else {
                setBackendError(response.error || "Failed to refresh Prophet forecasts");
                if (!prophetForecasts) {
                    setForecastMethod("simple");
                    setShowBackendAlert(true);
                }
            }
        } catch (error) {
            console.error("Prophet forecast refresh error:", error);
            setBackendError("Failed to connect to forecast backend");
            if (!prophetForecasts) {
                setForecastMethod("simple");
                setShowBackendAlert(true);
            }
        } finally {
            setIsRefreshing(false);
        }
    }, [isBackendAvailable, isRefreshing, prophetForecasts]);

    // Auto-refresh when backend becomes available and we have inventory
    useEffect(() => {
        if (isBackendAvailable && forecastMethod === "prophet" && inventory.length > 0) {
            triggerRefresh();
        }
    }, [isBackendAvailable, forecastMethod, inventory.length, triggerRefresh]);

    // Generate historical and predicted sales data
    const { historicalSales, predictions } = useMemo(() => {
        const historical = generateHistoricalSales(salesHistory, inventory);

        let predicted: { [key: string]: { [sku: string]: number } };

        if (forecastMethod === "prophet" && prophetForecasts) {
            predicted = aggregateProphetToQuarterly(prophetForecasts, inventory);
        } else {
            predicted = predictFutureSalesSimple(historical, inventory);
        }

        return { historicalSales: historical, predictions: predicted };
    }, [salesHistory, inventory, forecastMethod, prophetForecasts]);

    // Calculate overall totals
    const overallData = useMemo(() => {
        const allQuarters = [
            ...Object.keys(historicalSales),
            ...Object.keys(predictions),
        ];
        return allQuarters.map((quarter) => {
            const isHistorical = historicalSales[quarter];
            const data = isHistorical ? historicalSales : predictions;
            const total = Object.values(data[quarter] || {}).reduce(
                (sum: number, val) => sum + (val as number),
                0
            );
            return {
                quarter,
                sales: total,
                type: isHistorical ? "historical" : "forecast",
            };
        });
    }, [historicalSales, predictions]);

    // Calculate overall insights
    const overallInsights = useMemo(() => {
        const historicalTotal = Object.values(historicalSales).reduce(
            (sum, quarter) =>
                sum +
                Object.values(quarter).reduce(
                    (qSum: number, val) => qSum + (val as number),
                    0
                ),
            0
        );
        const forecastTotal = Object.values(predictions).reduce(
            (sum, quarter) =>
                sum +
                Object.values(quarter).reduce(
                    (qSum: number, val) => qSum + (val as number),
                    0
                ),
            0
        );

        const avgHistorical =
            historicalTotal / Object.keys(historicalSales).length;
        const avgForecast =
            forecastTotal / Object.keys(predictions).length;
        const growth = ((avgForecast - avgHistorical) / avgHistorical) * 100;

        return {
            historicalTotal,
            forecastTotal,
            growth: growth.toFixed(1),
            avgHistorical: avgHistorical.toFixed(0),
            avgForecast: avgForecast.toFixed(0),
        };
    }, [historicalSales, predictions]);

    // Filter inventory based on search
    const filteredInventory = useMemo(() => {
        if (!searchQuery) return inventory;
        const query = searchQuery.toLowerCase();
        return inventory.filter(
            (item) =>
                item.sku.toLowerCase().includes(query) ||
                item.itemName.toLowerCase().includes(query) ||
                item.category.toLowerCase().includes(query)
        );
    }, [inventory, searchQuery]);

    // Get data for selected SKU
    const selectedSkuData = useMemo(() => {
        if (!selectedSku) return null;

        const allQuarters = [
            ...Object.keys(historicalSales),
            ...Object.keys(predictions),
        ];
        const data = allQuarters.map((quarter) => {
            const isHistorical = historicalSales[quarter];
            const salesData = isHistorical ? historicalSales : predictions;
            return {
                quarter,
                sales: salesData[quarter]?.[selectedSku] || 0,
                type: isHistorical ? "historical" : "forecast",
            };
        });

        const item = inventory.find((i) => i.sku === selectedSku);
        const analysis = analyzeTrends(
            historicalSales,
            predictions,
            selectedSku
        );

        return { data, item, analysis };
    }, [selectedSku, historicalSales, predictions, inventory]);

    // Handle method switch
    const handleMethodChange = (method: ForecastMethod) => {
        if (method === "prophet" && !isBackendAvailable) {
            setShowBackendAlert(true);
            return;
        }
        setForecastMethod(method);
        if (method === "prophet" && !prophetForecasts) {
            triggerRefresh();
        }
    };

    return (
        <PageContainer
            title="Sales Forecast"
            subtitle="Predicted sales trends and insights"
            icon={<TrendingUp className="w-5 h-5 text-blue-600" />}
            iconBgColor="bg-blue-100"
        >
            {/* Backend Alert */}
            {showBackendAlert && (
                <div className="mb-4 p-4 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-3">
                    <WifiOff className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                    <div className="flex-1">
                        <p className="font-medium text-amber-900">
                            Prophet Backend Unavailable
                        </p>
                        <p className="text-sm text-amber-800 mt-1">
                            {backendError || "Unable to connect to the Prophet forecasting backend."}
                            {" "}Using simple trend prediction as fallback.
                        </p>
                    </div>
                    <button
                        onClick={() => setShowBackendAlert(false)}
                        className="text-amber-600 hover:text-amber-800"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>
            )}

            {/* Forecast Method Selector */}
            <div className="mb-4 flex items-center gap-4">
                <span className="text-sm font-medium text-gray-700">Forecast Model:</span>
                <div className="flex gap-2">
                    <button
                        onClick={() => handleMethodChange("prophet")}
                        disabled={isLoading}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${forecastMethod === "prophet"
                            ? "bg-blue-600 text-white"
                            : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                            } ${!isBackendAvailable ? "opacity-50 cursor-not-allowed" : ""}`}
                    >
                        <Brain className="w-4 h-4" />
                        Prophet AI
                        {isLoading && forecastMethod === "prophet" && (
                            <Loader2 className="w-4 h-4 animate-spin" />
                        )}
                    </button>
                    <button
                        onClick={() => handleMethodChange("simple")}
                        disabled={isLoading}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${forecastMethod === "simple"
                            ? "bg-blue-600 text-white"
                            : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                            }`}
                    >
                        <LineChartIcon className="w-4 h-4" />
                        Simple Trend
                    </button>
                </div>
                {forecastMethod === "prophet" && prophetForecasts && (
                    <Badge variant="secondary" className="text-xs">
                        AI-powered predictions with seasonality
                    </Badge>
                )}
            </div>

            {/* Loading State */}
            {isLoading && (
                <div className="mb-4 p-6 bg-blue-50 border border-blue-200 rounded-lg flex items-center justify-center gap-3">
                    <Loader2 className="w-6 h-6 text-blue-600 animate-spin" />
                    <p className="text-blue-800 font-medium">
                        Training Prophet model... This may take a few seconds.
                    </p>
                </div>
            )}

            {/* Overall Forecast */}
            <Card className="border-2 border-blue-200 bg-blue-50">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Activity className="w-5 h-5 text-blue-600" />
                        Overall Inventory Forecast
                        {forecastMethod === "prophet" && prophetForecasts && (
                            <Badge className="ml-2 bg-purple-100 text-purple-800">
                                Prophet AI
                            </Badge>
                        )}
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    {/* Summary Stats */}
                    <div className="grid grid-cols-4 gap-4">
                        <div className="bg-white p-4 rounded-lg">
                            <p className="text-sm text-gray-600 mb-1">
                                Historical Avg/Quarter
                            </p>
                            <p className="text-2xl font-semibold text-gray-900">
                                {overallInsights.avgHistorical}
                            </p>
                            <p className="text-xs text-gray-500 mt-1">units sold</p>
                        </div>
                        <div className="bg-white p-4 rounded-lg">
                            <p className="text-sm text-gray-600 mb-1">
                                Forecast Avg/Quarter
                            </p>
                            <p className="text-2xl font-semibold text-gray-900">
                                {overallInsights.avgForecast}
                            </p>
                            <p className="text-xs text-gray-500 mt-1">units projected</p>
                        </div>
                        <div className="bg-white p-4 rounded-lg">
                            <p className="text-sm text-gray-600 mb-1">
                                Expected Growth
                            </p>
                            <p
                                className={`text-2xl font-semibold ${parseFloat(overallInsights.growth) > 0
                                    ? "text-green-600"
                                    : "text-red-600"
                                    }`}
                            >
                                {overallInsights.growth}%
                            </p>
                            <p className="text-xs text-gray-500 mt-1">
                                quarter over quarter
                            </p>
                        </div>
                        <div className="bg-white p-4 rounded-lg">
                            <p className="text-sm text-gray-600 mb-1">
                                Total Forecast (2025)
                            </p>
                            <p className="text-2xl font-semibold text-gray-900">
                                {overallInsights.forecastTotal}
                            </p>
                            <p className="text-xs text-gray-500 mt-1">units</p>
                        </div>
                    </div>

                    {/* Overall Timeline Chart */}
                    <div className="bg-white p-4 rounded-lg">
                        <h4 className="text-sm font-medium text-gray-700 mb-4">
                            Sales Timeline: Historical & Forecast
                        </h4>
                        <ResponsiveContainer width="100%" height={300}>
                            <AreaChart data={overallData}>
                                <defs>
                                    <linearGradient
                                        id="colorHistorical"
                                        x1="0"
                                        y1="0"
                                        x2="0"
                                        y2="1"
                                    >
                                        <stop
                                            offset="5%"
                                            stopColor="#3b82f6"
                                            stopOpacity={0.8}
                                        />
                                        <stop
                                            offset="95%"
                                            stopColor="#3b82f6"
                                            stopOpacity={0.1}
                                        />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                                <XAxis
                                    dataKey="quarter"
                                    stroke="#6b7280"
                                    fontSize={12}
                                />
                                <YAxis stroke="#6b7280" fontSize={12} />
                                <Tooltip
                                    contentStyle={{
                                        backgroundColor: "white",
                                        border: "1px solid #e5e7eb",
                                        borderRadius: "8px",
                                    }}
                                />
                                <ReferenceLine
                                    x="Q4 2024"
                                    stroke="#9333ea"
                                    strokeDasharray="5 5"
                                    label={{ value: "Forecast →", position: "top", fontSize: 11, fill: "#9333ea" }}
                                />
                                <Area
                                    type="monotone"
                                    dataKey="sales"
                                    stroke="#3b82f6"
                                    strokeWidth={2}
                                    fill="url(#colorHistorical)"
                                    fillOpacity={1}
                                    name="Sales"
                                />
                            </AreaChart>
                        </ResponsiveContainer>
                        <div className="flex items-center justify-center gap-6 mt-4">
                            <div className="flex items-center gap-2">
                                <div className="w-3 h-3 rounded-full bg-blue-500"></div>
                                <span className="text-sm text-gray-600">
                                    Historical (2024)
                                </span>
                            </div>
                            <div className="flex items-center gap-2">
                                <div className="w-3 h-3 rounded-full bg-purple-500"></div>
                                <span className="text-sm text-gray-600">
                                    Forecast (2025)
                                </span>
                            </div>
                            {forecastMethod === "prophet" && (
                                <div className="flex items-center gap-2">
                                    <Brain className="w-3 h-3 text-purple-600" />
                                    <span className="text-sm text-purple-600 font-medium">
                                        Prophet AI Model
                                    </span>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Key Insights */}
                    <div className="bg-white p-4 rounded-lg">
                        <h4 className="text-sm font-medium text-gray-700 mb-3 flex items-center gap-2">
                            <AlertCircle className="w-4 h-4 text-blue-600" />
                            Key Insights & Recommendations
                        </h4>
                        <div className="space-y-2">
                            <div className="flex items-start gap-2">
                                <div className="w-1.5 h-1.5 rounded-full bg-blue-600 mt-2"></div>
                                <p className="text-sm text-gray-700">
                                    Overall inventory sales are projected to{" "}
                                    {parseFloat(overallInsights.growth) > 0
                                        ? "grow"
                                        : "decline"}{" "}
                                    by{" "}
                                    <span className="font-semibold">
                                        {Math.abs(parseFloat(overallInsights.growth))}%
                                    </span>{" "}
                                    in 2025
                                    {forecastMethod === "prophet" && " (Prophet AI prediction with seasonality patterns)"}
                                </p>
                            </div>
                            <div className="flex items-start gap-2">
                                <div className="w-1.5 h-1.5 rounded-full bg-blue-600 mt-2"></div>
                                <p className="text-sm text-gray-700">
                                    Expected average quarterly sales:{" "}
                                    <span className="font-semibold">
                                        {overallInsights.avgForecast} units
                                    </span>
                                </p>
                            </div>
                            <div className="flex items-start gap-2">
                                <div className="w-1.5 h-1.5 rounded-full bg-blue-600 mt-2"></div>
                                <p className="text-sm text-gray-700">
                                    Plan inventory levels to support forecasted demand while
                                    maintaining optimal stock levels
                                </p>
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Per-SKU Forecast */}
            <Card>
                <CardHeader>
                    <CardTitle>Per-SKU Forecast Analysis</CardTitle>
                    <div className="mt-4">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                            <Input
                                type="text"
                                placeholder="Search by SKU, name, or category..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="pl-10"
                            />
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="space-y-4">
                    {/* SKU List */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                        {filteredInventory.map((item) => {
                            const analysis = analyzeTrends(
                                historicalSales,
                                predictions,
                                item.sku
                            );
                            const isSelected = selectedSku === item.sku;

                            return (
                                <button
                                    key={item.id}
                                    onClick={() =>
                                        setSelectedSku(isSelected ? null : item.sku)
                                    }
                                    className={`p-4 rounded-lg border-2 transition-all text-left ${isSelected
                                        ? "border-blue-500 bg-blue-50"
                                        : "border-gray-200 bg-white hover:border-gray-300"
                                        }`}
                                >
                                    <div className="flex items-start justify-between mb-2">
                                        <div>
                                            <p className="font-medium text-gray-900">
                                                {item.itemName}
                                            </p>
                                            <p className="text-xs text-gray-500">{item.sku}</p>
                                        </div>
                                        {analysis.trend === "up" ? (
                                            <TrendingUp className="w-4 h-4 text-green-600" />
                                        ) : analysis.trend === "down" ? (
                                            <TrendingDown className="w-4 h-4 text-red-600" />
                                        ) : (
                                            <Activity className="w-4 h-4 text-gray-600" />
                                        )}
                                    </div>
                                    <div className="flex items-center gap-2 mb-2">
                                        <Badge variant="secondary" className="text-xs">
                                            {item.category}
                                        </Badge>
                                        <Badge
                                            variant={
                                                analysis.trend === "up"
                                                    ? "default"
                                                    : analysis.trend === "down"
                                                        ? "destructive"
                                                        : "secondary"
                                            }
                                            className="text-xs"
                                        >
                                            {analysis.growth}%
                                        </Badge>
                                    </div>
                                    <p className="text-xs text-gray-600">
                                        Avg: {analysis.avgHistorical} → {analysis.avgFuture}{" "}
                                        units/quarter
                                    </p>
                                </button>
                            );
                        })}
                    </div>

                    {/* Selected SKU Details */}
                    {selectedSkuData && (
                        <div className="mt-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
                            <div className="flex items-center justify-between mb-4">
                                <div>
                                    <h4 className="font-semibold text-gray-900">
                                        {selectedSkuData.item?.itemName}
                                    </h4>
                                    <p className="text-sm text-gray-600">
                                        {selectedSkuData.item?.sku} •{" "}
                                        {selectedSkuData.item?.category}
                                    </p>
                                </div>
                                <button
                                    onClick={() => setSelectedSku(null)}
                                    className="p-1 hover:bg-gray-200 rounded transition-colors"
                                >
                                    <X className="w-4 h-4 text-gray-600" />
                                </button>
                            </div>

                            {/* SKU Timeline Chart */}
                            <div className="bg-white p-4 rounded-lg mb-4">
                                <ResponsiveContainer width="100%" height={250}>
                                    <LineChart data={selectedSkuData.data}>
                                        <CartesianGrid
                                            strokeDasharray="3 3"
                                            stroke="#e5e7eb"
                                        />
                                        <XAxis
                                            dataKey="quarter"
                                            stroke="#6b7280"
                                            fontSize={12}
                                        />
                                        <YAxis stroke="#6b7280" fontSize={12} />
                                        <Tooltip
                                            contentStyle={{
                                                backgroundColor: "white",
                                                border: "1px solid #e5e7eb",
                                                borderRadius: "8px",
                                            }}
                                        />
                                        <ReferenceLine
                                            x="Q4 2024"
                                            stroke="#9333ea"
                                            strokeDasharray="5 5"
                                        />
                                        <Line
                                            type="monotone"
                                            dataKey="sales"
                                            stroke="#3b82f6"
                                            strokeWidth={2}
                                            dot={{ r: 4 }}
                                            activeDot={{ r: 6 }}
                                            name="Sales (units)"
                                        />
                                    </LineChart>
                                </ResponsiveContainer>
                            </div>

                            {/* SKU Insights */}
                            <div className="bg-white p-4 rounded-lg">
                                <h5 className="text-sm font-medium text-gray-700 mb-3 flex items-center gap-2">
                                    <AlertCircle className="w-4 h-4 text-blue-600" />
                                    Trend Analysis & Insights
                                </h5>
                                <div className="grid grid-cols-2 gap-3 mb-4">
                                    <div className="p-3 bg-gray-50 rounded">
                                        <p className="text-xs text-gray-600 mb-1">
                                            Historical Avg
                                        </p>
                                        <p className="text-lg font-semibold text-gray-900">
                                            {selectedSkuData.analysis.avgHistorical}
                                        </p>
                                        <p className="text-xs text-gray-500">
                                            units/quarter
                                        </p>
                                    </div>
                                    <div className="p-3 bg-gray-50 rounded">
                                        <p className="text-xs text-gray-600 mb-1">
                                            Forecast Avg
                                        </p>
                                        <p className="text-lg font-semibold text-gray-900">
                                            {selectedSkuData.analysis.avgFuture}
                                        </p>
                                        <p className="text-xs text-gray-500">
                                            units/quarter
                                        </p>
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    {selectedSkuData.analysis.insights.map(
                                        (insight, idx) => (
                                            <div key={idx} className="flex items-start gap-2">
                                                <div className="w-1.5 h-1.5 rounded-full bg-blue-600 mt-2"></div>
                                                <p className="text-sm text-gray-700">{insight}</p>
                                            </div>
                                        )
                                    )}
                                </div>

                                {/* Recommendations */}
                                <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded">
                                    <p className="text-sm font-medium text-amber-900 mb-2">
                                        Recommendations
                                    </p>
                                    <div className="space-y-1">
                                        {parseFloat(selectedSkuData.analysis.growth) > 15 && (
                                            <p className="text-xs text-amber-800">
                                                • Increase stock levels to meet growing demand
                                            </p>
                                        )}
                                        {parseFloat(selectedSkuData.analysis.growth) < -10 && (
                                            <p className="text-xs text-amber-800">
                                                • Consider reducing inventory or promotional
                                                activities
                                            </p>
                                        )}
                                        {selectedSkuData.item &&
                                            selectedSkuData.item.quantity <
                                            parseFloat(
                                                selectedSkuData.analysis.avgFuture
                                            ) && (
                                                <p className="text-xs text-amber-800">
                                                    • Current stock (
                                                    {selectedSkuData.item.quantity}) is below
                                                    forecasted demand
                                                </p>
                                            )}
                                        <p className="text-xs text-amber-800">
                                            • Monitor sales trends weekly to validate forecasts
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>
        </PageContainer>
    );
}
