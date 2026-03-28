import { useEffect, useState, useCallback } from "react";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../context/AuthContext";
import { PageContainer } from "../components/layout/PageContainer";
import { Card, CardContent } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
import { Shield, RefreshCw, ChevronLeft, ChevronRight } from "lucide-react";
import { toast } from "sonner";

interface AuditEntry {
  id: string;
  table_name: string;
  record_id: string;
  operation: "INSERT" | "UPDATE" | "DELETE";
  old_data: Record<string, any> | null;
  new_data: Record<string, any> | null;
  changed_by: string | null;
  changed_by_email: string | null;
  business_account_id: string | null;
  changed_at: string;
}

const TABLE_LABELS: Record<string, string> = {
  sales:            "Sale",
  inventory:        "Inventory",
  restaurant_menu:  "Menu Item",
  menu_categories:  "Category",
  order_tokens:     "Order Token",
};

const OP_STYLES: Record<string, string> = {
  INSERT: "bg-green-100 text-green-800 border-0",
  UPDATE: "bg-blue-100 text-blue-800 border-0",
  DELETE: "bg-red-100 text-red-800 border-0",
};

function getSummary(entry: AuditEntry): string {
  const data = entry.new_data ?? entry.old_data;
  if (!data) return entry.record_id.slice(0, 8) + "…";

  switch (entry.table_name) {
    case "sales":
      return `${data.customer_name ?? "Customer"} — ₹${parseFloat(data.total ?? 0).toFixed(2)}`;
    case "inventory":
      return `${data.item_name ?? data.sku ?? "Item"} (qty: ${data.quantity ?? "?"})`;
    case "restaurant_menu":
      return `${data.item_name ?? "Item"} — ₹${parseFloat(data.price ?? 0).toFixed(2)}`;
    case "menu_categories":
      return data.category_name ?? "Category";
    case "order_tokens":
      return `Token #${data.token_number ?? "?"} — ${data.status ?? "?"}`;
    default:
      return entry.record_id.slice(0, 8) + "…";
  }
}

function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "2-digit",
  });
}

const PAGE_SIZE = 25;

export function AuditLogPage() {
  const { profile, activeBusinessAccount } = useAuth();
  const isAdmin = profile?.role === "admin";

  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [filterTable, setFilterTable] = useState("all");
  const [filterOp, setFilterOp] = useState("all");

  const fetchLogs = useCallback(
    async (pageNum: number) => {
      if (!supabase) return;
      setLoading(true);
      try {
        const { data, error } = await supabase!.rpc("get_audit_log", {
          p_business_account_id: isAdmin
            ? null
            : (activeBusinessAccount?.id ?? null),
          p_table_name: filterTable === "all" ? null : filterTable,
          p_operation: filterOp === "all" ? null : filterOp,
          p_limit: PAGE_SIZE + 1,
          p_offset: pageNum * PAGE_SIZE,
        });
        if (error) throw error;
        const rows = (data ?? []) as AuditEntry[];
        setHasMore(rows.length > PAGE_SIZE);
        setEntries(rows.slice(0, PAGE_SIZE));
      } catch (err) {
        console.error("Audit log fetch error:", err);
        toast.error("Failed to load audit log");
      } finally {
        setLoading(false);
      }
    },
    [isAdmin, activeBusinessAccount?.id, filterTable, filterOp]
  );

  // Reset to page 0 when filters change
  useEffect(() => {
    setPage(0);
  }, [filterTable, filterOp]);

  useEffect(() => {
    fetchLogs(page);
  }, [page, fetchLogs]);

  return (
    <PageContainer
      title="Audit Log"
      subtitle="Complete history of every data change across the system"
      icon={<Shield className="w-5 h-5 text-violet-600" />}
      iconBgColor="bg-violet-100"
    >
      {/* Filters row */}
      <div className="flex items-center gap-3 mb-6 flex-wrap">
        <Select value={filterTable} onValueChange={(v: string) => setFilterTable(v)}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder="All tables" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All tables</SelectItem>
            <SelectItem value="sales">Sales</SelectItem>
            <SelectItem value="inventory">Inventory</SelectItem>
            <SelectItem value="restaurant_menu">Menu Items</SelectItem>
            <SelectItem value="menu_categories">Categories</SelectItem>
            <SelectItem value="order_tokens">Order Tokens</SelectItem>
          </SelectContent>
        </Select>

        <Select value={filterOp} onValueChange={(v: string) => setFilterOp(v)}>
          <SelectTrigger className="w-36">
            <SelectValue placeholder="All ops" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All operations</SelectItem>
            <SelectItem value="INSERT">Insert</SelectItem>
            <SelectItem value="UPDATE">Update</SelectItem>
            <SelectItem value="DELETE">Delete</SelectItem>
          </SelectContent>
        </Select>

        <Button
          variant="outline"
          size="sm"
          onClick={() => fetchLogs(page)}
          disabled={loading}
        >
          <RefreshCw
            className={`w-4 h-4 mr-1.5 ${loading ? "animate-spin" : ""}`}
          />
          Refresh
        </Button>

        <span className="ml-auto text-xs text-gray-400">
          {isAdmin ? "Showing all accounts" : activeBusinessAccount?.display_name ?? ""}
        </span>
      </div>

      {/* Log table */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center h-48 text-gray-500 text-sm">
              Loading audit log…
            </div>
          ) : entries.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 text-gray-400 gap-2">
              <Shield className="w-10 h-10 opacity-30" />
              <p className="text-sm">No audit entries found</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-gray-50 text-xs">
                    <th className="text-left px-4 py-3 font-semibold text-gray-500 uppercase tracking-wide">
                      When
                    </th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-500 uppercase tracking-wide">
                      Table
                    </th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-500 uppercase tracking-wide">
                      Op
                    </th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-500 uppercase tracking-wide">
                      Record
                    </th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-500 uppercase tracking-wide">
                      By
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map((entry) => (
                    <tr
                      key={entry.id}
                      className="border-b last:border-0 hover:bg-gray-50 transition-colors"
                    >
                      <td className="px-4 py-3 text-gray-400 whitespace-nowrap">
                        {formatRelativeTime(entry.changed_at)}
                      </td>
                      <td className="px-4 py-3 font-medium text-gray-700">
                        {TABLE_LABELS[entry.table_name] ?? entry.table_name}
                      </td>
                      <td className="px-4 py-3">
                        <Badge
                          className={`text-xs font-bold ${OP_STYLES[entry.operation] ?? "bg-gray-100 text-gray-700 border-0"}`}
                        >
                          {entry.operation}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-gray-800 max-w-xs truncate">
                        {getSummary(entry)}
                      </td>
                      <td className="px-4 py-3 text-gray-400 truncate max-w-[180px] font-mono text-xs">
                        {entry.changed_by_email ?? "System"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pagination */}
      <div className="flex items-center justify-between mt-4">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setPage((p) => Math.max(0, p - 1))}
          disabled={page === 0 || loading}
        >
          <ChevronLeft className="w-4 h-4 mr-1" />
          Previous
        </Button>
        <span className="text-xs text-gray-500">Page {page + 1}</span>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setPage((p) => p + 1)}
          disabled={!hasMore || loading}
        >
          Next
          <ChevronRight className="w-4 h-4 ml-1" />
        </Button>
      </div>
    </PageContainer>
  );
}
