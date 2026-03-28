import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../context/AuthContext";
import { Button } from "../components/ui/button";
import { Card } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Switch } from "../components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { toast } from "sonner";

interface KDSSettings {
  id: string;
  business_account_id: string;
  auto_print_tokens: boolean;
  show_customer_name: boolean;
  show_order_notes: boolean;
  show_special_instructions: boolean;
  token_prefix: string;
  token_number_start: number;
  token_number_current: number;
  ready_notification_type: 'sound' | 'visual' | 'both';
  color_scheme: 'light' | 'dark';
  font_size: number;
  show_estimated_time: boolean;
  auto_reset_daily: boolean;
}

export function RestaurantSettings() {
  const { activeBusinessAccount } = useAuth();
  const [settings, setSettings] = useState<KDSSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  // Fetch settings
  useEffect(() => {
    if (!activeBusinessAccount) return;

    const fetchSettings = async () => {
      try {
        const { data, error } = await supabase!
          .from('kds_settings')
          .select('*')
          .eq('business_account_id', activeBusinessAccount.id)
          .single();

        if (error && error.code !== 'PGRST116') {
          throw error;
        }

        if (data) {
          setSettings(data);
        } else {
          // Create default settings
          const newSettings: Partial<KDSSettings> = {
            business_account_id: activeBusinessAccount.id,
            auto_print_tokens: true,
            show_customer_name: true,
            show_order_notes: true,
            show_special_instructions: false,
            token_prefix: 'T',
            token_number_start: 1,
            token_number_current: 0,
            ready_notification_type: 'both',
            color_scheme: 'dark',
            font_size: 16,
            show_estimated_time: false,
            auto_reset_daily: true
          };

          const { data: created } = await supabase!
            .from('kds_settings')
            .insert([newSettings])
            .select()
            .single();

          setSettings(created);
        }
      } catch (error) {
        console.error('Error fetching settings:', error);
        toast.error('Failed to load settings');
      } finally {
        setLoading(false);
      }
    };

    fetchSettings();
  }, [activeBusinessAccount?.id]);

  // Handle setting change
  const handleSettingChange = (key: keyof KDSSettings, value: any) => {
    if (settings) {
      setSettings({
        ...settings,
        [key]: value
      });
      setHasChanges(true);
    }
  };

  // Save settings
  const saveSettings = async () => {
    if (!settings || !activeBusinessAccount) return;

    setSaving(true);
    try {
      const { error } = await supabase!
        .from('kds_settings')
        .update({
          auto_print_tokens: settings.auto_print_tokens,
          show_customer_name: settings.show_customer_name,
          show_order_notes: settings.show_order_notes,
          show_special_instructions: settings.show_special_instructions,
          token_prefix: settings.token_prefix,
          ready_notification_type: settings.ready_notification_type,
          color_scheme: settings.color_scheme,
          font_size: settings.font_size,
          show_estimated_time: settings.show_estimated_time,
          auto_reset_daily: settings.auto_reset_daily,
          updated_at: new Date().toISOString()
        })
        .eq('id', settings.id);

      if (error) throw error;

      setHasChanges(false);
      toast.success('Settings saved successfully');
    } catch (error) {
      console.error('Error saving settings:', error);
      toast.error('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64">Loading settings...</div>;
  }

  if (!settings) {
    return <div className="text-center text-red-600">Error loading settings</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-3xl font-bold">Restaurant Settings</h2>
        {hasChanges && (
          <Button
            onClick={saveSettings}
            disabled={saving}
            className="bg-blue-600 hover:bg-blue-700"
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </Button>
        )}
      </div>

      <Tabs defaultValue="tokens" className="w-full">
        <TabsList>
          <TabsTrigger value="tokens">Token System</TabsTrigger>
          <TabsTrigger value="display">Display</TabsTrigger>
          <TabsTrigger value="notifications">Notifications</TabsTrigger>
          <TabsTrigger value="content">Content</TabsTrigger>
        </TabsList>

        {/* Token System Tab */}
        <TabsContent value="tokens" className="space-y-6">
          <Card className="p-6 space-y-4">
            <h3 className="text-xl font-semibold">Token Configuration</h3>

            {/* Auto Print Tokens */}
            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
              <div>
                <Label className="font-semibold">Auto Print Tokens</Label>
                <p className="text-sm text-gray-600">
                  Automatically print token when order is created
                </p>
              </div>
              <Switch
                checked={settings.auto_print_tokens}
                onCheckedChange={(checked: boolean) =>
                  handleSettingChange('auto_print_tokens', checked)
                }
              />
            </div>

            {/* Token Prefix */}
            <div className="p-4 bg-gray-50 rounded-lg">
              <Label htmlFor="token_prefix" className="font-semibold">
                Token Prefix
              </Label>
              <p className="text-sm text-gray-600 mb-2">
                Prefix for token numbers (e.g., T001, T002)
              </p>
              <div className="flex items-center gap-2">
                <Input
                  id="token_prefix"
                  value={settings.token_prefix}
                  onChange={(e) =>
                    handleSettingChange('token_prefix', e.target.value.toUpperCase())
                  }
                  maxLength={3}
                  className="w-20 text-center"
                />
                <span className="text-gray-600">
                  Preview: {settings.token_prefix}001, {settings.token_prefix}002
                </span>
              </div>
            </div>

            {/* Current Token Number */}
            <div className="p-4 bg-gray-50 rounded-lg">
              <Label className="font-semibold">Current Token Number</Label>
              <p className="text-sm text-gray-600 mb-2">
                Next token will be: {settings.token_prefix}
                {(settings.token_number_current + 1).toString().padStart(3, '0')}
              </p>
              <Input
                type="number"
                value={settings.token_number_current}
                onChange={(e) =>
                  handleSettingChange('token_number_current', parseInt(e.target.value))
                }
                className="max-w-[200px]"
              />
            </div>

            {/* Auto Reset Daily */}
            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
              <div>
                <Label className="font-semibold">Auto Reset Daily</Label>
                <p className="text-sm text-gray-600">
                  Reset token counter to 1 at midnight every day
                </p>
              </div>
              <Switch
                checked={settings.auto_reset_daily}
                onCheckedChange={(checked: boolean) =>
                  handleSettingChange('auto_reset_daily', checked)
                }
              />
            </div>
          </Card>
        </TabsContent>

        {/* Display Tab */}
        <TabsContent value="display" className="space-y-6">
          <Card className="p-6 space-y-4">
            <h3 className="text-xl font-semibold">Display Settings</h3>

            {/* Color Scheme */}
            <div className="p-4 bg-gray-50 rounded-lg">
              <Label htmlFor="color_scheme" className="font-semibold">
                Color Scheme
              </Label>
              <p className="text-sm text-gray-600 mb-2">
                Choose between light and dark mode for KDS
              </p>
              <Select
                value={settings.color_scheme}
                onValueChange={(value: string) =>
                  handleSettingChange('color_scheme', value as 'light' | 'dark')
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="light">Light Mode</SelectItem>
                  <SelectItem value="dark">Dark Mode</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Font Size */}
            <div className="p-4 bg-gray-50 rounded-lg">
              <Label htmlFor="font_size" className="font-semibold">
                Font Size
              </Label>
              <p className="text-sm text-gray-600 mb-2">
                Adjust font size for KDS display ({settings.font_size}px)
              </p>
              <div className="flex items-center gap-4">
                <input
                  type="range"
                  id="font_size"
                  min="12"
                  max="24"
                  value={settings.font_size}
                  onChange={(e) =>
                    handleSettingChange('font_size', parseInt(e.target.value))
                  }
                  className="flex-1"
                />
                <span className="font-semibold" style={{ fontSize: `${settings.font_size}px` }}>
                  Sample Text
                </span>
              </div>
            </div>

            {/* Show Estimated Time */}
            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
              <div>
                <Label className="font-semibold">Show Estimated Time</Label>
                <p className="text-sm text-gray-600">
                  Display estimated preparation time on KDS
                </p>
              </div>
              <Switch
                checked={settings.show_estimated_time}
                onCheckedChange={(checked: boolean) =>
                  handleSettingChange('show_estimated_time', checked)
                }
              />
            </div>
          </Card>
        </TabsContent>

        {/* Notifications Tab */}
        <TabsContent value="notifications" className="space-y-6">
          <Card className="p-6 space-y-4">
            <h3 className="text-xl font-semibold">Notification Settings</h3>

            {/* Notification Type */}
            <div className="p-4 bg-gray-50 rounded-lg">
              <Label htmlFor="notification_type" className="font-semibold">
                Ready Notification Type
              </Label>
              <p className="text-sm text-gray-600 mb-2">
                How to notify when order is ready
              </p>
              <Select
                value={settings.ready_notification_type}
                onValueChange={(value: string) =>
                  handleSettingChange('ready_notification_type', value as 'sound' | 'visual' | 'both')
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="sound">Sound Only</SelectItem>
                  <SelectItem value="visual">Visual Only</SelectItem>
                  <SelectItem value="both">Sound + Visual</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Test Button */}
            <div className="p-4 bg-blue-50 rounded-lg">
              <Button
                onClick={() => {
                  // Play test notification
                  const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
                  const oscillator = audioContext.createOscillator();
                  const gain = audioContext.createGain();
                  oscillator.connect(gain);
                  gain.connect(audioContext.destination);
                  oscillator.frequency.value = 800;
                  gain.gain.setValueAtTime(0.3, audioContext.currentTime);
                  gain.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.2);
                  oscillator.start(audioContext.currentTime);
                  oscillator.stop(audioContext.currentTime + 0.2);
                  toast.success('Test notification played');
                }}
                className="w-full"
              >
                Test Notification Sound
              </Button>
            </div>
          </Card>
        </TabsContent>

        {/* Content Tab */}
        <TabsContent value="content" className="space-y-6">
          <Card className="p-6 space-y-4">
            <h3 className="text-xl font-semibold">Display Content</h3>

            {/* Show Customer Name */}
            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
              <div>
                <Label className="font-semibold">Show Customer Name</Label>
                <p className="text-sm text-gray-600">
                  Display customer name on KDS
                </p>
              </div>
              <Switch
                checked={settings.show_customer_name}
                onCheckedChange={(checked: boolean) =>
                  handleSettingChange('show_customer_name', checked)
                }
              />
            </div>

            {/* Show Order Notes */}
            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
              <div>
                <Label className="font-semibold">Show Order Notes</Label>
                <p className="text-sm text-gray-600">
                  Display order notes/special requests on KDS
                </p>
              </div>
              <Switch
                checked={settings.show_order_notes}
                onCheckedChange={(checked: boolean) =>
                  handleSettingChange('show_order_notes', checked)
                }
              />
            </div>

            {/* Show Special Instructions */}
            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
              <div>
                <Label className="font-semibold">Show Special Instructions</Label>
                <p className="text-sm text-gray-600">
                  Display special instructions/allergies on KDS
                </p>
              </div>
              <Switch
                checked={settings.show_special_instructions}
                onCheckedChange={(checked: boolean) =>
                  handleSettingChange('show_special_instructions', checked)
                }
              />
            </div>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
