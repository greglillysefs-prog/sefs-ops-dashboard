import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-sefs-admin-pin",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type AdminAction = "login_options" | "job_crew_options" | "save_group_time_entries" | "pto_list" | "pto_request" | "pto_decision" | "list" | "upsert" | "deactivate" | "remove_employee" | "update_time_entry";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function cleanText(value: unknown) {
  return String(value ?? "").trim();
}

function ptoAccruedHours(startDate: unknown) {
  const startValue = cleanText(startDate) || "2026-07-01";
  const start = new Date(`${startValue}T00:00:00`);
  if (Number.isNaN(start.getTime())) return 0;

  const now = new Date();
  const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  if (firstOfMonth < start) return 0;

  const months =
    (firstOfMonth.getFullYear() - start.getFullYear()) * 12 +
    (firstOfMonth.getMonth() - start.getMonth()) +
    1;
  return months * 4;
}

function ptoBalance(employee: Record<string, unknown> | undefined, ledgerEntries: Record<string, unknown>[], requests: Record<string, unknown>[]) {
  const accrued = ptoAccruedHours(employee?.start_date);
  const ledger = (ledgerEntries || []).reduce((sum, entry) => {
    const hours = Math.abs(Number(entry.hours || 0));
    return sum + (entry.entry_type === "add" ? hours : -hours);
  }, 0);
  const pending = (requests || [])
    .filter((request) => request.status === "submitted")
    .reduce((sum, request) => sum + Math.abs(Number(request.hours || 0)), 0);
  const balance = accrued + ledger;
  return {
    accrued,
    ledger,
    pending,
    balance,
    available: Math.max(0, balance - pending),
  };
}

const elevatedRoles = ["crew_lead", "manager", "admin"];
const reviewRoles = ["manager", "admin"];

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
    if (action === "login_options") {
      const [{ data: profiles, error: profilesError }, usersResult] = await Promise.all([
        supa
          .from("profiles")
          .select("id, full_name, role, active")
          .eq("active", true)
          .order("full_name"),
        supa.auth.admin.listUsers({ page: 1, perPage: 1000 }),
      ]);

      if (profilesError) throw profilesError;
      if (usersResult.error) throw usersResult.error;

      const usersById = new Map((usersResult.data.users || []).map((user) => [user.id, user]));
      const options = (profiles || [])
        .map((profile) => {
          const user = usersById.get(profile.id);
          if (!user?.email) return null;
          return {
            name: profile.full_name || user.email,
            email: user.email,
            role: profile.role,
          };
        })
        .filter(Boolean)
        .sort((a, b) => String(a?.name || "").localeCompare(String(b?.name || "")));

      return json({ options });
    }

    async function getPortalActor() {
      const token = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
      if (!token) return { error: json({ error: "Login is required." }, 401) };

      const { data: authData, error: authError } = await supa.auth.getUser(token);
      if (authError || !authData.user) {
        return { error: json({ error: "Login could not be verified." }, 401) };
      }

      const { data: actorProfile, error: actorProfileError } = await supa
        .from("profiles")
        .select("id, employee_id, role, full_name, active")
        .eq("id", authData.user.id)
        .maybeSingle();
      if (actorProfileError) throw actorProfileError;
      if (!actorProfile?.active) {
        return { error: json({ error: "This profile is not active." }, 403) };
      }

      return { user: authData.user, profile: actorProfile };
    }

    if (action === "job_crew_options") {
      const actor = await getPortalActor();
      if (actor.error) return actor.error;
      if (!elevatedRoles.includes(String(actor.profile.role))) {
        return json({ error: "Crew lead access is required." }, 403);
      }

      const jobId = cleanText(payload.job_id);
      const assignments = jobId
        ? await supa
            .from("employee_job_assignments")
            .select("employee_id, assigned_role")
            .eq("job_id", jobId)
        : { data: [], error: null };
      if (assignments.error) throw assignments.error;

      const assignedIds = [...new Set((assignments.data || []).map((row) => row.employee_id).filter(Boolean))];
      const hasAssignments = assignedIds.length > 0;
      if (hasAssignments && !["manager", "admin"].includes(String(actor.profile.role)) && !assignedIds.includes(actor.profile.employee_id)) {
        return json({ error: "Crew leads can only enter crew time for jobs they are assigned to." }, 403);
      }

      let employeeQuery = supa.from("employees").select("id, name, active").eq("active", true);
      if (hasAssignments) employeeQuery = employeeQuery.in("id", assignedIds);
      employeeQuery = employeeQuery.order("name");

      const [{ data: employees, error: employeesError }, { data: profiles, error: profilesError }] = await Promise.all([
        employeeQuery,
        supa.from("profiles").select("id, employee_id, role, full_name, active").eq("active", true),
      ]);
      if (employeesError) throw employeesError;
      if (profilesError) throw profilesError;

      const profileByEmployee = new Map((profiles || []).map((profile) => [profile.employee_id, profile]));
      const crew = (employees || []).map((employee) => {
        const profile = profileByEmployee.get(employee.id);
        return {
          id: employee.id,
          name: profile?.full_name || employee.name,
          role: profile?.role || "employee",
          is_self: employee.id === actor.profile.employee_id,
          assignment_status: hasAssignments ? "assigned" : "available",
        };
      });

      return json({ employees: crew });
    }

    if (action === "save_group_time_entries") {
      const actor = await getPortalActor();
      if (actor.error) return actor.error;
      if (!elevatedRoles.includes(String(actor.profile.role))) {
        return json({ error: "Crew lead access is required." }, 403);
      }

      const jobId = cleanText(payload.job_id);
      const employeeIds = Array.isArray(payload.employee_ids)
        ? [...new Set(payload.employee_ids.map((id) => cleanText(id)).filter(Boolean))]
        : [];
      if (!employeeIds.length) return json({ error: "Choose at least one employee." }, 400);

      const assignments = jobId
        ? await supa
            .from("employee_job_assignments")
            .select("employee_id")
            .eq("job_id", jobId)
        : { data: [], error: null };
      if (assignments.error) throw assignments.error;

      const assignedIds = new Set((assignments.data || []).map((row) => row.employee_id));
      const hasAssignments = assignedIds.size > 0;
      if (hasAssignments && !["manager", "admin"].includes(String(actor.profile.role)) && !assignedIds.has(actor.profile.employee_id)) {
        return json({ error: "Crew leads can only enter crew time for jobs they are assigned to." }, 403);
      }

      const { data: activeEmployees, error: activeEmployeesError } = await supa
        .from("employees")
        .select("id")
        .in("id", employeeIds)
        .eq("active", true);
      if (activeEmployeesError) throw activeEmployeesError;
      const activeIds = new Set((activeEmployees || []).map((employee) => employee.id));

      const invalidIds = employeeIds.filter((id) => (hasAssignments ? !assignedIds.has(id) : !activeIds.has(id)));
      if (invalidIds.length) {
        return json({ error: hasAssignments ? "Crew time can only be entered for employees assigned to the selected job." : "Crew time can only be entered for active employees." }, 400);
      }

      const { data: profiles, error: profilesError } = await supa
        .from("profiles")
        .select("id, employee_id, active")
        .in("employee_id", employeeIds)
        .eq("active", true);
      if (profilesError) throw profilesError;
      const profileByEmployee = new Map((profiles || []).map((profile) => [profile.employee_id, profile]));

      const basePayload = {
        job_id: jobId || null,
        work_date: cleanText(payload.work_date),
        start_time: cleanText(payload.start_time),
        end_time: cleanText(payload.end_time),
        break_minutes: 0,
        notes: cleanText(payload.notes) || null,
        status: cleanText(payload.status) || "draft",
        device_info: cleanText(payload.device_info) || null,
        change_reason: `Crew time entered by ${actor.profile.full_name || actor.user.email || "crew lead"}`,
      };

      if (!basePayload.work_date || !basePayload.start_time || !basePayload.end_time) {
        return json({ error: "Date, start time, and end time are required." }, 400);
      }

      const rows = employeeIds.map((employeeId) => ({
        ...basePayload,
        employee_id: employeeId,
        user_id: profileByEmployee.get(employeeId)?.id || null,
      }));

      const { data, error } = await supa.from("time_entries").insert(rows).select();
      if (error) throw error;
      return json({ ok: true, time_entries: data || [] });
    }

    if (action === "pto_list") {
      const actor = await getPortalActor();
      if (actor.error) return actor.error;
      const canReviewPto = reviewRoles.includes(String(actor.profile.role));

      let query = supa
        .from("pto_requests")
        .select("*")
        .order("request_date", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(200);
      if (!canReviewPto) query = query.eq("employee_id", actor.profile.employee_id);

      const [{ data: requests, error: requestsError }, { data: employees, error: employeesError }] = await Promise.all([
        query,
        supa.from("employees").select("id, name, start_date").order("name"),
      ]);
      if (requestsError) throw requestsError;
      if (employeesError) throw employeesError;

      const employeesById = new Map((employees || []).map((employee) => [employee.id, employee]));
      const employeeIds = [...new Set((canReviewPto ? employees || [] : (employees || []).filter((employee) => employee.id === actor.profile.employee_id)).map((employee) => employee.id).filter(Boolean))];
      const { data: ledgerEntries, error: ledgerError } = employeeIds.length
        ? await supa
            .from("personal_time_entries")
            .select("employee_id, entry_type, hours")
            .in("employee_id", employeeIds)
        : { data: [], error: null };
      if (ledgerError) throw ledgerError;

      const balanceByEmployee = new Map(employeeIds.map((employeeId) => {
        const employee = employeesById.get(employeeId);
        const employeeLedger = (ledgerEntries || []).filter((entry) => entry.employee_id === employeeId);
        const employeeRequests = (requests || []).filter((request) => request.employee_id === employeeId);
        return [employeeId, ptoBalance(employee, employeeLedger, employeeRequests)];
      }));
      const rows = (requests || []).map((request) => ({
        ...request,
        employee_name: employeesById.get(request.employee_id)?.name || "Employee",
      }));
      return json({
        pto_entries: rows,
        pto_balance: balanceByEmployee.get(actor.profile.employee_id) || ptoBalance(employeesById.get(actor.profile.employee_id), [], []),
        pto_balances: Object.fromEntries(balanceByEmployee),
      });
    }

    if (action === "pto_request") {
      const actor = await getPortalActor();
      if (actor.error) return actor.error;

      const requestDate = cleanText(payload.request_date);
      const hours = Number(payload.hours || 0);
      const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
      if (!requestDate || requestDate < tomorrow) {
        return json({ error: "PTO requests must use a future date." }, 400);
      }
      if (!Number.isFinite(hours) || hours <= 0) {
        return json({ error: "PTO hours must be greater than zero." }, 400);
      }
      if (!actor.profile.employee_id) {
        return json({ error: "Your profile is not linked to an employee record." }, 400);
      }

      const [
        { data: employee, error: employeeError },
        { data: ledgerEntries, error: ledgerError },
        { data: pendingRequests, error: pendingRequestsError },
      ] = await Promise.all([
        supa.from("employees").select("id, start_date").eq("id", actor.profile.employee_id).maybeSingle(),
        supa.from("personal_time_entries").select("entry_type, hours").eq("employee_id", actor.profile.employee_id),
        supa.from("pto_requests").select("status, hours").eq("employee_id", actor.profile.employee_id).eq("status", "submitted"),
      ]);
      if (employeeError) throw employeeError;
      if (ledgerError) throw ledgerError;
      if (pendingRequestsError) throw pendingRequestsError;

      const balance = ptoBalance(employee || undefined, ledgerEntries || [], pendingRequests || []);
      if (hours > balance.available + 0.001) {
        return json({ error: `Only ${balance.available.toFixed(2)} PTO hours are available.` }, 400);
      }

      const { data, error } = await supa
        .from("pto_requests")
        .insert({
          employee_id: actor.profile.employee_id,
          user_id: actor.user.id,
          request_date: requestDate,
          hours,
          notes: cleanText(payload.notes) || null,
          status: "submitted",
        })
        .select()
        .single();
      if (error) throw error;
      return json({ ok: true, pto_entry: data });
    }

    if (action === "pto_decision") {
      const actor = await getPortalActor();
      if (actor.error) return actor.error;
      if (!reviewRoles.includes(String(actor.profile.role))) {
        return json({ error: "Manager or admin access is required to approve PTO." }, 403);
      }

      const id = cleanText(payload.id);
      const status = cleanText(payload.status);
      if (!id) return json({ error: "PTO request id is required." }, 400);
      if (!["approved", "rejected"].includes(status)) return json({ error: "PTO status must be approved or rejected." }, 400);

      const { data: request, error: requestError } = await supa
        .from("pto_requests")
        .select("*")
        .eq("id", id)
        .single();
      if (requestError) throw requestError;
      if (request.status === "approved" && status === "rejected") {
        return json({ error: "Approved PTO has already been added to the PTO ledger." }, 400);
      }

      let personalTimeEntryId = request.personal_time_entry_id || null;
      if (status === "approved" && !personalTimeEntryId) {
        const [
          { data: employee, error: employeeError },
          { data: ledgerEntries, error: balanceLedgerError },
          { data: pendingRequests, error: pendingRequestsError },
        ] = await Promise.all([
          supa.from("employees").select("id, start_date").eq("id", request.employee_id).maybeSingle(),
          supa.from("personal_time_entries").select("entry_type, hours").eq("employee_id", request.employee_id),
          supa.from("pto_requests").select("id, status, hours").eq("employee_id", request.employee_id).eq("status", "submitted"),
        ]);
        if (employeeError) throw employeeError;
        if (balanceLedgerError) throw balanceLedgerError;
        if (pendingRequestsError) throw pendingRequestsError;

        const otherPendingRequests = (pendingRequests || []).filter((pendingRequest) => pendingRequest.id !== request.id);
        const balance = ptoBalance(employee || undefined, ledgerEntries || [], otherPendingRequests);
        if (Number(request.hours || 0) > balance.available + 0.001) {
          return json({ error: `Only ${balance.available.toFixed(2)} PTO hours are available for approval.` }, 400);
        }

        const { data: ledgerEntry, error: ledgerError } = await supa
          .from("personal_time_entries")
          .insert({
            employee_id: request.employee_id,
            entry_type: "used",
            hours: request.hours,
            date_used: request.request_date,
            manager: actor.profile.full_name || actor.user.email || "manager",
            notes: request.notes,
          })
          .select("id")
          .single();
        if (ledgerError) throw ledgerError;
        personalTimeEntryId = ledgerEntry?.id || null;
      }

      const { data, error } = await supa
        .from("pto_requests")
        .update({
          status,
          manager_id: actor.user.id,
          manager_note: cleanText(payload.manager_note) || null,
          decided_at: new Date().toISOString(),
          personal_time_entry_id: personalTimeEntryId,
          updated_at: new Date().toISOString(),
        })
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return json({ ok: true, pto_entry: data });
    }

    if (req.headers.get("x-sefs-admin-pin") !== adminPin) {
      return json({ error: "Invalid employee admin PIN." }, 401);
    }

    let adminActorUserId: string | null = null;
    if (action === "remove_employee") {
      const token = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
      if (!token) return json({ error: "Admin login is required to remove an employee." }, 401);

      const { data: authData, error: authError } = await supa.auth.getUser(token);
      if (authError || !authData.user) {
        return json({ error: "Admin login could not be verified." }, 401);
      }

      const { data: actorProfile, error: actorProfileError } = await supa
        .from("profiles")
        .select("id, role, active")
        .eq("id", authData.user.id)
        .maybeSingle();
      if (actorProfileError) throw actorProfileError;
      if (!actorProfile?.active || actorProfile.role !== "admin") {
        return json({ error: "Only an active admin can remove an employee." }, 403);
      }

      adminActorUserId = authData.user.id;
    }

    if (action === "list") {
      const [
        { data: employees, error: employeesError },
        { data: profiles, error: profilesError },
        { data: timeEntries, error: timeEntriesError },
        { data: jobs, error: jobsError },
        { data: auditLogs, error: auditLogsError },
        usersResult,
      ] =
        await Promise.all([
          supa.from("employees").select("id, name, active, start_date, notes, created_at").order("name"),
          supa.from("profiles").select("id, employee_id, role, full_name, active, created_at, updated_at").order("full_name"),
          supa
            .from("time_entries")
            .select("id, employee_id, user_id, job_id, work_date, start_time, end_time, break_minutes, total_hours, notes, status, submitted_at, approved_by, approved_at, rejected_by, rejected_at, rejection_reason, device_info, change_reason, created_at, updated_at, deleted_at")
            .order("work_date", { ascending: false })
            .order("created_at", { ascending: false })
            .limit(150),
          supa
            .from("jobs")
            .select("id, customer, job_name, address, system_type, status, start_date, start_time")
            .order("created_at", { ascending: false })
            .limit(500),
          supa
            .from("time_entry_audit_logs")
            .select("id, time_entry_id, employee_id, actor_user_id, action_type, previous_values, new_values, ip_address, device_info, reason, created_at")
            .order("created_at", { ascending: false })
            .limit(200),
          supa.auth.admin.listUsers({ page: 1, perPage: 1000 }),
        ]);

      if (employeesError) throw employeesError;
      if (profilesError) throw profilesError;
      if (timeEntriesError) throw timeEntriesError;
      if (jobsError) throw jobsError;
      if (auditLogsError) throw auditLogsError;
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

      return json({ rows, time_entries: timeEntries || [], jobs: jobs || [], audit_logs: auditLogs || [] });
    }

    if (action === "upsert") {
      const fullName = cleanText(payload.full_name);
      const email = cleanText(payload.email).toLowerCase();
      const role = cleanText(payload.role) || "employee";
      const passwordFromRequest = cleanText(payload.password);
      let employeeId = cleanText(payload.employee_id);

      if (!fullName) return json({ error: "Employee name is required." }, 400);
      if (!email) return json({ error: "Email is required." }, 400);
      if (!passwordFromRequest || passwordFromRequest.length < 6) {
        return json({ error: "Password is required and must be at least 6 characters." }, 400);
      }
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
      let userId = existingUser?.id;

      if (existingUser) {
        const updateBody: Record<string, unknown> = {
          email,
          password: passwordFromRequest,
          user_metadata: { full_name: fullName, employee_id: employeeId },
        };

        const { error: userUpdateError } = await supa.auth.admin.updateUserById(existingUser.id, updateBody);
        if (userUpdateError) throw userUpdateError;
      } else {
        const { data: created, error: createUserError } = await supa.auth.admin.createUser({
          email,
          password: passwordFromRequest,
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
      });
    }

    if (action === "update_time_entry") {
      const id = cleanText(payload.id);
      if (!id) return json({ error: "Time entry id is required." }, 400);

      const status = cleanText(payload.status) || "draft";
      if (!["draft", "submitted", "approved", "rejected"].includes(status)) {
        return json({ error: "Invalid time entry status." }, 400);
      }

      const updateBody: Record<string, unknown> = {
        work_date: cleanText(payload.work_date),
        start_time: cleanText(payload.start_time),
        end_time: cleanText(payload.end_time),
        break_minutes: Number(payload.break_minutes || 0),
        notes: cleanText(payload.notes) || null,
        status,
        rejection_reason: status === "rejected" ? cleanText(payload.rejection_reason) || null : null,
        change_reason: cleanText(payload.change_reason) || "Manager edit from Employee Admin",
        device_info: cleanText(payload.device_info) || null,
      };

      if (!updateBody.work_date || !updateBody.start_time || !updateBody.end_time) {
        return json({ error: "Date, start time, and end time are required." }, 400);
      }

      const { data, error } = await supa
        .from("time_entries")
        .update(updateBody)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return json({ ok: true, time_entry: data });
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

    if (action === "remove_employee") {
      const employeeId = cleanText(payload.employee_id);
      const userId = cleanText(payload.user_id);
      const reason = cleanText(payload.reason) || "Employee removed from Employee Admin";
      if (!employeeId) return json({ error: "Employee id is required." }, 400);

      const [{ data: employeeBefore, error: employeeFetchError }, { data: profileBefore, error: profileFetchError }] =
        await Promise.all([
          supa.from("employees").select("*").eq("id", employeeId).maybeSingle(),
          userId
            ? supa.from("profiles").select("*").eq("id", userId).maybeSingle()
            : supa.from("profiles").select("*").eq("employee_id", employeeId).maybeSingle(),
        ]);

      if (employeeFetchError) throw employeeFetchError;
      if (profileFetchError) throw profileFetchError;
      if (!employeeBefore) return json({ error: "Employee was not found." }, 404);

      let authUserBefore: Record<string, unknown> | null = null;
      if (userId) {
        const userResult = await supa.auth.admin.getUserById(userId);
        if (!userResult.error && userResult.data.user) {
          authUserBefore = {
            id: userResult.data.user.id,
            email: userResult.data.user.email,
            created_at: userResult.data.user.created_at,
            last_sign_in_at: userResult.data.user.last_sign_in_at,
          };
        }
      }

      if (userId) {
        const deleteUserResult = await supa.auth.admin.deleteUser(userId);
        if (deleteUserResult.error) throw deleteUserResult.error;
      }

      const { error: deleteProfileError } = userId
        ? await supa.from("profiles").delete().eq("id", userId)
        : await supa.from("profiles").delete().eq("employee_id", employeeId);
      if (deleteProfileError) throw deleteProfileError;

      const removedName = `Removed employee ${employeeId.slice(0, 8)}`;
      const { error: employeeUpdateError } = await supa
        .from("employees")
        .update({
          name: removedName,
          active: false,
          notes: `Removed from Employee Admin on ${new Date().toISOString()}. Historical records retained.`,
        })
        .eq("id", employeeId);
      if (employeeUpdateError) throw employeeUpdateError;

      const { error: auditError } = await supa.from("time_entry_audit_logs").insert({
        time_entry_id: null,
        employee_id: employeeId,
        actor_user_id: adminActorUserId,
        action_type: "employee_removed",
        previous_values: {
          employee: employeeBefore,
          profile: profileBefore,
          auth_user: authUserBefore,
        },
        new_values: {
          employee_id: employeeId,
          employee_name: removedName,
          profile_deleted: true,
          auth_user_deleted: Boolean(userId),
          historical_records_retained: true,
        },
        device_info: cleanText(payload.device_info) || null,
        reason,
      });
      if (auditError) throw auditError;

      return json({ ok: true });
    }

    return json({ error: "Unknown action." }, 400);
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : String(error) }, 500);
  }
});
