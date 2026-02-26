import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Users, Search, UserX, ShieldPlus, ShieldCheck } from "lucide-react";
import { format } from "date-fns";

interface UserRow {
  userId: string;
  displayName: string | null;
  role: string;
  shopName: string;
  shopId: string | null;
  createdAt: string | null;
  username?: string;
  email?: string;
}

export default function AdminUsers() {
  const { toast } = useToast();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [deleteUser, setDeleteUser] = useState<UserRow | null>(null);
  const [showAddAdmin, setShowAddAdmin] = useState(false);
  const [adminEmail, setAdminEmail] = useState("");
  const [adminRole, setAdminRole] = useState<"super_admin">("super_admin");
  const [addingAdmin, setAddingAdmin] = useState(false);

  useEffect(() => { fetchUsers(); }, []);

  const fetchUsers = async () => {
    setLoading(true);

    const [rolesRes, profilesRes, shopsRes, credsRes] = await Promise.all([
      supabase.from("user_roles").select("user_id, role, shop_id, created_at"),
      supabase.from("profiles").select("user_id, display_name"),
      supabase.from("shops").select("id, name, owner_id"),
      supabase.from("staff_credentials").select("user_id, username, shop_id, email"),
    ]);

    const profileMap = new Map((profilesRes.data || []).map((p) => [p.user_id, p.display_name]));
    const shopMap = new Map((shopsRes.data || []).map((s) => [s.id, s.name]));
    const credMap = new Map((credsRes.data || []).map((c) => [c.user_id, { username: c.username, email: c.email }]));

    const rows: UserRow[] = (rolesRes.data || []).map((r) => ({
      userId: r.user_id,
      displayName: profileMap.get(r.user_id) || null,
      role: r.role,
      shopName: r.shop_id ? (shopMap.get(r.shop_id) || "Unknown") : "Platform",
      shopId: r.shop_id,
      createdAt: r.created_at,
      username: credMap.get(r.user_id)?.username,
      email: credMap.get(r.user_id)?.email || undefined,
    }));

    setUsers(rows);
    setLoading(false);
  };

  const handleDeleteRole = async () => {
    if (!deleteUser) return;
    const { error } = await supabase.from("user_roles").delete()
      .eq("user_id", deleteUser.userId)
      .eq("role", deleteUser.role as "owner" | "staff" | "super_admin");

    if (error) {
      toast({ variant: "destructive", title: "Error", description: error.message });
    } else {
      if (deleteUser.role === "staff") {
        await supabase.from("staff_credentials").delete().eq("user_id", deleteUser.userId);
      }
      toast({ title: "User removed" });
      setDeleteUser(null);
      fetchUsers();
    }
  };

  const handleAddAdmin = async () => {
    if (!adminEmail.trim()) return;
    setAddingAdmin(true);
    try {
      // Look up user by email in staff_credentials or profiles
      // We need to find user_id from the email — check staff_credentials first
      const { data: credData } = await supabase
        .from("staff_credentials")
        .select("user_id")
        .eq("email", adminEmail.trim())
        .maybeSingle();

      let userId = credData?.user_id;

      if (!userId) {
        // Try finding owner by checking shops table via owner email
        // Since we can't query auth.users, check if any existing user_roles match
        // We'll look through existing users to find by display name or ask for user_id
        // Actually, the best approach: look up the user from profiles
        // But profiles don't store email. Let's use the shops owner approach
        const { data: shops } = await supabase.from("shops").select("owner_id");
        const ownerIds = (shops || []).map(s => s.owner_id);
        
        // For now, check all user roles for this email pattern
        // Since we can't directly query auth.users, let the user know
        toast({
          variant: "destructive",
          title: "User not found",
          description: "The user must have an account. Make sure the email matches their signup email.",
        });
        setAddingAdmin(false);
        return;
      }

      // Check if already super_admin
      const { data: existing } = await supabase
        .from("user_roles")
        .select("id")
        .eq("user_id", userId)
        .eq("role", "super_admin")
        .maybeSingle();

      if (existing) {
        toast({ title: "Already Admin", description: "This user is already a super admin." });
        setAddingAdmin(false);
        return;
      }

      const { error } = await supabase.from("user_roles").insert({
        user_id: userId,
        role: "super_admin" as any,
        shop_id: null,
      });

      if (error) throw error;

      toast({ title: "Admin Added", description: `User has been granted super admin access.` });
      setAdminEmail("");
      setShowAddAdmin(false);
      fetchUsers();
    } catch (error: any) {
      toast({ variant: "destructive", title: "Error", description: error.message });
    } finally {
      setAddingAdmin(false);
    }
  };

  const handlePromoteToAdmin = async (user: UserRow) => {
    // Check if already admin
    const existing = users.find(u => u.userId === user.userId && u.role === "super_admin");
    if (existing) {
      toast({ title: "Already Admin", description: "This user is already a super admin." });
      return;
    }

    const { error } = await supabase.from("user_roles").insert({
      user_id: user.userId,
      role: "super_admin" as any,
      shop_id: null,
    });

    if (error) {
      toast({ variant: "destructive", title: "Error", description: error.message });
    } else {
      toast({ title: "Promoted", description: `${user.displayName || user.username || "User"} is now a super admin.` });
      fetchUsers();
    }
  };

  const filtered = users.filter((u) =>
    (u.displayName || "").toLowerCase().includes(search.toLowerCase()) ||
    (u.username || "").toLowerCase().includes(search.toLowerCase()) ||
    u.shopName.toLowerCase().includes(search.toLowerCase()) ||
    u.role.toLowerCase().includes(search.toLowerCase())
  );

  const getRoleBadge = (role: string) => {
    if (role === "super_admin") return <Badge className="bg-primary text-primary-foreground">Super Admin</Badge>;
    if (role === "owner") return <Badge variant="default">Owner</Badge>;
    return <Badge variant="secondary">Staff</Badge>;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">All Users</h1>
          <p className="text-muted-foreground">Manage all owners, staff, and admins across the platform</p>
        </div>
        <Button onClick={() => setShowAddAdmin(true)}>
          <ShieldPlus className="mr-2 h-4 w-4" />
          Add Admin
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {[
          { label: "Owners", count: users.filter((u) => u.role === "owner").length },
          { label: "Staff", count: users.filter((u) => u.role === "staff").length },
          { label: "Super Admins", count: users.filter((u) => u.role === "super_admin").length },
        ].map((s) => (
          <Card key={s.label}>
            <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">{s.label}</CardTitle></CardHeader>
            <CardContent><div className="text-2xl font-bold">{s.count}</div></CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Users ({filtered.length})
            </CardTitle>
            <div className="relative w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search users..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
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
                  <TableHead>Name / Username</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Shop</TableHead>
                  <TableHead>Joined</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((u, i) => (
                  <TableRow key={`${u.userId}-${i}`}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{u.displayName || u.username || "Unknown"}</p>
                        {u.username && <p className="text-xs text-muted-foreground font-mono">@{u.username}</p>}
                      </div>
                    </TableCell>
                    <TableCell>{getRoleBadge(u.role)}</TableCell>
                    <TableCell className="text-muted-foreground text-sm">{u.shopName}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {u.createdAt ? format(new Date(u.createdAt), "MMM dd, yyyy") : "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        {u.role !== "super_admin" && (
                          <>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-primary"
                              title="Promote to Admin"
                              onClick={() => handlePromoteToAdmin(u)}
                            >
                              <ShieldCheck className="h-3 w-3" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-destructive"
                              onClick={() => setDeleteUser(u)}
                            >
                              <UserX className="h-3 w-3" />
                            </Button>
                          </>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {filtered.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground py-8">No users found</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Delete User Dialog */}
      <Dialog open={!!deleteUser} onOpenChange={() => setDeleteUser(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Remove User</DialogTitle></DialogHeader>
          <p className="text-muted-foreground">
            Remove <strong>{deleteUser?.displayName || deleteUser?.username || "this user"}</strong> ({deleteUser?.role}) from <strong>{deleteUser?.shopName}</strong>?
            This will revoke their access but preserve their sales history.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteUser(null)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDeleteRole}>Remove User</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Admin Dialog */}
      <Dialog open={showAddAdmin} onOpenChange={setShowAddAdmin}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add Super Admin</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">
              Enter the email of an existing user to grant them super admin access. They must already have an account on the platform.
            </p>
            <div className="space-y-2">
              <Label>User Email</Label>
              <Input
                type="email"
                placeholder="user@example.com"
                value={adminEmail}
                onChange={(e) => setAdminEmail(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddAdmin(false)}>Cancel</Button>
            <Button onClick={handleAddAdmin} disabled={addingAdmin || !adminEmail.trim()}>
              {addingAdmin ? "Adding..." : "Grant Admin Access"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
