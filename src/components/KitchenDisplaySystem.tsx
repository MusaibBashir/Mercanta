import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../context/AuthContext";
import { Button } from "../components/ui/button";
import { Card } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { AlertCircle, Clock, CheckCircle2, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface Token {
  id: string;
  token_number: number;
  status: 'ordered' | 'confirmed' | 'preparing' | 'prepared' | 'ready' | 'served' | 'cancelled';
  customer_name: string;
  order_items: string;
  notes?: string;
  created_at: string;
  prepared_by_name?: string;
}

export function KitchenDisplaySystem() {
  const { activeBusinessAccount } = useAuth();
  const [tokens, setTokens] = useState<Token[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedToken, setSelectedToken] = useState<string | null>(null);
  const [updatingTokenId, setUpdatingTokenId] = useState<string | null>(null);

  // Fetch active tokens
  const fetchTokens = async () => {
    if (!activeBusinessAccount) return;

    try {
      const { data, error } = await supabase.rpc('get_active_tokens', {
        p_business_account_id: activeBusinessAccount.id
      });

      if (error) throw error;
      setTokens(data || []);
    } catch (error) {
      console.error('Error fetching tokens:', error);
      toast.error('Failed to load tokens');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!activeBusinessAccount) return;

    fetchTokens();

    // Subscribe to real-time updates
    const channel = supabase
      .channel(`tokens:${activeBusinessAccount.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'order_tokens',
          filter: `business_account_id=eq.${activeBusinessAccount.id}`
        },
        () => {
          fetchTokens();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [activeBusinessAccount?.id]);

  // Handle status update
  const updateTokenStatus = async (tokenId: string, newStatus: string) => {
    setUpdatingTokenId(tokenId);
    try {
      const { data, error } = await supabase.rpc('update_token_status', {
        p_token_id: tokenId,
        p_new_status: newStatus,
        p_reason: 'Updated from KDS'
      });

      if (error) throw error;

      // Show success toast
      toast.success(`Token marked as ${newStatus}`);

      // Play notification sound
      playNotificationSound();

      // Refetch tokens immediately to ensure UI updates
      await fetchTokens();

      setSelectedToken(null);
    } catch (error) {
      console.error('Error updating token status:', error);
      toast.error(`Failed to update token: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setUpdatingTokenId(null);
    }
  };

  const playNotificationSound = () => {
    // Simple beep sound
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();
    
    oscillator.connect(gain);
    gain.connect(audioContext.destination);
    
    oscillator.frequency.value = 800;
    oscillator.type = 'sine';
    
    gain.gain.setValueAtTime(0.3, audioContext.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.1);
    
    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.1);
  };

  const getStatusColor = (status: string) => {
    switch(status) {
      case 'ordered': return 'bg-blue-100 text-blue-800';
      case 'confirmed': return 'bg-blue-50 text-blue-700';
      case 'preparing': return 'bg-orange-100 text-orange-800';
      case 'prepared': return 'bg-yellow-100 text-yellow-800';
      case 'ready': return 'bg-green-100 text-green-800';
      case 'served': return 'bg-gray-100 text-gray-800';
      case 'cancelled': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusIcon = (status: string) => {
    switch(status) {
      case 'preparing': return <Clock className="w-5 h-5" />;
      case 'ready': return <CheckCircle2 className="w-5 h-5" />;
      case 'served': return <CheckCircle2 className="w-5 h-5" />;
      default: return null;
    }
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  };

  const calculateWaitTime = (createdAt: string) => {
    const created = new Date(createdAt).getTime();
    const now = new Date().getTime();
    const minutes = Math.floor((now - created) / 60000);
    return minutes;
  };

  if (loading) {
    return <div className="flex items-center justify-center h-screen">Loading Kitchen Display System...</div>;
  }

  // Group tokens by status
  const groupedTokens = {
    preparing: tokens.filter(t => t.status === 'preparing'),
    prepared: tokens.filter(t => t.status === 'prepared'),
    ready: tokens.filter(t => t.status === 'ready'),
    ordered: tokens.filter(t => t.status === 'ordered' || t.status === 'confirmed')
  };

  return (
    <div className="p-6 min-h-screen text-white" style={{ background: "linear-gradient(160deg, #0f0f1a 0%, #1a1025 100%)" }}>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Kitchen Display</h1>
          <p className="text-sm text-gray-400 mt-1">Live order queue</p>
        </div>
      </div>

      {/* Status Summary */}
      <div className="grid grid-cols-4 gap-3 mb-8">
        {[
          { label: "Ordered",   count: groupedTokens.ordered.length,   color: "from-blue-600 to-blue-500" },
          { label: "Preparing", count: groupedTokens.preparing.length, color: "from-orange-600 to-orange-500" },
          { label: "Prepared",  count: groupedTokens.prepared.length,  color: "from-yellow-600 to-yellow-500" },
          { label: "Ready",     count: groupedTokens.ready.length,     color: "from-emerald-600 to-emerald-500" },
        ].map(s => (
          <div key={s.label} className={`rounded-2xl p-4 bg-gradient-to-br ${s.color} shadow-lg`}>
            <div className="text-xs font-semibold text-white/70 uppercase tracking-wider">{s.label}</div>
            <div className="text-4xl font-bold mt-1">{s.count}</div>
          </div>
        ))}
      </div>

      {/* Token Grid */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {tokens.map(token => (
          <Card 
            key={token.id}
            className={`p-4 cursor-pointer transform transition hover:scale-105 ${
              selectedToken === token.id ? 'ring-4 ring-yellow-400' : ''
            } ${getStatusColor(token.status)}`}
            onClick={() => setSelectedToken(token.id)}
          >
            {/* Token Number - Large */}
            <div className="text-5xl font-bold mb-2">#{token.token_number}</div>

            {/* Wait Time */}
            <div className="text-xs font-semibold mb-2">
              Wait: {calculateWaitTime(token.created_at)} min
            </div>

            {/* Status */}
            <div className="mb-3">
              <Badge className="text-sm">
                {getStatusIcon(token.status)}
                {token.status.toUpperCase()}
              </Badge>
            </div>

            {/* Customer Name */}
            <div className="font-semibold text-sm mb-2">
              {token.customer_name || 'Order'}
            </div>

            {/* Order Items */}
            <div className="text-xs mb-3 line-clamp-3">
              {token.order_items}
            </div>

            {/* Notes */}
            {token.notes && (
              <div className="text-xs italic mb-3 bg-black bg-opacity-20 p-2 rounded">
                {token.notes}
              </div>
            )}

            {/* Action Buttons */}
            {selectedToken === token.id && (
              <div className="flex flex-col gap-2 mt-4">
                {token.status !== 'preparing' && token.status !== 'prepared' && (
                  <Button
                    onClick={e => {
                      e.stopPropagation();
                      updateTokenStatus(token.id, 'preparing');
                    }}
                    disabled={updatingTokenId === token.id}
                    className="w-full text-xs"
                  >
                    {updatingTokenId === token.id && <Loader2 className="w-3 h-3 mr-2 animate-spin" />}
                    Start Preparing
                  </Button>
                )}
                {(token.status === 'preparing' || token.status === 'prepared') && (
                  <Button
                    onClick={e => {
                      e.stopPropagation();
                      updateTokenStatus(token.id, 'prepared');
                    }}
                    disabled={updatingTokenId === token.id}
                    className="w-full text-xs bg-yellow-600 hover:bg-yellow-700"
                  >
                    {updatingTokenId === token.id && <Loader2 className="w-3 h-3 mr-2 animate-spin" />}
                    Mark Prepared
                  </Button>
                )}
                {token.status !== 'ready' && (
                  <Button
                    onClick={e => {
                      e.stopPropagation();
                      updateTokenStatus(token.id, 'ready');
                    }}
                    disabled={updatingTokenId === token.id}
                    className="w-full text-xs bg-green-600 hover:bg-green-700"
                  >
                    {updatingTokenId === token.id && <Loader2 className="w-3 h-3 mr-2 animate-spin" />}
                    Ready for Pickup
                  </Button>
                )}
                {token.status !== 'served' && (
                  <Button
                    onClick={e => {
                      e.stopPropagation();
                      updateTokenStatus(token.id, 'served');
                    }}
                    disabled={updatingTokenId === token.id}
                    className="w-full text-xs bg-gray-600 hover:bg-gray-700"
                  >
                    {updatingTokenId === token.id && <Loader2 className="w-3 h-3 mr-2 animate-spin" />}
                    Mark Served
                  </Button>
                )}
              </div>
            )}
          </Card>
        ))}
      </div>

      {tokens.length === 0 && (
        <div className="flex items-center justify-center h-64 text-gray-400">
          <div className="text-center">
            <AlertCircle className="w-16 h-16 mx-auto mb-4 opacity-50" />
            <p className="text-lg">No active orders</p>
            <p className="text-sm">Kitchen is all caught up!</p>
          </div>
        </div>
      )}
    </div>
  );
}
