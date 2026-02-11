import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const authHeader = req.headers.get("Authorization");

    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify the calling user
    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_PUBLISHABLE_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user: callingUser }, error: authError } = await userClient.auth.getUser();
    if (authError || !callingUser) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { username, password, displayName, role, shopId } = await req.json();

    if (!username || !password || !shopId) {
      return new Response(JSON.stringify({ error: "Missing required fields: username, password, shopId" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify calling user is shop owner
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    const { data: shop } = await adminClient
      .from("shops")
      .select("id, owner_id, plan_type, staff_limit")
      .eq("id", shopId)
      .single();

    if (!shop || shop.owner_id !== callingUser.id) {
      return new Response(JSON.stringify({ error: "Only shop owners can add staff" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check staff limit
    const { count: currentStaff } = await adminClient
      .from("user_roles")
      .select("*", { count: "exact", head: true })
      .eq("shop_id", shopId);

    const staffLimit = shop.plan_type === "organization" ? 999999 : (shop.staff_limit || 5);
    if ((currentStaff || 0) >= staffLimit) {
      return new Response(JSON.stringify({ error: `Staff limit reached (${staffLimit}). Upgrade your plan for more.` }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check if username already exists
    const { data: existingCred } = await adminClient
      .from("staff_credentials")
      .select("id")
      .eq("username", username)
      .maybeSingle();

    if (existingCred) {
      return new Response(JSON.stringify({ error: "Username already taken" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Generate a unique email for this staff member
    const staffEmail = `${username.toLowerCase().replace(/[^a-z0-9]/g, "")}@shop-${shopId.slice(0, 8)}.staff.local`;

    // Create auth user with admin API
    const { data: newUser, error: createError } = await adminClient.auth.admin.createUser({
      email: staffEmail,
      password: password,
      email_confirm: true,
      user_metadata: {
        display_name: displayName || username,
        shop_id: shopId,
      },
    });

    if (createError) {
      return new Response(JSON.stringify({ error: createError.message }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Create profile
    await adminClient.from("profiles").insert({
      user_id: newUser.user.id,
      display_name: displayName || username,
    });

    // Create user role
    await adminClient.from("user_roles").insert({
      user_id: newUser.user.id,
      shop_id: shopId,
      role: role || "staff",
    });

    // Create staff credentials
    await adminClient.from("staff_credentials").insert({
      shop_id: shopId,
      user_id: newUser.user.id,
      username: username,
      email: staffEmail,
    });

    return new Response(
      JSON.stringify({
        success: true,
        user: {
          id: newUser.user.id,
          username,
          displayName: displayName || username,
          role: role || "staff",
        },
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
