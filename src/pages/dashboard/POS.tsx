import { ShoppingCart } from "lucide-react";

export default function POS() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Point of Sale</h1>
        <p className="text-muted-foreground">Create new sales transactions</p>
      </div>

      <div className="flex items-center justify-center h-64 border-2 border-dashed border-border rounded-xl">
        <div className="text-center">
          <ShoppingCart className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium text-foreground">POS Coming Soon</h3>
          <p className="text-muted-foreground">Full point-of-sale functionality will be added next.</p>
        </div>
      </div>
    </div>
  );
}
