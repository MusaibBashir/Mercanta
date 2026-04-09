import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../context/AuthContext";
import { Badge } from "../components/ui/badge";
import {
  AlertCircle,
  Clock,
  CheckCircle2,
  ChefHat,
  Bell,
  Loader2,
  UtensilsCrossed,
  Flame,
} from "lucide-react";
import { toast } from "sonner";

interface Token {
  id: string;
  token_number: number;
  status: "ordered" | "confirmed" | "preparing" | "prepared" | "ready" | "served" | "cancelled";
  customer_name: string;
  customer_phone?: string;
  order_items: string;
  notes?: string;
  created_at: string;
  prepared_by_name?: string;
}

/* ─────────────────────── helpers ─────────────────────── */

function WhatsAppBadge() {
  return (
    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-green-500 text-white leading-none">
      <svg viewBox="0 0 24 24" className="w-3 h-3 fill-current" xmlns="http://www.w3.org/2000/svg">
        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
      </svg>
      WA
    </span>
  );
}

const STATUS_META: Record<
  string,
  {
    label: string;
    cardBg: string;
    cardBorder: string;
    badgeBg: string;
    badgeText: string;
    glowColor: string;
    icon: React.ReactNode;
    actionBg: string;
    actionHover: string;
    actionLabel: string;
    nextStatus: string | null;
  }
> = {
  ordered: {
    label: "Ordered",
    cardBg: "bg-[#0f1f38]",
    cardBorder: "border-l-4 border-blue-500",
    badgeBg: "bg-blue-500/20",
    badgeText: "text-blue-300",
    glowColor: "shadow-blue-900/50",
    icon: <Bell className="w-4 h-4" />,
    actionBg: "bg-blue-600",
    actionHover: "hover:bg-blue-500",
    actionLabel: "Start Preparing",
    nextStatus: "preparing",
  },
  confirmed: {
    label: "Confirmed",
    cardBg: "bg-[#0f1f38]",
    cardBorder: "border-l-4 border-indigo-500",
    badgeBg: "bg-indigo-500/20",
    badgeText: "text-indigo-300",
    glowColor: "shadow-indigo-900/50",
    icon: <CheckCircle2 className="w-4 h-4" />,
    actionBg: "bg-indigo-600",
    actionHover: "hover:bg-indigo-500",
    actionLabel: "Start Preparing",
    nextStatus: "preparing",
  },
  preparing: {
    label: "Preparing",
    cardBg: "bg-[#1f1205]",
    cardBorder: "border-l-4 border-orange-400",
    badgeBg: "bg-orange-500/20",
    badgeText: "text-orange-300",
    glowColor: "shadow-orange-900/50",
    icon: <Flame className="w-4 h-4" />,
    actionBg: "bg-amber-500",
    actionHover: "hover:bg-amber-400",
    actionLabel: "Mark Prepared",
    nextStatus: "prepared",
  },
  prepared: {
    label: "Prepared",
    cardBg: "bg-[#1c1700]",
    cardBorder: "border-l-4 border-yellow-400",
    badgeBg: "bg-yellow-500/20",
    badgeText: "text-yellow-300",
    glowColor: "shadow-yellow-900/50",
    icon: <ChefHat className="w-4 h-4" />,
    actionBg: "bg-emerald-600",
    actionHover: "hover:bg-emerald-500",
    actionLabel: "Ready for Pickup",
    nextStatus: "ready",
  },
  ready: {
    label: "Ready",
    cardBg: "bg-[#041a0f]",
    cardBorder: "border-l-4 border-emerald-400",
    badgeBg: "bg-emerald-500/20",
    badgeText: "text-emerald-300",
    glowColor: "shadow-emerald-900/50",
    icon: <CheckCircle2 className="w-4 h-4" />,
    actionBg: "bg-slate-600",
    actionHover: "hover:bg-slate-500",
    actionLabel: "Mark Served",
    nextStatus: "served",
  },
  served: {
    label: "Served",
    cardBg: "bg-[#111219]",
    cardBorder: "border-l-4 border-slate-600",
    badgeBg: "bg-slate-700/50",
    badgeText: "text-slate-400",
    glowColor: "shadow-none",
    icon: <UtensilsCrossed className="w-4 h-4" />,
    actionBg: "bg-slate-700",
    actionHover: "hover:bg-slate-600",
    actionLabel: "",
    nextStatus: null,
  },
  cancelled: {
    label: "Cancelled",
    cardBg: "bg-[#200a0a]",
    cardBorder: "border-l-4 border-red-700",
    badgeBg: "bg-red-900/40",
    badgeText: "text-red-300",
    glowColor: "shadow-none",
    icon: <AlertCircle className="w-4 h-4" />,
    actionBg: "bg-red-800",
    actionHover: "hover:bg-red-700",
    actionLabel: "",
    nextStatus: null,
  },
};

const SUMMARY_CARDS = [
  { key: "ordered",  label: "New Orders",  gradFrom: "#1e3a5f", gradTo: "#1a2f50", accent: "#60a5fa", dot: "bg-blue-400" },
  { key: "preparing",label: "Preparing",   gradFrom: "#3b1c00", gradTo: "#2d1500", accent: "#fb923c", dot: "bg-orange-400" },
  { key: "prepared", label: "Prepared",    gradFrom: "#2e2400", gradTo: "#221b00", accent: "#facc15", dot: "bg-yellow-400" },
  { key: "ready",    label: "Ready",       gradFrom: "#053a20", gradTo: "#042e18", accent: "#34d399", dot: "bg-emerald-400" },
];

function formatTime(dateString: string) {
  return new Date(dateString).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
}

function calcWait(createdAt: string) {
  return Math.floor((Date.now() - new Date(createdAt).getTime()) / 60000);
}

/* ─────────────────────── main component ─────────────────────── */

export function KitchenDisplaySystem() {
  const { activeBusinessAccount } = useAuth();
  const [tokens, setTokens] = useState<Token[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingTokenId, setUpdatingTokenId] = useState<string | null>(null);
  const [, tick] = useState(0); // for live wait-time refresh

  // Live clock tick every 30s to refresh wait times
  useEffect(() => {
    const t = setInterval(() => tick(n => n + 1), 30_000);
    return () => clearInterval(t);
  }, []);

  const fetchTokens = async () => {
    if (!activeBusinessAccount) return;
    try {
      const { data, error } = await supabase!.rpc("get_active_tokens", {
        p_business_account_id: activeBusinessAccount.id,
      });
      if (error) throw error;
      setTokens(data || []);
    } catch {
      toast.error("Failed to load tokens");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!activeBusinessAccount) return;
    fetchTokens();
    const channel = supabase!
      .channel(`tokens:${activeBusinessAccount.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "order_tokens", filter: `business_account_id=eq.${activeBusinessAccount.id}` }, fetchTokens)
      .subscribe();
    return () => { supabase!.removeChannel(channel); };
  }, [activeBusinessAccount?.id]);

  const updateTokenStatus = async (tokenId: string, newStatus: string) => {
    setUpdatingTokenId(tokenId);
    try {
      const { error } = await supabase!.rpc("update_token_status", {
        p_token_id: tokenId,
        p_new_status: newStatus,
        p_reason: "Updated from KDS",
      });
      if (error) throw error;
      toast.success(`Marked as ${newStatus}`);
      playBeep();
      await fetchTokens();
    } catch (err) {
      toast.error(`Failed: ${err instanceof Error ? err.message : "Unknown error"}`);
    } finally {
      setUpdatingTokenId(null);
    }
  };

  const playBeep = () => {
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      osc.frequency.value = 880; osc.type = "sine";
      gain.gain.setValueAtTime(0.25, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.12);
      osc.start(); osc.stop(ctx.currentTime + 0.12);
    } catch { /* ignore audio errors */ }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0a0d14]">
        <div className="flex flex-col items-center gap-3 text-slate-400">
          <Loader2 className="w-10 h-10 animate-spin text-indigo-400" />
          <p className="text-sm font-medium tracking-wider uppercase">Loading Kitchen Display…</p>
        </div>
      </div>
    );
  }

  const grouped = {
    ordered:  tokens.filter(t => t.status === "ordered" || t.status === "confirmed"),
    preparing:tokens.filter(t => t.status === "preparing"),
    prepared: tokens.filter(t => t.status === "prepared"),
    ready:    tokens.filter(t => t.status === "ready"),
  };

  const urgentCount = tokens.filter(t =>
    calcWait(t.created_at) >= 15 && !["ready","served","cancelled"].includes(t.status)
  ).length;

  return (
    <div className="min-h-screen text-white" style={{ background: "linear-gradient(175deg, #080b12 0%, #0c1018 60%, #070a0f 100%)" }}>

      {/* ── HEADER ── dramatically attention-seeking ── */}
      <header className="sticky top-0 z-20" style={{ background: "rgba(6,8,14,0.95)", borderBottom: "1px solid rgba(255,255,255,0.06)", backdropFilter: "blur(16px)" }}>
        {/* Glowing accent strip */}
        <div className="h-0.5 w-full" style={{ background: "linear-gradient(90deg, #f97316 0%, #ef4444 30%, #a855f7 60%, #3b82f6 100%)" }} />

        <div className="flex items-center justify-between px-5 pt-4 pb-3 gap-4">
          {/* Left: brand + title */}
          <div className="flex items-center gap-3 min-w-0">
            <div className="relative flex-shrink-0">
              <div className="w-11 h-11 rounded-2xl flex items-center justify-center shadow-xl" style={{ background: "linear-gradient(135deg, #f97316, #ef4444)" }}>
                <ChefHat className="w-6 h-6 text-white" />
              </div>
              {/* Glow ring */}
              <div className="absolute inset-0 rounded-2xl" style={{ boxShadow: "0 0 18px 4px rgba(249,115,22,0.35)" }} />
            </div>
            <div>
              <h1 className="text-xl font-black tracking-tight leading-none text-white">Kitchen Display</h1>
              <p className="text-[11px] text-slate-500 mt-0.5 font-medium">Live order queue</p>
            </div>
          </div>

          {/* Centre: urgent badge — shown when orders are overdue */}
          {urgentCount > 0 && (
            <div className="flex items-center gap-2 px-4 py-2 rounded-2xl font-black text-sm animate-pulse"
              style={{ background: "rgba(239,68,68,0.15)", border: "1px solid rgba(239,68,68,0.4)", color: "#f87171" }}>
              <AlertCircle className="w-4 h-4" />
              {urgentCount} OVERDUE
            </div>
          )}

          {/* Right: live pill + total active */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <span className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-300 bg-emerald-500/10 border border-emerald-500/25 px-3 py-1.5 rounded-full">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              LIVE
            </span>
            <span className="inline-flex items-center gap-1 text-xs font-bold text-white/60 bg-white/5 border border-white/8 px-3 py-1.5 rounded-full">
              {tokens.length} active
            </span>
          </div>
        </div>

        {/* Summary stat row — compact, inline below title */}
        <div className="grid grid-cols-4 divide-x divide-white/5 border-t border-white/5">
          {SUMMARY_CARDS.map(s => {
            const count = grouped[s.key as keyof typeof grouped]?.length ?? 0;
            return (
              <div key={s.key} className="py-2.5 px-4 text-center">
                <span className="text-2xl font-black" style={{ color: count > 0 ? s.accent : "rgba(255,255,255,0.15)" }}>{count}</span>
                <p className="text-[9px] font-bold uppercase tracking-widest mt-0.5" style={{ color: count > 0 ? s.accent : "rgba(255,255,255,0.2)" }}>{s.label}</p>
              </div>
            );
          })}
        </div>
      </header>

      <div className="px-5 py-6 space-y-8">

        {/* ── Token Grid ── */}
        {tokens.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-28 text-slate-600 gap-4">
            <UtensilsCrossed className="w-16 h-16 opacity-30" />
            <div className="text-center">
              <p className="text-xl font-semibold text-slate-500">Kitchen is all caught up!</p>
              <p className="text-sm mt-1 text-slate-600">No active orders right now.</p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {tokens.map(token => {
              const meta = STATUS_META[token.status] ?? STATUS_META.ordered;
              const waitMin = calcWait(token.created_at);
              const isUrgent = waitMin >= 15 && !["ready","served","cancelled"].includes(token.status);
              const isWA = token.customer_name === "WhatsApp Customer";
              const isUpdating = updatingTokenId === token.id;

              return (
                <div
                  key={token.id}
                  className={[
                    "rounded-2xl select-none transition-all duration-200",
                    meta.cardBg,
                    meta.cardBorder,
                    "shadow-lg",
                    meta.glowColor,
                    isUrgent ? "ring-1 ring-red-500/50 animate-[pulse_2s_ease-in-out_infinite]" : "",
                  ].join(" ")}
                >
                  <div className="p-4">
                    {/* Top row: token # + wait time */}
                    <div className="flex items-start justify-between mb-3">
                      <div
                        className="text-5xl font-black leading-none"
                        style={{ textShadow: "0 2px 12px rgba(0,0,0,0.5)" }}
                      >
                        #{token.token_number}
                      </div>
                      <div className={`flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full ${isUrgent ? "bg-red-500/20 text-red-300" : "bg-white/8 text-white/50"}`}>
                        <Clock className="w-3 h-3" />
                        {waitMin}m
                      </div>
                    </div>

                    {/* Status badge */}
                    <div className={`inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1 rounded-full mb-3 ${meta.badgeBg} ${meta.badgeText}`}>
                      {meta.icon}
                      {meta.label.toUpperCase()}
                    </div>

                    {/* Customer */}
                    <div className="mb-3">
                      <div className="flex items-center gap-1.5 font-semibold text-sm text-white/90">
                        {isWA && <WhatsAppBadge />}
                        <span className="truncate">{isWA ? "WhatsApp Order" : (token.customer_name || "Order")}</span>
                      </div>
                      {isWA && token.customer_phone && token.customer_phone !== 'null' && (
                        <p className="text-[11px] text-green-400 mt-0.5">📱 {token.customer_phone.replace(/^\+?91/, '')}</p>
                      )}
                    </div>

                    {/* Items */}
                    <div className="text-xs leading-relaxed text-white/75 line-clamp-4 mb-2">
                      {token.order_items}
                    </div>

                    {/* Notes */}
                    {token.notes && token.notes !== "WhatsApp order" && (
                      <div className="text-[11px] italic text-amber-300/70 bg-amber-500/8 border border-amber-500/15 rounded-lg px-2.5 py-1.5 mb-2">
                        📝 {token.notes}
                      </div>
                    )}

                    {/* Time ordered */}
                    <p className="text-[10px] text-white/30 mt-2">{formatTime(token.created_at)}</p>
                  </div>

                  {/* ── Action strip — always visible, no tap needed ── */}
                  {!["served","cancelled"].includes(token.status) && (
                    <div
                      className="border-t border-white/8 px-3 pb-3 pt-2.5 space-y-1.5"
                      onClick={e => e.stopPropagation()}
                    >
                      {/* PRIMARY: advance one step */}
                      {meta.nextStatus && (
                        <button
                          onClick={() => updateTokenStatus(token.id, meta.nextStatus!)}
                          disabled={isUpdating}
                          className={`w-full flex items-center justify-center gap-2 text-xs font-black py-2.5 rounded-xl shadow-md transition-all active:scale-95 ${meta.actionBg} ${meta.actionHover} text-white disabled:opacity-50`}
                        >
                          {isUpdating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : meta.icon}
                          {meta.actionLabel}
                        </button>
                      )}

                      {/* SKIP ROW: quick jump buttons */}
                      {(!["ready","served","cancelled"].includes(token.status)) && (
                        <div className="flex gap-1.5">
                          {/* Skip to Preparing — only if not already there or past */}
                          {["ordered","confirmed"].includes(token.status) && (
                            <button
                              onClick={() => updateTokenStatus(token.id, "preparing")}
                              disabled={isUpdating}
                              title="Skip to Preparing"
                              className="flex-1 flex items-center justify-center gap-1 text-[10px] font-bold py-1.5 rounded-lg bg-orange-500/15 hover:bg-orange-500/30 text-orange-300 border border-orange-500/20 transition-all active:scale-95 disabled:opacity-40"
                            >
                              <Flame className="w-3 h-3" /> Prep
                            </button>
                          )}

                          {/* Skip to Ready */}
                          {meta.nextStatus !== "ready" && (
                            <button
                              onClick={() => updateTokenStatus(token.id, "ready")}
                              disabled={isUpdating}
                              title="Skip to Ready"
                              className="flex-1 flex items-center justify-center gap-1 text-[10px] font-bold py-1.5 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/20 transition-all active:scale-95 disabled:opacity-40"
                            >
                              <CheckCircle2 className="w-3 h-3" /> Ready
                            </button>
                          )}

                          {/* Mark Served */}
                          <button
                            onClick={() => updateTokenStatus(token.id, "served")}
                            disabled={isUpdating}
                            title="Mark Served"
                            className="flex-1 flex items-center justify-center gap-1 text-[10px] font-bold py-1.5 rounded-lg bg-slate-600/20 hover:bg-slate-600/40 text-slate-400 border border-slate-600/20 transition-all active:scale-95 disabled:opacity-40"
                          >
                            <UtensilsCrossed className="w-3 h-3" /> Served
                          </button>
                        </div>
                      )}

                      {/* If already at ready: just a Served button */}
                      {token.status === "ready" && (
                        <button
                          onClick={() => updateTokenStatus(token.id, "served")}
                          disabled={isUpdating}
                          className="w-full flex items-center justify-center gap-2 text-xs font-bold py-2 rounded-xl bg-slate-600/30 hover:bg-slate-600/50 text-slate-300 border border-slate-600/20 transition-all active:scale-95 disabled:opacity-50"
                        >
                          <UtensilsCrossed className="w-3.5 h-3.5" /> Mark Served
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
