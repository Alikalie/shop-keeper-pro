import { useState, useEffect, createContext, useContext } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import type { Tables } from "@/integrations/supabase/types";

type Shop = Tables<"shops">;
type UserRole = Tables<"user_roles">;

interface ShopContextType {
  shop: Shop | null;
  userRole: UserRole | null;
  loading: boolean;
  isOwner: boolean;
  refetch: () => Promise<void>;
}

const ShopContext = createContext<ShopContextType | undefined>(undefined);

export function ShopProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [shop, setShop] = useState<Shop | null>(null);
  const [userRole, setUserRole] = useState<UserRole | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchShopData = async () => {
    if (!user) {
      setShop(null);
      setUserRole(null);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);

      // First check if user is an owner
      const { data: ownedShop } = await supabase
        .from("shops")
        .select("*")
        .eq("owner_id", user.id)
        .maybeSingle();

      if (ownedShop) {
        setShop(ownedShop);
        
        // Get user role
        const { data: role } = await supabase
          .from("user_roles")
          .select("*")
          .eq("user_id", user.id)
          .eq("shop_id", ownedShop.id)
          .maybeSingle();
        
        setUserRole(role);
      } else {
        // Check if user is staff
        const { data: staffRole } = await supabase
          .from("user_roles")
          .select("*, shops(*)")
          .eq("user_id", user.id)
          .maybeSingle();

        if (staffRole && staffRole.shops) {
          setShop(staffRole.shops as unknown as Shop);
          setUserRole(staffRole);
        }
      }
    } catch (error) {
      console.error("Error fetching shop data:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchShopData();
  }, [user]);

  const isOwner = shop?.owner_id === user?.id;

  return (
    <ShopContext.Provider value={{ shop, userRole, loading, isOwner, refetch: fetchShopData }}>
      {children}
    </ShopContext.Provider>
  );
}

export function useShop() {
  const context = useContext(ShopContext);
  if (context === undefined) {
    throw new Error("useShop must be used within a ShopProvider");
  }
  return context;
}
