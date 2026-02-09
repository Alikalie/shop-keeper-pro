import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useShop } from "@/hooks/useShop";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Save, Globe, Type, FileText, Image } from "lucide-react";

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
  hero_subtitle: "The complete POS system for your retail business. Sell fast, print receipts, know who owes you, and see your daily reports — even when internet fails.",
  cta_text: "Get Started",
  footer_text: "Made with ❤️ for Sierra Leone retailers.",
  contact_email: "",
  contact_phone: "",
};

export default function WebsiteSettings() {
  const { shop, isOwner } = useShop();
  const { toast } = useToast();
  const [settings, setSettings] = useState<SiteSettings>(defaultSettings);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (shop && isOwner) {
      fetchSettings();
    }
  }, [shop, isOwner]);

  const fetchSettings = async () => {
    if (!shop) return;

    try {
      const { data, error } = await supabase
        .from("site_settings")
        .select("key, value")
        .eq("shop_id", shop.id);

      if (error) throw error;

      if (data && data.length > 0) {
        const loadedSettings = { ...defaultSettings };
        data.forEach((setting) => {
          if (setting.key in loadedSettings) {
            (loadedSettings as Record<string, string>)[setting.key] = setting.value || "";
          }
        });
        setSettings(loadedSettings);
      }
    } catch (error) {
      console.error("Error fetching settings:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!shop) return;

    setSaving(true);

    try {
      // Upsert each setting
      const settingsArray = Object.entries(settings).map(([key, value]) => ({
        shop_id: shop.id,
        key,
        value,
      }));

      for (const setting of settingsArray) {
        const { error } = await supabase
          .from("site_settings")
          .upsert(setting, { onConflict: "shop_id,key" });

        if (error) throw error;
      }

      toast({
        title: "Settings Saved",
        description: "Your website settings have been updated.",
      });
    } catch (error) {
      console.error("Error saving settings:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to save settings",
      });
    } finally {
      setSaving(false);
    }
  };

  const updateSetting = (key: keyof SiteSettings, value: string) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  };

  if (!isOwner) {
    return (
      <div className="text-center py-12">
        <Globe className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
        <h2 className="text-2xl font-bold text-foreground">Access Denied</h2>
        <p className="text-muted-foreground mt-2">Only shop owners can manage website settings.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Website Settings</h1>
          <p className="text-muted-foreground">Customize your public-facing website content</p>
        </div>
        <Button onClick={handleSave} disabled={saving}>
          <Save className="mr-2 h-4 w-4" />
          {saving ? "Saving..." : "Save Changes"}
        </Button>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Branding */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Type className="h-5 w-5" />
              Branding
            </CardTitle>
            <CardDescription>Your shop's identity</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="site_name">Site Name</Label>
              <Input
                id="site_name"
                value={settings.site_name}
                onChange={(e) => updateSetting("site_name", e.target.value)}
                placeholder="ABAF-SHOP"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="tagline">Tagline</Label>
              <Input
                id="tagline"
                value={settings.tagline}
                onChange={(e) => updateSetting("tagline", e.target.value)}
                placeholder="Made for Sierra Leone shops"
              />
            </div>
          </CardContent>
        </Card>

        {/* Hero Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Image className="h-5 w-5" />
              Hero Section
            </CardTitle>
            <CardDescription>Main landing page content</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="hero_title">Hero Title</Label>
              <Textarea
                id="hero_title"
                value={settings.hero_title}
                onChange={(e) => updateSetting("hero_title", e.target.value)}
                placeholder="Manage Your Shop..."
                rows={2}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="hero_subtitle">Hero Subtitle</Label>
              <Textarea
                id="hero_subtitle"
                value={settings.hero_subtitle}
                onChange={(e) => updateSetting("hero_subtitle", e.target.value)}
                placeholder="The complete POS system..."
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cta_text">CTA Button Text</Label>
              <Input
                id="cta_text"
                value={settings.cta_text}
                onChange={(e) => updateSetting("cta_text", e.target.value)}
                placeholder="Get Started"
              />
            </div>
          </CardContent>
        </Card>

        {/* Footer */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Footer
            </CardTitle>
            <CardDescription>Bottom of page content</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="footer_text">Footer Text</Label>
              <Input
                id="footer_text"
                value={settings.footer_text}
                onChange={(e) => updateSetting("footer_text", e.target.value)}
                placeholder="Made with ❤️..."
              />
            </div>
          </CardContent>
        </Card>

        {/* Contact */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Globe className="h-5 w-5" />
              Contact Information
            </CardTitle>
            <CardDescription>How customers can reach you</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="contact_email">Contact Email</Label>
              <Input
                id="contact_email"
                type="email"
                value={settings.contact_email}
                onChange={(e) => updateSetting("contact_email", e.target.value)}
                placeholder="contact@yourshop.com"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="contact_phone">Contact Phone</Label>
              <Input
                id="contact_phone"
                value={settings.contact_phone}
                onChange={(e) => updateSetting("contact_phone", e.target.value)}
                placeholder="+232 XX XXX XXXX"
              />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
