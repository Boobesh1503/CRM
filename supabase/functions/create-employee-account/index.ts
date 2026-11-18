import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  const respond = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return respond({ error: "Method not allowed" }, 405);
  }

  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey =
      Deno.env.get("CRM_SERVICE_ROLE_KEY") ||
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!url || !anonKey || !serviceKey) {
      return respond({ error: "Server configuration is incomplete" }, 500);
    }

    const authorization = req.headers.get("Authorization");

    if (!authorization?.startsWith("Bearer ")) {
      return respond({ error: "Authentication required" }, 401);
    }

    const token = authorization.replace(/^Bearer\s+/i, "");

    const userClient = createClient(url, anonKey);
    const {
      data: { user },
      error: authError,
    } = await userClient.auth.getUser(token);

    if (authError || !user) {
      return respond({ error: "Invalid authentication" }, 401);
    }

    const adminClient = createClient(url, serviceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    const { data: adminRole, error: adminRoleError } = await adminClient
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .maybeSingle();

    if (adminRoleError || adminRole?.role !== "admin") {
      return respond({ error: "Admin access required" }, 403);
    }

    const body = await req.json();
    const { employeeId, employeeData, temporaryPassword } = body;

    if (typeof temporaryPassword !== "string" || !temporaryPassword) {
      return respond({ error: "Temporary password is required" }, 400);
    }

    const strongPassword =
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;

    if (!strongPassword.test(temporaryPassword)) {
      return respond(
        {
          error:
            "Password must have at least 8 characters, uppercase, lowercase, number and special character",
        },
        400
      );
    }

    // MODE 1: Create both Employee Profile and Supabase Auth Account atomically
    if (employeeData && typeof employeeData === "object") {
      const fullName = (employeeData.fullName || "").trim();
      const email = (employeeData.email || "").trim().toLowerCase();
      const phone = (employeeData.phone || "").trim();
      const role = employeeData.role || "intern";
      const department = employeeData.department || "Sales";

      if (!fullName || !email || !phone) {
        return respond(
          { error: "Full name, email, and phone number are required" },
          400
        );
      }

      // Check for existing employee with same email
      const { data: existingEmp } = await adminClient
        .from("employees")
        .select("id")
        .eq("email", email)
        .maybeSingle();

      if (existingEmp) {
        return respond(
          { error: "An employee with this email already exists" },
          409
        );
      }

      const employeeCode = `EMP-${Date.now()}`;

      // Step 1: Create employee profile using adminClient
      const { data: newEmployee, error: createEmpError } = await adminClient
        .from("employees")
        .insert({
          employee_code: employeeCode,
          full_name: fullName,
          email,
          phone,
          role,
          department,
          employment_status: "active",
        })
        .select("id, email, full_name, role")
        .single();

      if (createEmpError || !newEmployee) {
        return respond(
          {
            error:
              createEmpError?.message ?? "Failed to create employee profile",
          },
          400
        );
      }

      const createdEmpId = newEmployee.id;

      // Step 2: Create Auth User
      const { data: createdAuth, error: createAuthError } =
        await adminClient.auth.admin.createUser({
          email,
          password: temporaryPassword,
          email_confirm: true,
          user_metadata: {
            full_name: fullName,
          },
        });

      if (createAuthError || !createdAuth.user) {
        // Roll back created employee record with admin rights
        await adminClient.from("employees").delete().eq("id", createdEmpId);
        return respond(
          { error: createAuthError?.message ?? "Account creation failed" },
          400
        );
      }

      const newUserId = createdAuth.user.id;
      const appRole = role === "team_leader" ? "team_leader" : "employee";

      // Step 3: Assign user role
      const { error: roleError } = await adminClient.from("user_roles").insert({
        user_id: newUserId,
        role: appRole,
      });

      if (roleError) {
        // Roll back Auth user and employee record
        await adminClient.auth.admin.deleteUser(newUserId);
        await adminClient.from("employees").delete().eq("id", createdEmpId);
        return respond({ error: "Could not assign employee role" }, 500);
      }

      // Step 4: Link auth_user_id in employees
      const { error: linkError } = await adminClient
        .from("employees")
        .update({ auth_user_id: newUserId })
        .eq("id", createdEmpId);

      if (linkError) {
        // Roll back all created resources
        await adminClient.from("user_roles").delete().eq("user_id", newUserId);
        await adminClient.auth.admin.deleteUser(newUserId);
        await adminClient.from("employees").delete().eq("id", createdEmpId);
        return respond(
          {
            error:
              "Could not link the login account to the employee profile",
          },
          500
        );
      }

      return respond({
        success: true,
        message: "Employee and login account created successfully",
        employeeEmail: email,
        userId: newUserId,
        employeeId: createdEmpId,
      });
    }

    // MODE 2: Provision login account for an existing employeeId
    if (typeof employeeId === "string" && employeeId) {
      const { data: employee, error: employeeError } = await adminClient
        .from("employees")
        .select("id, email, full_name, role, auth_user_id")
        .eq("id", employeeId)
        .single();

      if (employeeError || !employee) {
        return respond({ error: "Employee not found" }, 404);
      }

      if (employee.auth_user_id) {
        return respond(
          { error: "This employee already has a login account" },
          409
        );
      }

      const appRole =
        employee.role === "team_leader" ? "team_leader" : "employee";

      const { data: created, error: createError } =
        await adminClient.auth.admin.createUser({
          email: employee.email,
          password: temporaryPassword,
          email_confirm: true,
          user_metadata: {
            full_name: employee.full_name,
          },
        });

      if (createError || !created.user) {
        return respond(
          { error: createError?.message ?? "Account creation failed" },
          400
        );
      }

      const newUserId = created.user.id;

      const { error: roleError } = await adminClient.from("user_roles").insert({
        user_id: newUserId,
        role: appRole,
      });

      if (roleError) {
        await adminClient.auth.admin.deleteUser(newUserId);
        return respond({ error: "Could not assign employee role" }, 500);
      }

      const { data: linkedEmployee, error: linkError } = await adminClient
        .from("employees")
        .update({ auth_user_id: newUserId })
        .eq("id", employee.id)
        .is("auth_user_id", null)
        .select("id")
        .maybeSingle();

      if (linkError || !linkedEmployee) {
        await adminClient.from("user_roles").delete().eq("user_id", newUserId);
        await adminClient.auth.admin.deleteUser(newUserId);
        return respond(
          {
            error:
              "Could not link the login account to the employee profile",
          },
          500
        );
      }

      return respond({
        success: true,
        message: "Employee login account created successfully",
        employeeEmail: employee.email,
        userId: newUserId,
      });
    }

    return respond(
      { error: "Either employeeData or employeeId is required" },
      400
    );
  } catch {
    return respond({ error: "Unexpected server error" }, 500);
  }
});
