import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from "react";
import { supabase, isSupabaseAvailable } from "../lib/supabaseClient";

export interface UserProfile {
    id: string;
    role: "admin" | "franchise";
    full_name: string;
    created_at: string;
    default_business_account_id?: string;
}

export interface Franchise {
    id: string;
    name: string;
    region: string;
    state: string;
    owner_id: string;
    created_by: string;
    is_active: boolean;
    business_account_id?: string;
    created_at: string;
}

// Feature 1: Modular Admin System
export interface BusinessAccount {
    id: string;
    owner_id: string;
    business_name: string;
    business_type: "standalone_shop" | "franchise_admin" | "franchise_unit" | "restaurant";
    display_name?: string;
    logo_url?: string;
    settings?: Record<string, any>;
    is_active: boolean;
    created_at: string;
    updated_at: string;
}

export interface AccountContext {
    id: string;
    business_name: string;
    business_type: string;
    role_in_account: "owner" | "manager" | "operator" | "viewer";
    available_features: string[];
}

export interface Permission {
    id: string;
    profile_id: string;
    business_account_id: string;
    role: "owner" | "manager" | "operator" | "viewer";
    scope: string;
    can_read: boolean;
    can_write: boolean;
    can_delete: boolean;
}

interface AuthContextType {
    user: any | null;
    profile: UserProfile | null;
    franchise: Franchise | null;
    activeBusinessAccount: BusinessAccount | null;
    businessAccounts: BusinessAccount[];
    isLoading: boolean;
    isAdmin: boolean;
    error: string | null;
    signIn: (email: string, password: string) => Promise<{ error: string | null }>;
    signOut: () => Promise<void>;
    createFranchiseUser: (
        email: string,
        password: string,
        fullName: string,
        franchiseName: string,
        region: string,
        state: string
    ) => Promise<{ error: string | null; franchise?: Franchise }>;
    getAllFranchises: () => Promise<Franchise[]>;
    updateFranchise: (id: string, updates: Partial<Franchise>) => Promise<boolean>;
    switchBusinessAccount: (accountId: string) => Promise<{ error: string | null }>;
    getBusinessAccounts: () => Promise<BusinessAccount[]>;
    createBusinessAccount: (businessName: string, businessType: string) => Promise<{ error: string | null; account?: BusinessAccount }>;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<any>(null);
    const [profile, setProfile] = useState<UserProfile | null>(null);
    const [franchise, setFranchise] = useState<Franchise | null>(null);
    const [activeBusinessAccount, setActiveBusinessAccount] = useState<BusinessAccount | null>(null);
    const [businessAccounts, setBusinessAccounts] = useState<BusinessAccount[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [authError, setAuthError] = useState<string | null>(null);

    const fetchProfile = useCallback(async (userId: string) => {
        if (!supabase) return null;
        try {
            console.log("[Auth] Fetching profile for:", userId);

            const { data, error } = await supabase
                .from("profiles")
                .select("*")
                .eq("id", userId)
                .maybeSingle();

            if (error) {
                console.error("Profile fetch error detected:", error.message, "Code:", error.code);
                return null;
            }
            console.log("[Auth] Profile found:", data?.role);
            return data as UserProfile;
        } catch (err: any) {
            console.error("Error fetching profile:", err?.message || err);
            return null;
        }
    }, []);

    const fetchFranchise = useCallback(async (ownerId: string) => {
        if (!supabase) return null;
        try {
            const { data, error } = await supabase
                .from("franchises")
                .select("*")
                .eq("owner_id", ownerId)
                .eq("is_active", true)
                .single();
            if (error) return null;
            return data as Franchise;
        } catch (err) {
            return null;
        }
    }, []);

    // Feature 1: Fetch business accounts for current user
    const fetchBusinessAccounts = useCallback(async (userId: string) => {
        if (!supabase) return [];
        try {
            // Call the helper function to get all business accounts for user
            const { data, error } = await supabase
                .rpc("get_user_business_accounts", { p_user_id: userId });
            
            if (error) {
                console.error("[Auth] Error fetching business accounts:", error);
                return [];
            }
            
            return (data || []) as BusinessAccount[];
        } catch (err) {
            console.error("[Auth] Error in fetchBusinessAccounts:", err);
            return [];
        }
    }, []);

    // Feature 1: Get active business account from session
    const getActiveBusinessAccountFromSession = useCallback(async (userId: string) => {
        if (!supabase) return null;
        try {
            const { data, error } = await supabase
                .from("active_account_sessions")
                .select("business_account_id")
                .eq("user_id", userId)
                .maybeSingle();
            
            if (error || !data) return null;
            
            // Fetch the business account details
            const { data: account, error: accountError } = await supabase
                .from("business_accounts")
                .select("*")
                .eq("id", data.business_account_id)
                .maybeSingle();
            
            return accountError ? null : (account as BusinessAccount);
        } catch (err) {
            console.error("[Auth] Error getting active account:", err);
            return null;
        }
    }, []);

    // Initialize auth state
    useEffect(() => {
        if (!supabase) {
            setIsLoading(false);
            return;
        }

        let isMounted = true;
        let isFetching = false;

        const loadProfileData = async (userId: string) => {
            if (isFetching || !isMounted || !supabase) return;
            isFetching = true;
            try {
                // Fetch profile
                const { data: prof, error: profErr } = await supabase
                    .from("profiles")
                    .select("*")
                    .eq("id", userId)
                    .maybeSingle();

                if (!isMounted) return;

                if (profErr || !prof) {
                    console.error("[Auth] Profile fetch failed:", profErr);
                    setAuthError("Failed to load user profile. If you just signed up, please wait or contact admin.");
                    setProfile(null);
                    setFranchise(null);
                    setBusinessAccounts([]);
                    setActiveBusinessAccount(null);
                } else {
                    setAuthError(null);
                    setProfile(prof as UserProfile);

                    // Fetch business accounts (Feature 1)
                    const accounts = await fetchBusinessAccounts(userId);
                    if (isMounted) {
                        setBusinessAccounts(accounts);
                        
                        // Try to get active account from session, or default to first account
                        let activeAccount = await getActiveBusinessAccountFromSession(userId);
                        if (!activeAccount && accounts.length > 0) {
                            activeAccount = accounts[0];
                        }
                        setActiveBusinessAccount(activeAccount);
                    }

                    // Fetch franchise if role requires it (legacy support)
                    if (prof.role === "franchise") {
                        const { data: fran, error: franErr } = await supabase
                            .from("franchises")
                            .select("*")
                            .eq("owner_id", userId)
                            .eq("is_active", true)
                            .maybeSingle();
                        if (isMounted && !franErr) {
                            setFranchise(fran as Franchise);
                        }
                    }
                }
            } catch (err) {
                console.error("[Auth] Unexpected error fetching data:", err);
            } finally {
                isFetching = false;
                if (isMounted) setIsLoading(false);
            }
        };

        const handleAuthSession = (session: any) => {
            if (session?.user) {
                setUser(session.user);
                loadProfileData(session.user.id);
            } else {
                setUser(null);
                setProfile(null);
                setFranchise(null);
                setIsLoading(false);
            }
        };

        // 1. Initial State Check
        supabase.auth.getSession().then(({ data: { session } }) => {
            if (isMounted) {
                handleAuthSession(session);
            }
        });

        // 2. Auth State Listener
        const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
            console.log("[Auth] onAuthStateChange event:", event);
            if (!isMounted) return;

            // We handle the initial state manually above
            if (event === 'INITIAL_SESSION') return;

            if (event === 'SIGNED_IN') {
                setIsLoading(true);
                handleAuthSession(session);
            } else if (event === 'SIGNED_OUT') {
                setUser(null);
                setProfile(null);
                setFranchise(null);
                setIsLoading(false);
            }
        });

        return () => {
            isMounted = false;
            subscription.unsubscribe();
        };
    }, []);

    const signIn = async (email: string, password: string) => {
        if (!supabase) return { error: "Supabase not available" };
        try {
            setAuthError(null); // Clear previous errors on new attempt
            const { error } = await supabase.auth.signInWithPassword({ email, password });
            if (error) return { error: error.message };
            return { error: null };
        } catch (err: any) {
            return { error: err.message || "Sign in failed" };
        }
    };

    const signOut = async () => {
        try {
            console.log("[Auth] Signing out...");
            if (supabase) {
                await supabase.auth.signOut();
            }
        } catch (err) {
            console.error("[Auth] signOut error (non-fatal):", err);
        }
        // Always clear local state regardless of Supabase response
        setUser(null);
        setProfile(null);
        setFranchise(null);
        setBusinessAccounts([]);
        setActiveBusinessAccount(null);
        setAuthError(null);
        console.log("[Auth] Local state cleared, redirecting to /login");
        // Force hard navigation to guarantee we reach login page
        window.location.href = "/login";
    };

    // Feature 1: Switch to different business account
    const switchBusinessAccount = async (accountId: string): Promise<{ error: string | null }> => {
        if (!supabase || !user) return { error: "Not authenticated" };
        
        try {
            // Update active account session
            const { error: sessionError } = await supabase
                .from("active_account_sessions")
                .upsert(
                    {
                        user_id: user.id,
                        business_account_id: accountId,
                        valid_until: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
                    },
                    { onConflict: "user_id" }
                );

            if (sessionError) throw sessionError;

            // Update local state with new active account
            const account = businessAccounts.find(acc => acc.id === accountId);
            if (account) {
                setActiveBusinessAccount(account);
                return { error: null };
            }

            return { error: "Account not found" };
        } catch (err: any) {
            console.error("[Auth] Error switching account:", err);
            return { error: err.message || "Failed to switch account" };
        }
    };

    // Feature 1: Get all business accounts for current user
    const getBusinessAccounts = async (): Promise<BusinessAccount[]> => {
        if (!supabase || !user) return [];
        try {
            const accounts = await fetchBusinessAccounts(user.id);
            return accounts;
        } catch (err) {
            console.error("[Auth] Error getting business accounts:", err);
            return [];
        }
    };

    // Feature 1: Create new business account
    const createBusinessAccount = async (businessName: string, businessType: string): Promise<{ error: string | null; account?: BusinessAccount }> => {
        if (!supabase || !user) return { error: "Not authenticated" };

        try {
            // Validate business type
            if (!["standalone_shop", "franchise_admin", "franchise_unit"].includes(businessType)) {
                return { error: "Invalid business type" };
            }

            const { data: account, error } = await supabase
                .from("business_accounts")
                .insert({
                    owner_id: user.id,
                    business_name: businessName,
                    business_type: businessType,
                    display_name: businessName,
                    is_active: true,
                })
                .select()
                .single();

            if (error) throw error;

            // Create default permissions
            await supabase
                .from("permissions")
                .insert({
                    profile_id: user.id,
                    business_account_id: account.id,
                    role: "owner",
                    scope: "all",
                    can_read: true,
                    can_write: true,
                    can_delete: true,
                });

            // Update business accounts list
            const updatedAccounts = await fetchBusinessAccounts(user.id);
            setBusinessAccounts(updatedAccounts);

            // If this is the first account, set it as active
            if (businessAccounts.length === 0) {
                setActiveBusinessAccount(account);
            }

            return { error: null, account: account as BusinessAccount };
        } catch (err: any) {
            console.error("[Auth] Error creating business account:", err);
            return { error: err.message || "Failed to create business account" };
        }
    };

    const createFranchiseUser = async (
        email: string,
        password: string,
        fullName: string,
        franchiseName: string,
        region: string,
        state: string
    ) => {
        if (!supabase) return { error: "Supabase not available" };

        try {
            // 1. Create auth user with metadata (uses signUp with anon key)
            const { data: authData, error: authError } = await supabase.auth.signUp({
                email,
                password,
                options: {
                    data: { role: "franchise", full_name: fullName },
                },
            });

            if (authError) return { error: authError.message };
            if (!authData.user) return { error: "Failed to create user" };

            const newUserId = authData.user.id;

            // 2. Create franchise record
            const { data: franchiseData, error: franchiseError } = await supabase
                .from("franchises")
                .insert({
                    name: franchiseName,
                    region,
                    state,
                    owner_id: newUserId,
                    created_by: user?.id,
                })
                .select()
                .single();

            if (franchiseError) return { error: franchiseError.message };

            return { error: null, franchise: franchiseData as Franchise };
        } catch (err: any) {
            return { error: err.message || "Failed to create franchise" };
        }
    };

    const getAllFranchises = async (): Promise<Franchise[]> => {
        if (!supabase) return [];
        try {
            const { data, error } = await supabase
                .from("franchises")
                .select("*")
                .order("created_at", { ascending: false });
            if (error) throw error;
            return (data || []) as Franchise[];
        } catch (err) {
            console.error("Error fetching franchises:", err);
            return [];
        }
    };

    const updateFranchise = async (id: string, updates: Partial<Franchise>): Promise<boolean> => {
        if (!supabase) return false;
        try {
            const { error } = await supabase
                .from("franchises")
                .update(updates)
                .eq("id", id);
            if (error) throw error;
            return true;
        } catch (err) {
            console.error("Error updating franchise:", err);
            return false;
        }
    };

    return (
        <AuthContext.Provider
            value={{
                user,
                profile,
                franchise,
                activeBusinessAccount,
                businessAccounts,
                isLoading,
                isAdmin: profile?.role === "admin",
                error: authError,
                signIn,
                signOut,
                createFranchiseUser,
                getAllFranchises,
                updateFranchise,
                switchBusinessAccount,
                getBusinessAccounts,
                createBusinessAccount,
            }}
        >
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error("useAuth must be used within an AuthProvider");
    }
    return context;
}
