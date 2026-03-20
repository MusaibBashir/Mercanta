import { Outlet, Link, useLocation } from "react-router-dom";
import { HamburgerMenu } from "../HamburgerMenu";
import { BarChart3, Shield, Store, ArrowLeft } from "lucide-react";

interface MainLayoutProps {
    viewMode: "admin" | "franchise";
    setViewMode: (mode: "admin" | "franchise") => void;
}

export function MainLayout({ viewMode, setViewMode }: MainLayoutProps) {
    const location = useLocation();
    const isHomePage = location.pathname === "/";

    return (
        <div className="min-h-screen page-bg font-inter">
            {/* Sticky glass header */}
            <header className="glass-header sticky top-0 z-30">
                <div className="w-full max-w-[1400px] mx-auto px-6 h-16 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <HamburgerMenu />
                        {!isHomePage && (
                            <Link
                                to="/"
                                className="w-9 h-9 bg-gray-100 hover:bg-brand-light border border-gray-200 hover:border-purple-200 rounded-xl flex items-center justify-center transition-all duration-200 group"
                                aria-label="Back to Dashboard"
                            >
                                <ArrowLeft className="w-4 h-4 text-gray-500 group-hover:text-purple-600 transition-colors" />
                            </Link>
                        )}
                        <img src="/logo-transparent.png" className="h-14 w-auto object-contain" alt="Mercanta Logo" />
                    </div>

                    {/* View Mode Toggle */}
                    <div className="flex items-center gap-1.5 bg-gray-100 rounded-xl p-1">
                        <button
                            onClick={() => setViewMode("admin")}
                            className={`px-4 py-1.5 text-sm font-medium rounded-lg transition-all duration-200 flex items-center gap-2 ${viewMode === "admin"
                                ? "bg-white text-purple-700 shadow-sm border border-purple-100"
                                : "text-gray-500 hover:text-gray-700"
                                }`}
                        >
                            <Shield className="w-3.5 h-3.5" />
                            Admin
                        </button>
                        <button
                            onClick={() => setViewMode("franchise")}
                            className={`px-4 py-1.5 text-sm font-medium rounded-lg transition-all duration-200 flex items-center gap-2 ${viewMode === "franchise"
                                ? "bg-white text-purple-700 shadow-sm border border-purple-100"
                                : "text-gray-500 hover:text-gray-700"
                                }`}
                        >
                            <Store className="w-3.5 h-3.5" />
                            Franchise
                        </button>
                    </div>
                </div>
            </header>

            {/* Page Content */}
            <div className="w-full max-w-[1400px] mx-auto px-6 py-8 page-enter">
                <Outlet context={{ viewMode }} />
            </div>
        </div>
    );
}
