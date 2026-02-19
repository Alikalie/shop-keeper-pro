import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Store, Search, Trash2, Edit, Eye } from "lucide-react";

interface ShopWithStats {
  id: string;
  name: string;
  owner_id: string;
  plan_type: string;
  currency: string | null;
  phone: string | null;
  address: string | null;
  staff_limit: number;
  created_at: string | null;
  salesCount?: number;
  revenue?: number;
}

export default function AdminShops() {
  const { toast } = useToast();
  const [shops, setShops] = useState<ShopWithStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [editShop, setEditShop] = useState<ShopWithStats | null>(null);
  const [deleteShopId, setDeleteShopId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => { fetchShops(); }, []);

  const fetchShops = async () => {
    setLoading(true);
    const { data: shopsData } = await supabase
      .from("shops")
      .select("*")
      .order("created_at", { ascending: false });

    if (!shopsData) { setLoading(false); return; }

    // Get sales per shop
    const { data: salesData } = await supabase
      .from("sales")
      .select("shop_id, total_amount");

    const salesMap = new Map<string, { count: number; revenue: number }>();
    (salesData || []).forEach((s) => {
      const cur = salesMap.get(s.shop_id) || { count: 0, revenue: 0 };
      salesMap.set(s.shop_id, { count: cur.count + 1, revenue: cur.revenue + Number(s.total_amount) });
    });

    setShops(shopsData.map((shop) => ({
      ...shop,
      salesCount: salesMap.get(shop.id)?.count || 0,
      revenue: salesMap.get(shop.id)?.revenue || 0,
    })));
    setLoading(false);
  };

  const handleSaveEdit = async () => {
    if (!editShop) return;
    setSaving(true);
    const { error } = await supabase.from("shops").update({
      name: editShop.name,
      phone: editShop.phone,
      address: editShop.address,
      plan_type: editShop.plan_type,
      staff_limit: editShop.staff_limit,
    }).eq("id", editShop.id);
    setSaving(false);
    if (error) {
      toast({ variant: "destructive", title: "Error", description: error.message });
    } else {
      toast({ title: "Shop updated" });
      setEditShop(null);
      fetchShops();
    }
  };

  const handleDelete = async () => {
    if (!deleteShopId) return;
    const { error } = await supabase.from("shops").delete().eq("id", deleteShopId);
    if (error) {
      toast({ variant: "destructive", title: "Error", description: error.message });
    } else {
      toast({ title: "Shop deleted" });
      setDeleteShopId(null);
      fetchShops();
    }
  };

  const filtered = shops.filter((s) =>
    s.name.toLowerCase().includes(search.toLowerCase()) ||
    s.plan_type.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">All Shops</h1>
        <p className="text-muted-foreground">Manage all registered shops on the platform</p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Store className="h-5 w-5" />
              Shops ({filtered.length})
            </CardTitle>
            <div className="relative w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search shops..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Shop Name</TableHead>
                  <TableHead>Plan</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead className="text-right">Sales</TableHead>
                  <TableHead className="text-right">Revenue</TableHead>
                  <TableHead>Joined</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((shop) => (
                  <TableRow key={shop.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-md bg-primary/10 flex items-center justify-center">
                          <Store className="h-3 w-3 text-primary" />
                        </div>
                        <span className="font-medium">{shop.name}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={shop.plan_type === "organization" ? "default" : "secondary"} className="capitalize">
                        {shop.plan_type}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{shop.phone || "—"}</TableCell>
                    <TableCell className="text-right">{(shop.salesCount || 0).toLocaleString()}</TableCell>
                    <TableCell className="text-right font-medium">{shop.currency || "Le"} {(shop.revenue || 0).toLocaleString()}</TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {shop.created_at ? new Date(shop.created_at).toLocaleDateString() : "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setEditShop(shop)}>
                          <Edit className="h-3 w-3" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => setDeleteShopId(shop.id)}>
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {filtered.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground py-8">No shops found</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <Dialog open={!!editShop} onOpenChange={() => setEditShop(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit Shop</DialogTitle></DialogHeader>
          {editShop && (
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label>Shop Name</Label>
                <Input value={editShop.name} onChange={(e) => setEditShop({ ...editShop, name: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Phone</Label>
                <Input value={editShop.phone || ""} onChange={(e) => setEditShop({ ...editShop, phone: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Address</Label>
                <Input value={editShop.address || ""} onChange={(e) => setEditShop({ ...editShop, address: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Plan Type</Label>
                  <select
                    className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                    value={editShop.plan_type}
                    onChange={(e) => setEditShop({ ...editShop, plan_type: e.target.value })}
                  >
                    <option value="personal">Personal</option>
                    <option value="organization">Organization</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <Label>Staff Limit</Label>
                  <Input type="number" value={editShop.staff_limit} onChange={(e) => setEditShop({ ...editShop, staff_limit: parseInt(e.target.value) || 5 })} />
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditShop(null)}>Cancel</Button>
            <Button onClick={handleSaveEdit} disabled={saving}>{saving ? "Saving..." : "Save Changes"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm Dialog */}
      <Dialog open={!!deleteShopId} onOpenChange={() => setDeleteShopId(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Delete Shop</DialogTitle></DialogHeader>
          <p className="text-muted-foreground">Are you sure? This will permanently delete the shop and all its data. This action cannot be undone.</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteShopId(null)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete}>Delete Shop</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
