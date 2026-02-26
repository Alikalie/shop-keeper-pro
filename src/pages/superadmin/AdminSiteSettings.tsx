import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Save, Globe, Type, FileText, Store } from "lucide-react";

interface SiteSettings {
  site_name: string;
  tagline: string;
  hero_title: string;
  hero_subtitle: string;
  cta_text: string;
  footer_text: string;
  contact_email: string;
  contact_phone: string;
}

const defaultSettings: SiteSettings = {
  site_name: "ABAF-SHOP",
  tagline: "Made for Sierra Leone shops",
  hero_title: "Manage Your Shop. Track Sales. No Stress.",
  hero_subtitle: "The complete POS system for your retail business.",
  cta_text: "Get Started",
  footer_text: "Made with ❤️ for Sierra Leone retailers.",
  contact_email: "",
  contact_phone: "",
};

export default function AdminSiteSettings() {
  const { toast } = useToast();
  const [shops, setShops] = useState<{ id: string; name: string }[]>([]);
  const [selectedShopId, setSelectedShopId] = useState<string>("");
  const [settings, setSettings] = useState<SiteSettings>(defaultSettings);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchShops();
  }, []);

  useEffect(() => {
    if (selectedShopId) fetchSettings(selectedShopId);
  }, [selectedShopId]);

  const fetchShops = async () => {
    const { data } = await supabase.from("shops").select("id, name").order("name");
    setShops(data || []);
    if (data && data.length > 0) {
      setSelectedShopId(data[0].id);
    }
    setLoading(false);
  };

  const fetchSettings = async (shopId: string) => {
    setLoading(true);
    const { data } = await supabase
      .from("site_settings")
      .select("key, value")
      .eq("shop_id", shopId);

    const loaded = { ...defaultSettings };
    (data || []).forEach((s) => {
      if (s.key in loaded) {
        (loaded as Record<string, string>)[s.key] = s.value || "";
      }
    });
    setSettings(loaded);
    setLoading(false);
  };

  const handleSave = async () => {
    if (!selectedShopId) return;
    setSaving(true);
    try {
      const entries = Object.entries(settings).map(([key, value]) => ({
        shop_id: selectedShopId,
        key,
        value,
      }));

      for (const entry of entries) {
        const { error } = await supabase
          .from("site_settings")
          .upsert(entry, { onConflict: "shop_id,key" });
        if (error) throw error;
      }

      toast({ title: "Settings Saved", description: `Site settings updated for ${shops.find(s => s.id === selectedShopId)?.name}` });
    } catch (error: any) {
      toast({ variant: "destructive", title: "Error", description: error.message });
    } finally {
      setSaving(false);
    }
  };

  const update = (key: keyof SiteSettings, value: string) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Site Management</h1>
          <p className="text-muted-foreground">Update website content for any shop</p>
        </div>
        <Button onClick={handleSave} disabled={saving || !selectedShopId}>
          <Save className="mr-2 h-4 w-4" />
          {saving ? "Saving..." : "Save Changes"}
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Store className="h-5 w-5" />
            Select Shop
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Select value={selectedShopId} onValueChange={setSelectedShopId}>
            <SelectTrigger className="w-full max-w-xs">
              <SelectValue placeholder="Choose a shop" />
            </SelectTrigger>
            <SelectContent>
              {shops.map((s) => (
                <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {loading ? (
        <div className="flex justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Type className="h-5 w-5" />Branding</CardTitle>
              <CardDescription>Shop identity on public site</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Site Name</Label>
                <Input value={settings.site_name} onChange={(e) => update("site_name", e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Tagline</Label>
                <Input value={settings.tagline} onChange={(e) => update("tagline", e.target.value)} />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Globe className="h-5 w-5" />Hero Section</CardTitle>
              <CardDescription>Landing page content</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Hero Title</Label>
                <Textarea value={settings.hero_title} onChange={(e) => update("hero_title", e.target.value)} rows={2} />
              </div>
              <div className="space-y-2">
                <Label>Hero Subtitle</Label>
                <Textarea value={settings.hero_subtitle} onChange={(e) => update("hero_subtitle", e.target.value)} rows={3} />
              </div>
              <div className="space-y-2">
                <Label>CTA Button Text</Label>
                <Input value={settings.cta_text} onChange={(e) => update("cta_text", e.target.value)} />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><FileText className="h-5 w-5" />Footer</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Footer Text</Label>
                <Input value={settings.footer_text} onChange={(e) => update("footer_text", e.target.value)} />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Globe className="h-5 w-5" />Contact</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Contact Email</Label>
                <Input type="email" value={settings.contact_email} onChange={(e) => update("contact_email", e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Contact Phone</Label>
                <Input value={settings.contact_phone} onChange={(e) => update("contact_phone", e.target.value)} />
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
