import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import { toast } from "sonner";
import { LiquidGradient } from "../components/LiquidGradient";
import "./LoginPage.css";

const Ticker = () => {
    const words = ['Supply Chain', 'Sales', 'Enterprise', 'Inventory'];
    const extendedWords = [...words, words[0]];

    const [current, setCurrent] = useState(0);

    useEffect(() => {
        const interval = setInterval(() => {
            setCurrent(c => {
                if (c === words.length) {
                    return 0;
                }
                return c + 1;
            });
        }, 2200);
        return () => clearInterval(interval);
    }, [words.length]);

    // Simple implementation for React: just translate by index * em
    return (
        <div className="ticker-wrap">
            <div
                className="ticker-track"
                style={{
                    transform: `translateY(-${current * 100 / extendedWords.length}%)`,
                    transition: current === 0 ? 'none' : 'transform 520ms cubic-bezier(0.77,0,0.175,1)'
                }}
            >
                {extendedWords.map((w, i) => (
                    <div key={i} className={`ticker-item ${i === current || (current === words.length && i === 0) ? 'active' : ''}`}>{w}</div>
                ))}
            </div>
        </div>
    );
};

export function LoginPage() {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [isSigningIn, setIsSigningIn] = useState(false);
    const [cursorPos, setCursorPos] = useState({ x: -100, y: -100 });
    const [isHovering, setIsHovering] = useState(false);

    const navigate = useNavigate();
    const location = useLocation();
    const from = location.state?.from?.pathname || "/app";

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!email || !password) {
            toast.error("Please enter both email and password");
            return;
        }

        setIsSigningIn(true);
        try {
            if (!supabase) {
                toast.error("Database connection not configured. Please contact the administrator.");
                setIsSigningIn(false);
                return;
            }

            const { error } = await supabase.auth.signInWithPassword({
                email,
                password,
            });

            if (error) {
                if (error.message.includes("Invalid login credentials") || error.message.includes("Invalid login")) {
                    toast.error("Invalid email or password");
                } else {
                    toast.error(error.message);
                }
                return;
            }

            toast.success("Successfully signed in");
            setTimeout(() => {
                navigate(from, { replace: true });
            }, 100);
        } catch (error) {
            console.error('Sign in error:', error);
            toast.error("An unexpected error occurred. Please try again.");
        } finally {
            setIsSigningIn(false);
        }
    };

    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            setCursorPos({ x: e.clientX, y: e.clientY });
        };
        const handleMouseOver = (e: MouseEvent) => {
            const target = e.target as HTMLElement;
            const tag = target.tagName?.toLowerCase();
            if (tag === 'a' || tag === 'button' || tag === 'input' || target.closest('a') || target.closest('button')) {
                setIsHovering(true);
            } else {
                setIsHovering(false);
            }
        };

        const wrapper = document.querySelector('.login-page-wrapper');
        if (wrapper) {
            wrapper.addEventListener('mousemove', handleMouseMove as any);
            wrapper.addEventListener('mouseover', handleMouseOver as any);
            document.body.style.cursor = 'none'; // Ensure default cursor is hidden
        }

        return () => {
            if (wrapper) {
                wrapper.removeEventListener('mousemove', handleMouseMove as any);
                wrapper.removeEventListener('mouseover', handleMouseOver as any);
            }
            document.body.style.cursor = 'auto'; // Restore default cursor on exit
        };
    }, []);

    return (
        <div className="login-page-wrapper no-cursor">
            <div className="login-layout">
                {/* ── 70% — Liquid Gradient ── */}
                <div className="gradient-side" id="gradientSide">
                    {/* The liquid gradient component wraps the threejs canvas */}
                    <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', zIndex: 1 }}>
                        <LiquidGradient />
                    </div>

                    <div className="gradient-overlay-text">
                        <div className="tagline-static">
                            <span>Get Set for</span>
                            <Ticker />
                        </div>
                    </div>
                </div>

                {/* ── 30% — Login Panel ── */}
                <div className="login-side">
                    {/* Logo */}
                    <div className="login-logo mb-10 w-[70%] mx-auto">
                        <img src="/logo-transparent.png" alt="Mercanta Logo" className="w-full h-auto object-contain block" />
                    </div>

                    {/* Header */}
                    <div className="login-header">
                        <h1>Welcome back</h1>
                        <p>Sign in to continue to your account</p>
                    </div>

                    {/* Form */}
                    <form className="login-form-custom" onSubmit={handleSubmit}>
                        <div className="field-group">
                            <label className="field-label" htmlFor="email">Email</label>
                            <input
                                type="email"
                                id="email"
                                className="field-input"
                                placeholder="you@example.com"
                                autoComplete="email"
                                required
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                            />
                        </div>

                        <div className="field-group">
                            <div className="field-row" style={{ justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '0.4rem' }}>
                                <label className="field-label" htmlFor="password" style={{ marginBottom: 0 }}>Password</label>
                                <a href="#" className="forgot-link">Forgot password?</a>
                            </div>
                            <div className="password-wrapper">
                                <input
                                    type={showPassword ? "text" : "password"}
                                    id="password"
                                    className="field-input"
                                    placeholder="••••••••"
                                    autoComplete="current-password"
                                    required
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                />
                                <button
                                    type="button"
                                    className="password-toggle"
                                    aria-label="Toggle password"
                                    onClick={() => setShowPassword(!showPassword)}
                                >
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                                        {showPassword ? (
                                            <>
                                                <line x1="1" y1="1" x2="23" y2="23" />
                                                <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                                            </>
                                        ) : (
                                            <>
                                                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                                                <circle cx="12" cy="12" r="3" />
                                            </>
                                        )}
                                    </svg>
                                </button>
                            </div>
                        </div>

                        <button type="submit" className="login-btn" disabled={isSigningIn}>
                            {isSigningIn ? (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <svg className="animate-spin" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <line x1="12" y1="2" x2="12" y2="6"></line>
                                        <line x1="12" y1="18" x2="12" y2="22"></line>
                                        <line x1="4.93" y1="4.93" x2="7.76" y2="7.76"></line>
                                        <line x1="16.24" y1="16.24" x2="19.07" y2="19.07"></line>
                                        <line x1="2" y1="12" x2="6" y2="12"></line>
                                        <line x1="18" y1="12" x2="22" y2="12"></line>
                                        <line x1="4.93" y1="19.07" x2="7.76" y2="16.24"></line>
                                        <line x1="16.24" y1="7.76" x2="19.07" y2="4.93"></line>
                                    </svg>
                                    Signing in...
                                </div>
                            ) : "Sign In"}
                        </button>
                    </form>

                    <div className="login-footer">
                        <p>Don't have an account? <a href="mailto:musaibbashir02@gmail.com">Contact us</a></p>
                    </div>

                    <div className="copyright">© 2025 Mercanta. All rights reserved.</div>
                </div>
            </div>

            {/* Custom cursor */}
            <div
                className={`custom-cursor flex items-center justify-center ${isHovering ? 'hovering' : ''}`}
                style={{
                    left: cursorPos.x,
                    top: cursorPos.y,
                }}
            />
        </div>
    );
}
