import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../context/AuthContext";
import { AlertCircle, CheckCircle2, Clock, IndianRupee, ShoppingBag } from "lucide-react";

interface UnpaidReadyToken {
  token_number: number;
  customer_name: string;
  status: string;
  ready_at: string;
  total_amount: number;
}

function formatReadyTime(ts: string) {
  const minutes = Math.floor((Date.now() - new Date(ts).getTime()) / 60000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  return `${Math.floor(minutes / 60)}h ago`;
}

function readyMinutes(ts: string) {
  return Math.floor((Date.now() - new Date(ts).getTime()) / 60000);
}

export function TokenTracker() {
  const { activeBusinessAccount } = useAuth();
  const [unpaidTokens, setUnpaidTokens] = useState<UnpaidReadyToken[]>([]);
  const [loading, setLoading] = useState(true);
  const [, tick] = useState(0);

  // Refresh relative timestamps every 30 s
  useEffect(() => {
    const t = setInterval(() => tick(n => n + 1), 30_000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (!activeBusinessAccount) return;

    const fetchUnpaidTokens = async () => {
      try {
        const { data, error } = await supabase!.rpc("get_ready_unpaid_tokens", {
          p_business_account_id: activeBusinessAccount.id,
        });
        if (error) throw error;
        setUnpaidTokens(data || []);
      } catch {
        setUnpaidTokens([]);
      } finally {
        setLoading(false);
      }
    };

    fetchUnpaidTokens();

    const channel = supabase!
      .channel(`unpaid_tokens:${activeBusinessAccount.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "order_tokens", filter: `business_account_id=eq.${activeBusinessAccount.id}` },
        fetchUnpaidTokens
      )
      .subscribe();

    return () => { supabase!.removeChannel(channel); };
  }, [activeBusinessAccount?.id]);

  const totalPending = unpaidTokens.reduce((s, t) => s + t.total_amount, 0);
  const avgWait =
    unpaidTokens.length > 0
      ? Math.round(unpaidTokens.reduce((s, t) => s + readyMinutes(t.ready_at), 0) / unpaidTokens.length)
      : 0;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48 text-slate-400 text-sm gap-2">
        <Clock className="w-4 h-4 animate-spin" />
        Loading orders…
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ShoppingBag className="w-5 h-5 text-emerald-400" />
          <h2 className="text-lg font-bold text-white">Ready for Pickup</h2>
        </div>
        {unpaidTokens.length > 0 && (
          <span className="flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/25">
            <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" />
            {unpaidTokens.length} waiting
          </span>
        )}
      </div>

      {/* ── Order rows ── */}
      {unpaidTokens.length > 0 ? (
        <div className="space-y-2.5">
          {unpaidTokens.map((token, idx) => {
            const wait = readyMinutes(token.ready_at);
            const isUrgent = wait >= 10;

            return (
              <div
                key={idx}
                className={[
                  "rounded-2xl p-4 flex items-center gap-4",
                  "border-l-4 transition-all",
                  isUrgent
                    ? "bg-[#1f0f00] border-orange-400 ring-1 ring-orange-500/20"
                    : "bg-[#041a0f] border-emerald-500",
                ].join(" ")}
              >
                {/* Token # */}
                <div className="flex-shrink-0 text-center w-14">
                  <div className={`text-3xl font-black leading-none ${isUrgent ? "text-orange-400" : "text-emerald-400"}`}>
                    #{token.token_number}
                  </div>
                  <div className="text-[10px] text-white/30 uppercase tracking-wider mt-0.5">Token</div>
                </div>

                {/* Customer + wait */}
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-sm text-white/90 truncate">
                    {token.customer_name || "Customer"}
                  </div>
                  <div className={`flex items-center gap-1 text-[11px] mt-0.5 ${isUrgent ? "text-orange-300" : "text-white/40"}`}>
                    <Clock className="w-3 h-3" />
                    Ready {formatReadyTime(token.ready_at)}
                    {isUrgent && <span className="ml-1 font-bold text-orange-400">⚠ Waiting {wait}m</span>}
                  </div>
                </div>

                {/* Amount */}
                <div className="flex-shrink-0 text-right">
                  <div className="flex items-center gap-0.5 font-bold text-base text-white/90">
                    <IndianRupee className="w-3.5 h-3.5 text-white/50" />
                    {token.total_amount.toFixed(0)}
                  </div>
                  <div className="text-[10px] text-white/30 mt-0.5">Due</div>
                </div>

                {/* Status pill */}
                <div className="flex-shrink-0">
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/20">
                    <CheckCircle2 className="w-3 h-3" />
                    {token.status.toUpperCase()}
                  </span>
                </div>

                {/* Alert dot */}
                {isUrgent && (
                  <AlertCircle className="flex-shrink-0 w-5 h-5 text-orange-400" />
                )}
              </div>
            );
          })}
        </div>
      ) : (
        /* ── Empty state ── */
        <div className="rounded-2xl p-8 text-center bg-[#041a0f] border border-emerald-900/40">
          <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto mb-3 opacity-70" />
          <p className="font-semibold text-emerald-300">All caught up!</p>
          <p className="text-xs text-white/30 mt-1">No orders waiting for pickup right now.</p>
        </div>
      )}

      {/* ── Summary footer ── */}
      {unpaidTokens.length > 0 && (
        <div className="rounded-2xl grid grid-cols-3 divide-x divide-white/5 overflow-hidden bg-[#111419] border border-white/5">
          {[
            { label: "Pending", value: unpaidTokens.length.toString(), sub: "orders" },
            { label: "Revenue", value: `₹${totalPending.toFixed(0)}`, sub: "pending" },
            { label: "Avg Wait", value: `${avgWait}m`, sub: "avg time" },
          ].map(s => (
            <div key={s.label} className="py-3 px-4 text-center">
              <div className="text-xl font-black text-white/80">{s.value}</div>
              <div className="text-[10px] text-white/30 uppercase tracking-wider mt-0.5">{s.sub}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
