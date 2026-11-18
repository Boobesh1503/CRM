
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const respond = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  try {
    if (req.method !== "POST") {
      return respond({ error: "Method not allowed" }, 405);
    }

    const url = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey =
      Deno.env.get("CRM_SERVICE_ROLE_KEY") ||
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!url || !anonKey || !serviceKey) {
      return respond({ error: "Server configuration is incomplete" }, 500);
    }

    const authorization = req.headers.get("Authorization");
    if (!authorization) {
      return respond({ error: "Authentication required" }, 401);
    }

    const userClient = createClient(url, anonKey, {
      global: { headers: { Authorization: authorization } },
    });

    const { data: { user }, error: authError } = await userClient.auth.getUser();

    if (authError || !user) {
      return respond({ error: "Invalid authentication" }, 401);
    }

    const adminClient = createClient(url, serviceKey);

    const { data: role } = await adminClient
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .maybeSingle();

    if (role?.role !== "admin") {
      return respond({ error: "Admin access required" }, 403);
    }

    const { employeeId } = await req.json();

    if (!employeeId) {
      return respond({ error: "Employee ID is required" }, 400);
    }

    const { data: employee, error: employeeError } = await adminClient
      .from("employees")
      .select("id, email, full_name, role, auth_user_id")
      .eq("id", employeeId)
      .single();

    if (employeeError || !employee) {
      return respond({ error: "Employee not found" }, 404);
    }

    if (employee.auth_user_id) {
      return respond({ error: "Employee already has a login account" }, 409);
    }

    const appRole =
      employee.role === "team_leader" ? "team_leader" : "employee";

    const { data: invitation, error: inviteError } =
      await adminClient.auth.admin.inviteUserByEmail(employee.email, {
        data: { full_name: employee.full_name },
      });

    if (inviteError || !invitation.user) {
      return respond({ error: inviteError?.message ?? "Invitation failed" }, 400);
    }

    const invitedUserId = invitation.user.id;

    const { error: linkError } = await adminClient
      .from("employees")
      .update({ auth_user_id: invitedUserId })
      .eq("id", employee.id);

    if (linkError) {
      return respond({
        error: "Account invited, but employee linking failed. Contact an administrator.",
      }, 500);
    }

    const { error: roleError } = await adminClient
      .from("user_roles")
      .upsert({ user_id: invitedUserId, role: appRole });

    if (roleError) {
      return respond({
        error: "Account invited, but role assignment failed. Contact an administrator.",
      }, 500);
    }

    return respond({
      success: true,
      message: "Employee invitation sent successfully.",
    });
  } catch {
    return respond({ error: "Unexpected server error" }, 500);
  }
});
