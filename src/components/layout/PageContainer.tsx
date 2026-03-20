import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { ReactNode } from "react";

interface PageContainerProps {
    children: ReactNode;
    title: string;
    subtitle?: string;
    icon?: ReactNode;
    iconBgColor?: string;
}

export function PageContainer({
    children,
    title,
    subtitle,
    icon,
    iconBgColor = "bg-purple-50",
}: PageContainerProps) {
    return (
        <div className="min-h-screen page-bg font-inter">
            {/* Sticky glass header */}
            <header className="glass-header sticky top-0 z-30">
                <div className="w-full max-w-[1400px] mx-auto px-6 h-16 flex items-center gap-4">
                    <Link
                        to="/"
                        className="w-9 h-9 bg-gray-100 hover:bg-purple-50 border border-gray-200 hover:border-purple-200 rounded-xl flex items-center justify-center transition-all duration-200 group shrink-0"
                        aria-label="Back to Dashboard"
                    >
                        <ArrowLeft className="w-4 h-4 text-gray-500 group-hover:text-purple-600 transition-colors" />
                    </Link>

                    {icon && (
                        <div className={`w-9 h-9 ${iconBgColor} rounded-xl flex items-center justify-center shrink-0`}>
                            {icon}
                        </div>
                    )}

                    <div>
                        <h1 className="text-lg font-semibold text-gray-900 leading-tight">{title}</h1>
                        {subtitle && (
                            <p className="text-xs text-gray-400 mt-0.5">{subtitle}</p>
                        )}
                    </div>
                </div>
            </header>

            {/* Content */}
            <div className="w-full max-w-[1400px] mx-auto px-6 py-8 space-y-6 page-enter">
                {children}
            </div>
        </div>
    );
}
