import { useState, useEffect } from "react";
import { useAuth, BusinessAccountSettings } from "../context/AuthContext";
import { supabase } from "../lib/supabaseClient";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { HamburgerMenu } from "../components/HamburgerMenu";
import { toast } from "sonner";
import { Save, Store, CreditCard, Phone, MapPin, Percent, Loader2 } from "lucide-react";

export function BusinessSettingsPage() {
  const { activeBusinessAccount } = useAuth();
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<BusinessAccountSettings>({});
  const [displayName, setDisplayName] = useState("");

  useEffect(() => {
    if (activeBusinessAccount) {
      setSettings(activeBusinessAccount.settings || {});
      setDisplayName(activeBusinessAccount.display_name || activeBusinessAccount.business_name || "");
    }
  }, [activeBusinessAccount?.id]);

  const set = (key: keyof BusinessAccountSettings, value: any) =>
    setSettings(prev => ({ ...prev, [key]: value }));

  const handleSave = async () => {
    if (!activeBusinessAccount || !supabase) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from("business_accounts")
        .update({ settings, display_name: displayName })
        .eq("id", activeBusinessAccount.id);

      if (error) throw error;
      toast.success("Settings saved. Reload to apply changes.");
    } catch (err: any) {
      toast.error(`Failed to save: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  if (!activeBusinessAccount) {
    return (
      <div className="flex items-center justify-center h-screen text-gray-500">
        No active business account.
      </div>
    );
  }

  return (
    <div className="min-h-screen page-bg font-inter pb-12">
      <div className="w-full max-w-2xl mx-auto px-4 py-8 space-y-6">

        {/* Header */}
        <div className="flex items-center gap-4">
          <HamburgerMenu />
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Business Settings</h1>
            <p className="text-sm text-gray-500">{activeBusinessAccount.business_name}</p>
          </div>
        </div>

        {/* Shop Identity */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Store className="w-4 h-4" /> Shop Identity
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label>Display Name</Label>
              <Input
                value={displayName}
                onChange={e => setDisplayName(e.target.value)}
                placeholder="e.g. MFS — Kolkata Branch"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Shop Address</Label>
              <Input
                value={settings.shop_address || ""}
                onChange={e => set("shop_address", e.target.value)}
                placeholder="e.g. 12 Park Street, Kolkata"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>City</Label>
                <Input
                  value={settings.shop_city || ""}
                  onChange={e => set("shop_city", e.target.value)}
                  placeholder="e.g. Kolkata"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Shop Phone</Label>
                <Input
                  value={settings.shop_phone || ""}
                  onChange={e => set("shop_phone", e.target.value)}
                  placeholder="e.g. 9876543210"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>GSTIN</Label>
              <Input
                value={settings.shop_gstin || ""}
                onChange={e => set("shop_gstin", e.target.value)}
                placeholder="e.g. 19AAAAA0000A1Z5"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Tagline (prints on receipts)</Label>
              <Input
                value={settings.shop_tagline || ""}
                onChange={e => set("shop_tagline", e.target.value)}
                placeholder="e.g. Thank you for dining with us!"
              />
            </div>
          </CardContent>
        </Card>

        {/* Payment */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <CreditCard className="w-4 h-4" /> Payment Settings
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label>Razorpay Publishable Key</Label>
              <Input
                value={settings.razorpay_key_id || ""}
                onChange={e => set("razorpay_key_id", e.target.value)}
                placeholder="rzp_live_xxxxxxxxxxxx"
              />
              <p className="text-xs text-gray-500">
                Your shop's own Razorpay key. Leave blank to use the platform default.
                <strong className="text-amber-600"> Never enter your secret key here.</strong>
              </p>
            </div>
          </CardContent>
        </Card>

        {/* POS Defaults */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Percent className="w-4 h-4" /> POS Defaults
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label>Default Tax Rate (%)</Label>
              <Input
                type="number"
                min={0}
                max={100}
                value={settings.default_tax_rate ?? ""}
                onChange={e => set("default_tax_rate", parseFloat(e.target.value) || 0)}
                placeholder="e.g. 5 for 5% GST"
              />
            </div>
          </CardContent>
        </Card>

        {/* WhatsApp */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Phone className="w-4 h-4" /> WhatsApp / Notifications
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label>WhatsApp Business Number</Label>
              <Input
                value={settings.whatsapp_number || ""}
                onChange={e => set("whatsapp_number", e.target.value)}
                placeholder="e.g. 919876543210 (with country code, no +)"
              />
              <p className="text-xs text-gray-500">
                Used by n8n workflows to send order notifications. Must match your WhatsApp Business account.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Save */}
        <Button
          onClick={handleSave}
          disabled={saving}
          className="w-full bg-emerald-600 hover:bg-emerald-700 gap-2"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Save Settings
        </Button>

      </div>
    </div>
  );
}
