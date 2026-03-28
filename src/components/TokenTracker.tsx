import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../context/AuthContext";
import { Card } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { AlertCircle, TrendingUp } from "lucide-react";

interface UnpaidReadyToken {
  token_number: number;
  customer_name: string;
  status: string;
  ready_at: string;
  total_amount: number;
}

export function TokenTracker() {
  const { activeBusinessAccount } = useAuth();
  const [unpaidTokens, setUnpaidTokens] = useState<UnpaidReadyToken[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!activeBusinessAccount) return;

    const fetchUnpaidTokens = async () => {
      try {
        const { data, error } = await supabase!.rpc('get_ready_unpaid_tokens', {
          p_business_account_id: activeBusinessAccount.id
        });

        if (error) throw error;
        setUnpaidTokens(data || []);
      } catch (error) {
        console.error('Error fetching unpaid tokens:', error);
        // Still close loading state even on error
        setUnpaidTokens([]);
      } finally {
        setLoading(false);
      }
    };

    fetchUnpaidTokens();

    // Subscribe to updates
    const channel = supabase!
      .channel(`unpaid_tokens:${activeBusinessAccount.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'order_tokens',
          filter: `business_account_id=eq.${activeBusinessAccount.id}`
        },
        () => {
          fetchUnpaidTokens();
        }
      )
      .subscribe();

    return () => {
      supabase!.removeChannel(channel);
    };
  }, [activeBusinessAccount?.id]);

  const formatAmount = (amount: number) => {
    return `₹${amount.toFixed(2)}`;
  };

  const formatReadyTime = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const minutes = Math.floor((now.getTime() - date.getTime()) / 60000);
    
    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    
    return date.toLocaleDateString();
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64">Loading...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-3xl font-bold">Orders Ready for Pickup</h2>
        <Badge className="text-lg px-4 py-2 bg-green-500">
          {unpaidTokens.length} Ready
        </Badge>
      </div>

      {unpaidTokens.length > 0 ? (
        <div className="space-y-3">
          {unpaidTokens.map((token, idx) => (
            <Card key={idx} className="p-4 border-l-4 border-orange-500">
              <div className="grid grid-cols-5 items-center gap-4">
                {/* Token Number */}
                <div className="text-center">
                  <div className="text-2xl font-bold text-orange-600">
                    #{token.token_number}
                  </div>
                  <div className="text-xs text-gray-500">Token</div>
                </div>

                {/* Customer */}
                <div>
                  <div className="font-semibold">{token.customer_name || 'Customer'}</div>
                  <div className="text-xs text-gray-500">Ready since {formatReadyTime(token.ready_at)}</div>
                </div>

                {/* Amount */}
                <div className="text-right">
                  <div className="font-semibold">{formatAmount(token.total_amount)}</div>
                  <div className="text-xs text-gray-500">Amount</div>
                </div>

                {/* Status */}
                <div className="text-center">
                  <Badge className="bg-green-100 text-green-800">
                    {token.status.toUpperCase()}
                  </Badge>
                </div>

                {/* Alert */}
                <div className="text-center">
                  <AlertCircle className="w-6 h-6 text-orange-500 mx-auto" />
                  <div className="text-xs text-gray-500 mt-1">Pending pickup</div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="p-8 text-center bg-green-50 border-green-200">
          <div className="flex justify-center mb-4">
            <TrendingUp className="w-12 h-12 text-green-600" />
          </div>
          <h3 className="text-xl font-semibold text-green-800 mb-2">All Caught Up!</h3>
          <p className="text-green-700">
            No orders waiting for payment. All ready orders have been picked up or paid.
          </p>
        </Card>
      )}

      {/* Summary Stats */}
      <Card className="p-4 bg-gradient-to-r from-orange-50 to-red-50">
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <div className="text-2xl font-bold text-orange-600">
              {unpaidTokens.length}
            </div>
            <div className="text-sm text-gray-600">Pending Orders</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-orange-600">
              {formatAmount(
                unpaidTokens.reduce((sum, t) => sum + t.total_amount, 0)
              )}
            </div>
            <div className="text-sm text-gray-600">Pending Revenue</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-orange-600">
              {unpaidTokens.length > 0
                ? Math.floor(
                    unpaidTokens.reduce((sum, t) => {
                      const ready = new Date(t.ready_at);
                      const now = new Date();
                      return sum + (now.getTime() - ready.getTime()) / 60000;
                    }, 0) / unpaidTokens.length
                  )
                : 0}{" "}
              min
            </div>
            <div className="text-sm text-gray-600">Avg Wait Time</div>
          </div>
        </div>
      </Card>
    </div>
  );
}
