import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-sefs-admin-pin",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type AdminAction = "list" | "upsert" | "deactivate";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function cleanText(value: unknown) {
  return String(value ?? "").trim();
}

function randomPassword() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@$";
  crypto.getRandomValues(new Uint32Array(1));
  const bytes = new Uint8Array(18);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => alphabet[byte % alphabet.length]).join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return json({ error: "POST required" }, 405);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const adminPin = Deno.env.get("SEFS_EMPLOYEE_ADMIN_PIN");

  if (!supabaseUrl || !serviceRoleKey || !adminPin) {
    return json({ error: "Employee admin function is missing required environment variables." }, 500);
  }

  if (req.headers.get("x-sefs-admin-pin") !== adminPin) {
    return json({ error: "Invalid employee admin PIN." }, 401);
  }

  const supa = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  let payload: Record<string, unknown>;
  try {
    payload = await req.json();
  } catch {
    return json({ error: "Invalid JSON payload." }, 400);
  }

  const action = cleanText(payload.action) as AdminAction;

  try {
    if (action === "list") {
      const [{ data: employees, error: employeesError }, { data: profiles, error: profilesError }, usersResult] =
        await Promise.all([
          supa.from("employees").select("id, name, active, start_date, notes, created_at").order("name"),
          supa.from("profiles").select("id, employee_id, role, full_name, active, created_at, updated_at").order("full_name"),
          supa.auth.admin.listUsers({ page: 1, perPage: 1000 }),
        ]);

      if (employeesError) throw employeesError;
      if (profilesError) throw profilesError;
      if (usersResult.error) throw usersResult.error;

      const usersById = new Map((usersResult.data.users || []).map((user) => [user.id, user]));
      const rows = (employees || []).map((employee) => {
        const profile = (profiles || []).find((item) => item.employee_id === employee.id);
        const user = profile ? usersById.get(profile.id) : null;
        return {
          employee,
          profile: profile || null,
          auth_user: user
            ? {
                id: user.id,
                email: user.email,
                created_at: user.created_at,
                last_sign_in_at: user.last_sign_in_at,
              }
            : null,
        };
      });

      return json({ rows });
    }

    if (action === "upsert") {
      const fullName = cleanText(payload.full_name);
      const email = cleanText(payload.email).toLowerCase();
      const role = cleanText(payload.role) || "employee";
      const passwordFromRequest = cleanText(payload.password);
      let employeeId = cleanText(payload.employee_id);

      if (!fullName) return json({ error: "Employee name is required." }, 400);
      if (!email) return json({ error: "Email is required." }, 400);
      if (!["employee", "crew_lead", "manager", "admin"].includes(role)) {
        return json({ error: "Invalid role." }, 400);
      }

      if (!employeeId) {
        const { data: existingEmployee, error: findEmployeeError } = await supa
          .from("employees")
          .select("id")
          .ilike("name", fullName)
          .maybeSingle();
        if (findEmployeeError) throw findEmployeeError;

        if (existingEmployee?.id) {
          employeeId = existingEmployee.id;
          await supa.from("employees").update({ active: true }).eq("id", employeeId);
        } else {
          const { data: employee, error: employeeError } = await supa
            .from("employees")
            .insert({ name: fullName, active: true, start_date: new Date().toISOString().slice(0, 10) })
            .select("id")
            .single();
          if (employeeError) throw employeeError;
          employeeId = employee.id;
        }
      } else {
        const { error: employeeUpdateError } = await supa
          .from("employees")
          .update({ name: fullName, active: true })
          .eq("id", employeeId);
        if (employeeUpdateError) throw employeeUpdateError;
      }

      const users = await supa.auth.admin.listUsers({ page: 1, perPage: 1000 });
      if (users.error) throw users.error;

      const existingUser = (users.data.users || []).find((user) => user.email?.toLowerCase() === email);
      const generatedPassword = passwordFromRequest || randomPassword();
      let userId = existingUser?.id;

      if (existingUser) {
        const updateBody: Record<string, unknown> = {
          email,
          user_metadata: { full_name: fullName, employee_id: employeeId },
        };
        if (passwordFromRequest) updateBody.password = passwordFromRequest;

        const { error: userUpdateError } = await supa.auth.admin.updateUserById(existingUser.id, updateBody);
        if (userUpdateError) throw userUpdateError;
      } else {
        const { data: created, error: createUserError } = await supa.auth.admin.createUser({
          email,
          password: generatedPassword,
          email_confirm: true,
          user_metadata: { full_name: fullName, employee_id: employeeId },
        });
        if (createUserError) throw createUserError;
        userId = created.user.id;
      }

      if (!userId) return json({ error: "Could not create or find Auth user." }, 500);

      const { error: profileError } = await supa.from("profiles").upsert({
        id: userId,
        employee_id: employeeId,
        role,
        full_name: fullName,
        active: true,
        updated_at: new Date().toISOString(),
      });
      if (profileError) throw profileError;

      return json({
        ok: true,
        employee_id: employeeId,
        user_id: userId,
        temporary_password: existingUser || passwordFromRequest ? null : generatedPassword,
      });
    }

    if (action === "deactivate") {
      const employeeId = cleanText(payload.employee_id);
      const userId = cleanText(payload.user_id);
      if (!employeeId && !userId) return json({ error: "Employee or user id is required." }, 400);

      if (employeeId) {
        const { error: employeeError } = await supa.from("employees").update({ active: false }).eq("id", employeeId);
        if (employeeError) throw employeeError;
      }

      if (userId) {
        const { error: profileError } = await supa
          .from("profiles")
          .update({ active: false, updated_at: new Date().toISOString() })
          .eq("id", userId);
        if (profileError) throw profileError;
      } else if (employeeId) {
        const { error: profileError } = await supa
          .from("profiles")
          .update({ active: false, updated_at: new Date().toISOString() })
          .eq("employee_id", employeeId);
        if (profileError) throw profileError;
      }

      return json({ ok: true });
    }

    return json({ error: "Unknown action." }, 400);
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : String(error) }, 500);
  }
});
