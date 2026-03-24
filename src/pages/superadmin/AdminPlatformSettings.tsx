import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Save, Plus, Edit, Trash2, Sparkles, DollarSign, Zap } from "lucide-react";

interface PlanTier {
  id: string;
  name: string;
  price: string;
  period: string;
  features: string[];
  highlighted: boolean;
  enabled: boolean;
}

interface PlatformFeature {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  tier: string; // which plan tier it belongs to
}

const defaultPlans: PlanTier[] = [
  { id: "free", name: "Free", price: "0", period: "month", features: ["1 Staff", "50 Products", "Basic POS", "Daily Reports"], highlighted: false, enabled: true },
  { id: "personal", name: "Personal", price: "50,000", period: "month", features: ["5 Staff", "500 Products", "Full POS", "Loans & Credits", "PDF Reports"], highlighted: true, enabled: true },
  { id: "organization", name: "Organization", price: "150,000", period: "month", features: ["Unlimited Staff", "Unlimited Products", "Full POS", "All Features", "Priority Support", "API Access"], highlighted: false, enabled: true },
];

const defaultFeatures: PlatformFeature[] = [
  { id: "pos", name: "Point of Sale", description: "Full POS with receipt printing", enabled: true, tier: "free" },
  { id: "loans", name: "Loans & Credits", description: "Customer credit management", enabled: true, tier: "personal" },
  { id: "transfers", name: "Bank/Mobile Transfers", description: "Accept transfer payments", enabled: true, tier: "personal" },
  { id: "reports", name: "Advanced Reports", description: "PDF reports with profit margins", enabled: true, tier: "personal" },
  { id: "staff_perf", name: "Staff Performance", description: "Staff sales tracking & analytics", enabled: true, tier: "personal" },
  { id: "multi_staff", name: "Multi-Staff Access", description: "Multiple staff accounts per shop", enabled: true, tier: "personal" },
  { id: "api_access", name: "API Access", description: "External integrations via API", enabled: false, tier: "organization" },
  { id: "whitelabel", name: "White Label", description: "Custom branding for the shop", enabled: false, tier: "organization" },
];

export default function AdminPlatformSettings() {
  const { toast } = useToast();
  const [plans, setPlans] = useState<PlanTier[]>(defaultPlans);
  const [features, setFeatures] = useState<PlatformFeature[]>(defaultFeatures);
  const [demoTitle, setDemoTitle] = useState("See ABAF-SHOP in Action");
  const [demoDescription, setDemoDescription] = useState("Watch how easy it is to manage your shop with our complete POS system.");
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [editPlan, setEditPlan] = useState<PlanTier | null>(null);
  const [editFeature, setEditFeature] = useState<PlatformFeature | null>(null);

  useEffect(() => { loadSettings(); }, []);

  const loadSettings = async () => {
    try {
      const { data } = await supabase
        .from("platform_settings")
        .select("key, value");

      if (data) {
        const map: Record<string, string> = {};
        data.forEach(d => { map[d.key] = d.value || ""; });
        if (map["platform_plans"]) setPlans(JSON.parse(map["platform_plans"]));
        if (map["platform_features"]) setFeatures(JSON.parse(map["platform_features"]));
        if (map["demo_title"]) setDemoTitle(map["demo_title"]);
        if (map["demo_description"]) setDemoDescription(map["demo_description"]);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const entries = [
        { key: "platform_plans", value: JSON.stringify(plans) },
        { key: "platform_features", value: JSON.stringify(features) },
        { key: "demo_title", value: demoTitle },
        { key: "demo_description", value: demoDescription },
      ];

      for (const entry of entries) {
        const { error } = await supabase.from("platform_settings").upsert(entry, { onConflict: "key" });
        if (error) throw error;
      }

      toast({ title: "Platform Settings Saved" });
    } catch (error: any) {
      toast({ variant: "destructive", title: "Error", description: error.message });
    } finally {
      setSaving(false);
    }
  };

  const toggleFeature = (id: string) => {
    setFeatures(prev => prev.map(f => f.id === id ? { ...f, enabled: !f.enabled } : f));
  };

  const togglePlan = (id: string) => {
    setPlans(prev => prev.map(p => p.id === id ? { ...p, enabled: !p.enabled } : p));
  };

  const savePlanEdit = () => {
    if (!editPlan) return;
    setPlans(prev => prev.map(p => p.id === editPlan.id ? editPlan : p));
    setEditPlan(null);
  };

  const saveFeatureEdit = () => {
    if (!editFeature) return;
    setFeatures(prev => prev.map(f => f.id === editFeature.id ? editFeature : f));
    setEditFeature(null);
  };

  const addPlan = () => {
    const newPlan: PlanTier = {
      id: `plan_${Date.now()}`,
      name: "New Plan",
      price: "0",
      period: "month",
      features: [],
      highlighted: false,
      enabled: false,
    };
    setPlans(prev => [...prev, newPlan]);
    setEditPlan(newPlan);
  };

  const deletePlan = (id: string) => {
    setPlans(prev => prev.filter(p => p.id !== id));
  };

  const addFeature = () => {
    const newFeature: PlatformFeature = {
      id: `feat_${Date.now()}`,
      name: "New Feature",
      description: "",
      enabled: false,
      tier: "personal",
    };
    setFeatures(prev => [...prev, newFeature]);
    setEditFeature(newFeature);
  };

  const deleteFeature = (id: string) => {
    setFeatures(prev => prev.filter(f => f.id !== id));
  };

  if (loading) return (
    <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Platform Settings</h1>
          <p className="text-muted-foreground">Manage pricing plans, features, and demo content for the platform</p>
        </div>
        <Button onClick={handleSave} disabled={saving}>
          <Save className="mr-2 h-4 w-4" />{saving ? "Saving..." : "Save All Changes"}
        </Button>
      </div>

      {/* Demo Section Config */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Zap className="h-5 w-5" />Demo Section</CardTitle>
          <CardDescription>Configure the demo section on the landing page</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Demo Title</Label>
            <Input value={demoTitle} onChange={e => setDemoTitle(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Demo Description</Label>
            <Textarea value={demoDescription} onChange={e => setDemoDescription(e.target.value)} rows={3} />
          </div>
        </CardContent>
      </Card>

      {/* Pricing Plans */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2"><DollarSign className="h-5 w-5" />Pricing Plans</CardTitle>
              <CardDescription>Define plan tiers and pricing for shop owners</CardDescription>
            </div>
            <Button size="sm" variant="outline" onClick={addPlan}><Plus className="mr-1 h-3 w-3" />Add Plan</Button>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Plan</TableHead>
                <TableHead>Price</TableHead>
                <TableHead>Period</TableHead>
                <TableHead>Features</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {plans.map(plan => (
                <TableRow key={plan.id}>
                  <TableCell className="font-medium">{plan.name}{plan.highlighted && <Badge className="ml-2" variant="default">Popular</Badge>}</TableCell>
                  <TableCell>Le {plan.price}</TableCell>
                  <TableCell className="capitalize">{plan.period}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{plan.features.length} features</TableCell>
                  <TableCell><Switch checked={plan.enabled} onCheckedChange={() => togglePlan(plan.id)} /></TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setEditPlan(plan)}><Edit className="h-3 w-3" /></Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => deletePlan(plan.id)}><Trash2 className="h-3 w-3" /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Platform Features */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2"><Sparkles className="h-5 w-5" />Platform Features</CardTitle>
              <CardDescription>Toggle features available to shops and assign to plan tiers</CardDescription>
            </div>
            <Button size="sm" variant="outline" onClick={addFeature}><Plus className="mr-1 h-3 w-3" />Add Feature</Button>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Feature</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Minimum Tier</TableHead>
                <TableHead>Enabled</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {features.map(f => (
                <TableRow key={f.id}>
                  <TableCell className="font-medium">{f.name}</TableCell>
                  <TableCell className="text-sm text-muted-foreground max-w-48 truncate">{f.description}</TableCell>
                  <TableCell><Badge variant="secondary" className="capitalize">{f.tier}</Badge></TableCell>
                  <TableCell><Switch checked={f.enabled} onCheckedChange={() => toggleFeature(f.id)} /></TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setEditFeature(f)}><Edit className="h-3 w-3" /></Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => deleteFeature(f.id)}><Trash2 className="h-3 w-3" /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Edit Plan Dialog */}
      <Dialog open={!!editPlan} onOpenChange={() => setEditPlan(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit Plan</DialogTitle></DialogHeader>
          {editPlan && (
            <div className="space-y-4 py-2">
              <div className="space-y-2"><Label>Plan Name</Label><Input value={editPlan.name} onChange={e => setEditPlan({ ...editPlan, name: e.target.value })} /></div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2"><Label>Price (Le)</Label><Input value={editPlan.price} onChange={e => setEditPlan({ ...editPlan, price: e.target.value })} /></div>
                <div className="space-y-2"><Label>Period</Label>
                  <select className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm" value={editPlan.period} onChange={e => setEditPlan({ ...editPlan, period: e.target.value })}>
                    <option value="month">Monthly</option><option value="year">Yearly</option>
                  </select>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Features (one per line)</Label>
                <Textarea value={editPlan.features.join("\n")} onChange={e => setEditPlan({ ...editPlan, features: e.target.value.split("\n").filter(Boolean) })} rows={5} />
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={editPlan.highlighted} onCheckedChange={v => setEditPlan({ ...editPlan, highlighted: v })} />
                <Label>Mark as Popular / Recommended</Label>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditPlan(null)}>Cancel</Button>
            <Button onClick={savePlanEdit}>Save Plan</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Feature Dialog */}
      <Dialog open={!!editFeature} onOpenChange={() => setEditFeature(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit Feature</DialogTitle></DialogHeader>
          {editFeature && (
            <div className="space-y-4 py-2">
              <div className="space-y-2"><Label>Feature Name</Label><Input value={editFeature.name} onChange={e => setEditFeature({ ...editFeature, name: e.target.value })} /></div>
              <div className="space-y-2"><Label>Description</Label><Textarea value={editFeature.description} onChange={e => setEditFeature({ ...editFeature, description: e.target.value })} rows={3} /></div>
              <div className="space-y-2"><Label>Minimum Tier</Label>
                <select className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm" value={editFeature.tier} onChange={e => setEditFeature({ ...editFeature, tier: e.target.value })}>
                  {plans.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditFeature(null)}>Cancel</Button>
            <Button onClick={saveFeatureEdit}>Save Feature</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
