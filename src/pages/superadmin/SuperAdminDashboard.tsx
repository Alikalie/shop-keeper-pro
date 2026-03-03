import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { Store, Users, ShoppingCart, CreditCard, TrendingUp, DollarSign, Upload, Video, Loader2, User } from "lucide-react";

interface PlatformStats {
  totalShops: number;
  totalUsers: number;
  totalSales: number;
  totalRevenue: number;
  totalLoans: number;
  totalLoanBalance: number;
}

interface StaffInfo {
  user_id: string;
  username: string;
  shop_name: string;
  display_name: string | null;
  created_at: string | null;
}

export default function SuperAdminDashboard() {
  const [stats, setStats] = useState<PlatformStats>({
    totalShops: 0, totalUsers: 0, totalSales: 0, totalRevenue: 0, totalLoans: 0, totalLoanBalance: 0,
  });
  const [recentShops, setRecentShops] = useState<{ id: string; name: string; owner_id: string; plan_type: string; created_at: string | null }[]>([]);
  const [allStaff, setAllStaff] = useState<StaffInfo[]>([]);
  const [demoVideoUrl, setDemoVideoUrl] = useState<string | null>(null);
  const [uploadingVideo, setUploadingVideo] = useState(false);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const [shopsRes, salesRes, loansRes, rolesRes, credsRes, profilesRes] = await Promise.all([
        supabase.from("shops").select("id, name, owner_id, plan_type, created_at").order("created_at", { ascending: false }),
        supabase.from("sales").select("total_amount"),
        supabase.from("loans").select("total_amount, amount_paid, status").neq("status", "paid"),
        supabase.from("user_roles").select("user_id", { count: "exact", head: true }),
        supabase.from("staff_credentials").select("user_id, username, shop_id, created_at"),
        supabase.from("profiles").select("user_id, display_name"),
      ]);

      const totalRevenue = (salesRes.data || []).reduce((s, r) => s + Number(r.total_amount), 0);
      const totalLoanBalance = (loansRes.data || []).reduce((s, r) => s + (Number(r.total_amount) - Number(r.amount_paid || 0)), 0);

      setStats({
        totalShops: shopsRes.data?.length || 0,
        totalUsers: rolesRes.count || 0,
        totalSales: salesRes.data?.length || 0,
        totalRevenue,
        totalLoans: loansRes.data?.length || 0,
        totalLoanBalance,
      });

      setRecentShops((shopsRes.data || []).slice(0, 8));

      // Build staff list
      const shops = shopsRes.data || [];
      const shopMap: Record<string, string> = {};
      shops.forEach(s => { shopMap[s.id] = s.name; });

      const profileMap: Record<string, string> = {};
      (profilesRes.data || []).forEach(p => { profileMap[p.user_id] = p.display_name || ""; });

      const staffList: StaffInfo[] = (credsRes.data || []).map(c => ({
        user_id: c.user_id,
        username: c.username,
        shop_name: shopMap[c.shop_id] || "Unknown",
        display_name: profileMap[c.user_id] || null,
        created_at: c.created_at,
      }));
      setAllStaff(staffList);

      // Check for existing demo video
      const { data: files } = await supabase.storage.from("demo-videos").list("", { limit: 1 });
      if (files && files.length > 0) {
        const { data: urlData } = supabase.storage.from("demo-videos").getPublicUrl(files[0].name);
        setDemoVideoUrl(urlData.publicUrl);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleVideoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("video/")) return;
    if (file.size > 50 * 1024 * 1024) return; // 50MB limit

    setUploadingVideo(true);
    try {
      const ext = file.name.split(".").pop();
      const filePath = `demo.${ext}`;
      const { error } = await supabase.storage.from("demo-videos").upload(filePath, file, { cacheControl: "3600", upsert: true });
      if (error) throw error;
      const { data: urlData } = supabase.storage.from("demo-videos").getPublicUrl(filePath);
      setDemoVideoUrl(`${urlData.publicUrl}?t=${Date.now()}`);
    } catch (err) {
      console.error("Video upload error:", err);
    } finally {
      setUploadingVideo(false);
    }
  };

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
    </div>
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold text-foreground">Super Admin Dashboard</h1>
        <p className="text-muted-foreground">Platform-wide overview and management</p>
      </div>

      <div className="grid gap-4 grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Shops</CardTitle>
            <Store className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent><div className="text-2xl font-bold">{stats.totalShops}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Users</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent><div className="text-2xl font-bold">{stats.totalUsers}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Sales</CardTitle>
            <ShoppingCart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent><div className="text-2xl font-bold">{stats.totalSales.toLocaleString()}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Platform Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent><div className="text-2xl font-bold text-primary">Le {stats.totalRevenue.toLocaleString()}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Loans</CardTitle>
            <CreditCard className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent><div className="text-2xl font-bold">{stats.totalLoans}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Loan Balance</CardTitle>
            <TrendingUp className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent><div className="text-2xl font-bold text-destructive">Le {stats.totalLoanBalance.toLocaleString()}</div></CardContent>
        </Card>
      </div>

      {/* Demo Video Upload */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Video className="h-5 w-5" /> Demo Video</CardTitle>
          <CardDescription>Upload a demo video for the platform landing page</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {demoVideoUrl && (
            <video src={demoVideoUrl} controls className="w-full max-h-64 rounded-lg border border-border" />
          )}
          <div className="flex items-center gap-3">
            <Button onClick={() => videoInputRef.current?.click()} disabled={uploadingVideo} variant="outline">
              {uploadingVideo ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
              {uploadingVideo ? "Uploading..." : "Upload Video"}
            </Button>
            <p className="text-xs text-muted-foreground">Max 50MB, MP4/WebM</p>
          </div>
          <input ref={videoInputRef} type="file" accept="video/*" className="hidden" onChange={handleVideoUpload} />
        </CardContent>
      </Card>

      {/* All Registered Staff */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><User className="h-5 w-5" /> All Registered Staff</CardTitle>
          <CardDescription>{allStaff.length} staff members across all shops</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Username</TableHead>
                  <TableHead>Shop</TableHead>
                  <TableHead>Registered</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {allStaff.map((s) => (
                  <TableRow key={s.user_id}>
                    <TableCell className="font-medium">{s.display_name || "—"}</TableCell>
                    <TableCell className="font-mono text-sm">@{s.username}</TableCell>
                    <TableCell><Badge variant="secondary">{s.shop_name}</Badge></TableCell>
                    <TableCell className="text-sm text-muted-foreground">{s.created_at ? new Date(s.created_at).toLocaleDateString() : "N/A"}</TableCell>
                  </TableRow>
                ))}
                {allStaff.length === 0 && (
                  <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-8">No staff registered yet</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Recent Shops */}
      <Card>
        <CardHeader><CardTitle>Recently Registered Shops</CardTitle></CardHeader>
        <CardContent>
          <div className="space-y-2">
            {recentShops.map((shop) => (
              <div key={shop.id} className="flex items-center justify-between p-3 rounded-lg border border-border hover:bg-muted/50 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Store className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium">{shop.name}</p>
                    <p className="text-xs text-muted-foreground capitalize">{shop.plan_type} plan</p>
                  </div>
                </div>
                <span className="text-xs text-muted-foreground">
                  {shop.created_at ? new Date(shop.created_at).toLocaleDateString() : "N/A"}
                </span>
              </div>
            ))}
            {recentShops.length === 0 && <p className="text-muted-foreground text-center py-4">No shops registered yet</p>}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
