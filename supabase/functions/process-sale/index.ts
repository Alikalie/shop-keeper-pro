import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

type PaymentType = "cash" | "credit" | "transfer";

interface CartItemPayload {
  productId: string;
  quantity: number;
}

interface TransferDetails {
  transferType?: string;
  providerName?: string;
  accountNumber?: string;
  transactionRef?: string;
  senderName?: string;
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const jsonResponse = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const generateReceiptId = (shopName: string) => {
  const prefix = (shopName || "SHOP").substring(0, 4).toUpperCase().padEnd(4, "X");
  const now = new Date();
  const date = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`;
  const random = Math.floor(10000 + Math.random() * 90000);
  return `${prefix}-${date}-${random}`;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const publishableKey = Deno.env.get("SUPABASE_PUBLISHABLE_KEY");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const authHeader = req.headers.get("Authorization");

    if (!supabaseUrl || !publishableKey || !serviceRoleKey) {
      return jsonResponse({ error: "Server configuration is incomplete." }, 500);
    }

    if (!authHeader) {
      return jsonResponse({ error: "Unauthorized" }, 401);
    }

    const userClient = createClient(supabaseUrl, publishableKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false },
    });

    const {
      data: { user },
      error: authError,
    } = await userClient.auth.getUser();

    if (authError || !user) {
      return jsonResponse({ error: "Unauthorized" }, 401);
    }

    const body = await req.json();
    const shopId = typeof body.shopId === "string" ? body.shopId : "";
    const customerId = typeof body.customerId === "string" && body.customerId.length > 0 ? body.customerId : null;
    const paymentType = body.paymentType as PaymentType;
    const amountPaid = Number(body.amountPaid ?? 0);
    const transferDetails = (body.transferDetails ?? null) as TransferDetails | null;
    const rawCartItems = Array.isArray(body.cartItems) ? (body.cartItems as CartItemPayload[]) : [];

    if (!shopId || rawCartItems.length === 0) {
      return jsonResponse({ error: "Shop and cart items are required." }, 400);
    }

    if (!["cash", "credit", "transfer"].includes(paymentType)) {
      return jsonResponse({ error: "Invalid payment type." }, 400);
    }

    if (!Number.isFinite(amountPaid) || amountPaid < 0) {
      return jsonResponse({ error: "Amount paid must be a valid positive number." }, 400);
    }

    if (paymentType === "credit" && !customerId) {
      return jsonResponse({ error: "Loan sales require a registered customer." }, 400);
    }

    if (
      paymentType === "transfer" &&
      (!transferDetails?.providerName || !transferDetails?.transactionRef || !transferDetails?.senderName)
    ) {
      return jsonResponse({ error: "Transfer details are incomplete." }, 400);
    }

    const cartMap = new Map<string, number>();
    for (const item of rawCartItems) {
      if (!item?.productId || !Number.isInteger(item.quantity) || item.quantity <= 0) {
        return jsonResponse({ error: "Each cart item must include a product and a valid quantity." }, 400);
      }
      cartMap.set(item.productId, (cartMap.get(item.productId) ?? 0) + item.quantity);
    }

    const cartItems = Array.from(cartMap.entries()).map(([productId, quantity]) => ({ productId, quantity }));
    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    });

    const [shopResult, roleResult, productsResult, customerResult] = await Promise.all([
      adminClient
        .from("shops")
        .select("id, name, currency, address, phone, logo_url, receipt_footer, owner_id")
        .eq("id", shopId)
        .maybeSingle(),
      adminClient
        .from("user_roles")
        .select("role")
        .eq("shop_id", shopId)
        .eq("user_id", user.id)
        .maybeSingle(),
      adminClient
        .from("products")
        .select("id, name, sku, selling_price, quantity_on_hand")
        .eq("shop_id", shopId)
        .in("id", cartItems.map((item) => item.productId)),
      customerId
        ? adminClient
            .from("customers")
            .select("id, name, phone, address, outstanding_balance")
            .eq("id", customerId)
            .eq("shop_id", shopId)
            .maybeSingle()
        : Promise.resolve({ data: null, error: null }),
    ]);

    if (shopResult.error || !shopResult.data) {
      return jsonResponse({ error: "Shop not found." }, 404);
    }

    if (shopResult.data.owner_id !== user.id && !roleResult.data) {
      return jsonResponse({ error: "You do not have access to process sales for this shop." }, 403);
    }

    if (productsResult.error || !productsResult.data) {
      return jsonResponse({ error: "Unable to load products for checkout." }, 400);
    }

    if (customerId && (customerResult as { error: unknown; data: unknown }).error) {
      return jsonResponse({ error: "Unable to load the selected customer." }, 400);
    }

    if (customerId && !(customerResult as { data: unknown }).data) {
      return jsonResponse({ error: "Selected customer was not found in this shop." }, 404);
    }

    const productMap = new Map(productsResult.data.map((product) => [product.id, product]));
    const normalizedItems = cartItems.map((item) => {
      const product = productMap.get(item.productId);
      if (!product) {
        throw new Error("One or more products in the cart are no longer available.");
      }

      const availableStock = Number(product.quantity_on_hand ?? 0);
      if (item.quantity > availableStock) {
        throw new Error(`${product.name} only has ${availableStock} item(s) left in stock.`);
      }

      const unitPrice = Number(product.selling_price);
      return {
        product,
        quantity: item.quantity,
        unitPrice,
        total: unitPrice * item.quantity,
        remainingStock: availableStock - item.quantity,
      };
    });

    const totalAmount = normalizedItems.reduce((sum, item) => sum + item.total, 0);

    if (paymentType === "cash" && amountPaid < totalAmount) {
      return jsonResponse({ error: "Cash payment is less than the sale total." }, 400);
    }

    if (paymentType === "transfer" && amountPaid < totalAmount) {
      return jsonResponse({ error: "Transfer amount must cover the full sale total." }, 400);
    }

    if (paymentType === "credit" && amountPaid > totalAmount) {
      return jsonResponse({ error: "Loan payment cannot be more than the sale total." }, 400);
    }

    const receiptId = generateReceiptId(shopResult.data.name);
    const transferType = transferDetails?.transferType === "bank" ? "bank" : "mobile";
    const paymentLabel = paymentType === "transfer" ? `transfer-${transferType}` : paymentType;
    const saleStatus =
      paymentType === "credit"
        ? amountPaid <= 0
          ? "unpaid"
          : amountPaid < totalAmount
            ? "partial"
            : "completed"
        : "completed";

    const { data: sale, error: saleError } = await adminClient
      .from("sales")
      .insert({
        shop_id: shopId,
        staff_id: user.id,
        customer_id: customerId,
        total_amount: totalAmount,
        amount_paid: amountPaid,
        payment_type: paymentLabel,
        receipt_id: receiptId,
        status: saleStatus,
      })
      .select("id, receipt_id")
      .single();

    if (saleError || !sale) {
      return jsonResponse({ error: saleError?.message || "Failed to save sale." }, 400);
    }

    const saleItems = normalizedItems.map((item) => ({
      sale_id: sale.id,
      product_id: item.product.id,
      quantity: item.quantity,
      unit_price: item.unitPrice,
      total: item.total,
    }));

    const { error: saleItemsError } = await adminClient.from("sale_items").insert(saleItems);
    if (saleItemsError) {
      return jsonResponse({ error: saleItemsError.message || "Failed to save sale items." }, 400);
    }

    const stockResults = await Promise.all(
      normalizedItems.map(async (item) => {
        const [productUpdate, movementInsert] = await Promise.all([
          adminClient
            .from("products")
            .update({ quantity_on_hand: item.remainingStock })
            .eq("id", item.product.id),
          adminClient.from("stock_movements").insert({
            product_id: item.product.id,
            shop_id: shopId,
            movement_type: "sale",
            quantity: -item.quantity,
            recorded_by: user.id,
            reference_id: sale.id,
            reference_type: "sale",
            notes: `Sale ${receiptId}`,
          }),
        ]);

        return { productUpdate, movementInsert };
      }),
    );

    for (const result of stockResults) {
      if (result.productUpdate.error) {
        return jsonResponse({ error: result.productUpdate.error.message || "Failed to update product stock." }, 400);
      }
      if (result.movementInsert.error) {
        return jsonResponse({ error: result.movementInsert.error.message || "Failed to record stock movement." }, 400);
      }
    }

    const customer = (customerResult as { data: { name?: string; phone?: string | null; address?: string | null; outstanding_balance?: number | null } | null }).data;

    if (paymentType === "credit" && customerId) {
      const loanAmountPaid = Math.min(amountPaid, totalAmount);
      const remainingLoanBalance = Math.max(totalAmount - loanAmountPaid, 0);
      const loanStatus = remainingLoanBalance <= 0 ? "paid" : loanAmountPaid > 0 ? "partial" : "unpaid";

      const [loanInsert, customerUpdate] = await Promise.all([
        adminClient.from("loans").insert({
          shop_id: shopId,
          customer_id: customerId,
          sale_id: sale.id,
          total_amount: totalAmount,
          amount_paid: loanAmountPaid,
          status: loanStatus,
        }),
        adminClient
          .from("customers")
          .update({ outstanding_balance: Number(customer?.outstanding_balance ?? 0) + remainingLoanBalance })
          .eq("id", customerId),
      ]);

      if (loanInsert.error) {
        return jsonResponse({ error: loanInsert.error.message || "Failed to save loan record." }, 400);
      }

      if (customerUpdate.error) {
        return jsonResponse({ error: customerUpdate.error.message || "Failed to update customer balance." }, 400);
      }
    }

    if (amountPaid > totalAmount) {
      const { error: overpaymentError } = await adminClient.from("overpayments").insert({
        shop_id: shopId,
        customer_id: customerId,
        customer_name: customer?.name || "Walk-in Customer",
        sale_id: sale.id,
        receipt_id: receiptId,
        amount: amountPaid - totalAmount,
        status: "pending",
        notes: `Change of ${shopResult.data.currency || "Le"} ${(amountPaid - totalAmount).toLocaleString()} from ${paymentLabel} payment`,
      });

      if (overpaymentError) {
        return jsonResponse({ error: overpaymentError.message || "Failed to record change owed." }, 400);
      }
    }

    return jsonResponse({
      success: true,
      saleId: sale.id,
      receiptId,
      totalAmount,
      changeAmount: Math.max(amountPaid - totalAmount, 0),
      receipt: {
        shopName: shopResult.data.name,
        shopAddress: shopResult.data.address || undefined,
        shopPhone: shopResult.data.phone || undefined,
        shopLogoUrl: shopResult.data.logo_url || undefined,
        receiptId,
        date: new Date().toISOString(),
        items: normalizedItems.map((item) => ({
          name: item.product.name,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          total: item.total,
        })),
        totalAmount,
        amountPaid,
        paymentType: paymentLabel,
        customerName: customer?.name || undefined,
        customerPhone: customer?.phone || undefined,
        customerAddress: customer?.address || undefined,
        currency: shopResult.data.currency || "Le",
        footer: shopResult.data.receipt_footer || undefined,
        transferDetails: paymentType === "transfer" ? transferDetails : undefined,
      },
    });
  } catch (error) {
    return jsonResponse(
      {
        error: error instanceof Error ? error.message : "Unexpected checkout error.",
      },
      500,
    );
  }
});