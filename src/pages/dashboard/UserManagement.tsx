import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useShop } from "@/hooks/useShop";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { UserPlus, Trash2, Shield, User, Eye, EyeOff } from "lucide-react";
import type { Database } from "@/integrations/supabase/types";

type AppRole = Database["public"]["Enums"]["app_role"];

interface StaffMember {
  id: string;
  user_id: string;
  role: AppRole;
  display_name: string | null;
  username: string | null;
  created_at: string;
}

export default function UserManagement() {
  const { shop, isOwner } = useShop();
  const { user } = useAuth();
  const { toast } = useToast();
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [newUsername, setNewUsername] = useState("");
  const [newDisplayName, setNewDisplayName] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [newUserRole, setNewUserRole] = useState<AppRole>("staff");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (shop && isOwner) fetchStaff();
  }, [shop, isOwner]);

  const fetchStaff = async () => {
    if (!shop) return;
    try {
      const { data: roles, error } = await supabase
        .from("user_roles")
        .select("id, user_id, role, created_at")
        .eq("shop_id", shop.id);

      if (error) throw error;

      // Get profiles and credentials
      const userIds = (roles || []).map(r => r.user_id);

      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, display_name")
        .in("user_id", userIds);

      const { data: creds } = await supabase
        .from("staff_credentials")
        .select("user_id, username")
        .eq("shop_id", shop.id);

      const staffList: StaffMember[] = (roles || []).map((role) => {
        const profile = profiles?.find(p => p.user_id === role.user_id);
        const cred = creds?.find(c => c.user_id === role.user_id);
        return {
          id: role.id,
          user_id: role.user_id,
          role: role.role,
          display_name: profile?.display_name || null,
          username: cred?.username || null,
          created_at: role.created_at || "",
        };
      });

      setStaff(staffList);
    } catch (error) {
      console.error("Error fetching staff:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddStaff = async () => {
    if (!shop || !newUsername || !newPassword) {
      toast({ variant: "destructive", title: "Missing Information", description: "Username and password are required." });
      return;
    }

    if (newPassword.length < 6) {
      toast({ variant: "destructive", title: "Password Too Short", description: "Password must be at least 6 characters." });
      return;
    }

    setIsSubmitting(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-staff`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.access_token}`,
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        },
        body: JSON.stringify({
          username: newUsername,
          password: newPassword,
          displayName: newDisplayName || newUsername,
          role: newUserRole,
          shopId: shop.id,
        }),
      });

      const result = await response.json();

      if (!response.ok) throw new Error(result.error || "Failed to add staff");

      toast({ title: "Staff Added!", description: `${newUsername} can now log in with their username and password.` });

      setIsDialogOpen(false);
      setNewUsername("");
      setNewPassword("");
      setNewDisplayName("");
      setNewUserRole("staff");
      fetchStaff();
    } catch (error) {
      console.error("Error adding staff:", error);
      toast({ variant: "destructive", title: "Error", description: error instanceof Error ? error.message : "Failed to add staff" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRemoveUser = async (staffMember: StaffMember) => {
    if (staffMember.user_id === user?.id) {
      toast({ variant: "destructive", title: "Cannot Remove", description: "You cannot remove yourself." });
      return;
    }

    if (!confirm(`Remove ${staffMember.display_name || staffMember.username || "this user"}?`)) return;

    try {
      const { error } = await supabase.from("user_roles").delete().eq("id", staffMember.id);
      if (error) throw error;
      toast({ title: "User Removed" });
      fetchStaff();
    } catch (error) {
      toast({ variant: "destructive", title: "Error", description: "Failed to remove user" });
    }
  };

  const handleUpdateRole = async (staffMember: StaffMember, newRole: AppRole) => {
    if (staffMember.user_id === user?.id) return;
    try {
      const { error } = await supabase.from("user_roles").update({ role: newRole }).eq("id", staffMember.id);
      if (error) throw error;
      toast({ title: "Role Updated" });
      fetchStaff();
    } catch {
      toast({ variant: "destructive", title: "Error", description: "Failed to update role" });
    }
  };

  if (!isOwner) {
    return (
      <div className="text-center py-12">
        <Shield className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
        <h2 className="text-2xl font-bold text-foreground">Access Denied</h2>
        <p className="text-muted-foreground mt-2">Only shop owners can manage users.</p>
      </div>
    );
  }

  if (loading) {
    return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div></div>;
  }

  const staffLimit = shop?.plan_type === "organization" ? "Unlimited" : (shop?.staff_limit || 5);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">User Management</h1>
          <p className="text-muted-foreground">
            Staff: {staff.length} / {staffLimit} ({shop?.plan_type === "organization" ? "Organization" : "Personal"} plan)
          </p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button><UserPlus className="mr-2 h-4 w-4" />Add Staff</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add New Staff</DialogTitle>
              <DialogDescription>Create a username and password for your staff member. They'll use these to log in.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="displayName">Display Name</Label>
                <Input id="displayName" placeholder="John Doe" value={newDisplayName} onChange={(e) => setNewDisplayName(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="username">Username *</Label>
                <Input id="username" placeholder="john_doe" value={newUsername} onChange={(e) => setNewUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""))} required />
                <p className="text-xs text-muted-foreground">Lowercase letters, numbers, and underscores only</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="staff-password">Password *</Label>
                <div className="relative">
                  <Input id="staff-password" type={showPassword ? "text" : "password"} placeholder="Min 6 characters" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Role</Label>
                <Select value={newUserRole} onValueChange={(val) => setNewUserRole(val as AppRole)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="staff">Staff (Sales Only)</SelectItem>
                    <SelectItem value="owner">Admin (Full Access)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
              <Button onClick={handleAddStaff} disabled={isSubmitting}>{isSubmitting ? "Adding..." : "Add Staff"}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Shop Staff</CardTitle>
          <CardDescription>All users with access to {shop?.name}</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>Username</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Added</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {staff.map((member) => (
                <TableRow key={member.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                        <User className="h-4 w-4 text-primary" />
                      </div>
                      <p className="font-medium">{member.display_name || "Unknown"}</p>
                    </div>
                  </TableCell>
                  <TableCell className="font-mono text-sm">{member.username || "—"}</TableCell>
                  <TableCell>
                    <Select value={member.role} onValueChange={(val) => handleUpdateRole(member, val as AppRole)} disabled={member.user_id === user?.id}>
                      <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="staff">Staff</SelectItem>
                        <SelectItem value="owner">Admin</SelectItem>
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>{member.created_at ? new Date(member.created_at).toLocaleDateString() : "N/A"}</TableCell>
                  <TableCell className="text-right">
                    {member.user_id !== user?.id ? (
                      <Button variant="ghost" size="icon" onClick={() => handleRemoveUser(member)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    ) : (
                      <Badge variant="secondary">You</Badge>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {staff.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground py-8">No staff members yet</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
