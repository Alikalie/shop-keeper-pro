import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useShop } from "@/hooks/useShop";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Save, Store, Receipt, Phone, Upload, Image } from "lucide-react";

export default function ShopSettings() {
  const { shop, isOwner, refetch } = useShop();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [formData, setFormData] = useState({
    name: "",
    address: "",
    phone: "",
    currency: "Le",
    receipt_footer: "",
  });
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);

  useEffect(() => {
    if (shop) {
      setFormData({
        name: shop.name || "",
        address: shop.address || "",
        phone: shop.phone || "",
        currency: shop.currency || "Le",
        receipt_footer: shop.receipt_footer || "Thank you for shopping with us!",
      });
      if (shop.logo_url) setLogoPreview(shop.logo_url);
    }
  }, [shop]);

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !shop) return;

    setUploading(true);
    try {
      const ext = file.name.split(".").pop();
      const path = `${shop.id}/logo.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from("shop-logos")
        .upload(path, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from("shop-logos")
        .getPublicUrl(path);

      await supabase.from("shops").update({ logo_url: publicUrl }).eq("id", shop.id);
      setLogoPreview(publicUrl);
      await refetch();
      toast({ title: "Logo uploaded successfully" });
    } catch (err) {
      toast({ variant: "destructive", title: "Upload failed", description: (err as Error).message });
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async () => {
    if (!shop) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from("shops")
        .update({
          name: formData.name,
          address: formData.address,
          phone: formData.phone,
          currency: formData.currency,
          receipt_footer: formData.receipt_footer,
        })
        .eq("id", shop.id);

      if (error) throw error;
      await refetch();
      toast({ title: "Settings Saved", description: "Your shop settings have been updated." });
    } catch (error) {
      toast({ variant: "destructive", title: "Error", description: "Failed to save settings" });
    } finally {
      setSaving(false);
    }
  };

  if (!isOwner) {
    return (
      <div className="text-center py-12">
        <Store className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
        <h2 className="text-2xl font-bold text-foreground">Access Denied</h2>
        <p className="text-muted-foreground mt-2">Only shop owners can manage shop settings.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Shop Settings</h1>
          <p className="text-muted-foreground">Configure your shop details and preferences</p>
        </div>
        <Button onClick={handleSave} disabled={saving}>
          <Save className="mr-2 h-4 w-4" />
          {saving ? "Saving..." : "Save Changes"}
        </Button>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Logo Upload */}
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Image className="h-5 w-5" />
              Shop Logo
            </CardTitle>
            <CardDescription>Upload your logo — it will appear on all receipts</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-6">
              <div className="w-24 h-24 rounded-xl border-2 border-dashed border-border flex items-center justify-center bg-muted/30 overflow-hidden">
                {logoPreview ? (
                  <img src={logoPreview} alt="Shop logo" className="w-full h-full object-contain" />
                ) : (
                  <Store className="h-8 w-8 text-muted-foreground" />
                )}
              </div>
              <div>
                <Button
                  variant="outline"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                >
                  <Upload className="mr-2 h-4 w-4" />
                  {uploading ? "Uploading..." : "Upload Logo"}
                </Button>
                <p className="text-xs text-muted-foreground mt-2">PNG, JPG, SVG — max 2MB</p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleLogoUpload}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Shop Info */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Store className="h-5 w-5" />
              Shop Information
            </CardTitle>
            <CardDescription>Basic details about your shop</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Shop Name</Label>
              <Input id="name" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} placeholder="My Shop" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="address">Address</Label>
              <Textarea id="address" value={formData.address} onChange={(e) => setFormData({ ...formData, address: e.target.value })} placeholder="123 Main Street, Freetown" rows={2} />
            </div>
          </CardContent>
        </Card>

        {/* Contact */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Phone className="h-5 w-5" />
              Contact Details
            </CardTitle>
            <CardDescription>How customers can reach you</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="phone">Phone Number</Label>
              <Input id="phone" value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} placeholder="+232 XX XXX XXXX" />
            </div>
          </CardContent>
        </Card>

        {/* Receipt Settings */}
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Receipt className="h-5 w-5" />
              Receipt Settings
            </CardTitle>
            <CardDescription>Customize your printed receipts (A5 landscape — 2 per A4 sheet)</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="currency">Currency Symbol</Label>
                <Input id="currency" value={formData.currency} onChange={(e) => setFormData({ ...formData, currency: e.target.value })} placeholder="Le" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="receipt_footer">Receipt Footer Message</Label>
                <Input id="receipt_footer" value={formData.receipt_footer} onChange={(e) => setFormData({ ...formData, receipt_footer: e.target.value })} placeholder="Thank you for shopping with us!" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
