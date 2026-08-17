import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type AnyRecord = Record<string, any>;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function clean(value: unknown) {
  return String(value ?? "").trim();
}

function todayIso() {
  return new Date().toISOString();
}

function isoDate(value: Date) {
  return value.toISOString().slice(0, 10);
}

function addDays(dateText: string, days: number) {
  const date = new Date(`${dateText}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return isoDate(date);
}

function cleanTime(value: unknown) {
  const text = clean(value);
  if (!text) return "";
  const match = text.match(/^(\d{1,2}):(\d{2})/);
  return match ? `${match[1].padStart(2, "0")}:${match[2]}` : "";
}

function timePlus(value: string, minutes = 60) {
  const [h, m] = (cleanTime(value) || "08:00").split(":").map(Number);
  const date = new Date(Date.UTC(2000, 0, 1, h || 0, m || 0));
  date.setUTCMinutes(date.getUTCMinutes() + minutes);
  return `${String(date.getUTCHours()).padStart(2, "0")}:${String(date.getUTCMinutes()).padStart(2, "0")}`;
}

function googleEventDateParts(value: AnyRecord | undefined, isEnd = false) {
  if (value?.dateTime) return { date: String(value.dateTime).slice(0, 10), time: String(value.dateTime).slice(11, 16) };
  if (value?.date) return { date: isEnd ? addDays(String(value.date), -1) : String(value.date), time: "" };
  return { date: "", time: "" };
}

function generatedDescription(description: string) {
  return description.includes("Open mobile job view:") || description.includes("Materials list:");
}

function parsePhone(text: string) {
  const match = text.match(/(?:\+?1[\s.-]?)?(?:\(?\d{3}\)?[\s.-]?)\d{3}[\s.-]?\d{4}/);
  return match ? match[0].trim() : "";
}

function parseSquareFeet(text: string) {
  const match = text.match(/([\d,]+(?:\.\d+)?)\s*(?:sq\.?\s*ft|sqft|square\s*feet|sf)\b/i);
  return match ? Number(match[1].replace(/,/g, "")) || 0 : 0;
}

function parseSystem(text: string) {
  const options = [
    "Broom Overlay",
    "Grind/Stain/Seal",
    "Wood/Stone Overlay",
    "Metallic",
    "Quartz",
    "Flake",
    "Mortar",
    "Polish",
    "Prep Only",
  ];
  const lower = text.toLowerCase();
  return options.find((option) => lower.includes(option.toLowerCase().replace(/\//g, " "))) ||
    options.find((option) => lower.includes(option.toLowerCase())) ||
    "";
}

function titleParts(summary: string) {
  const parts = summary.split(/\s+-\s+/).map((part) => part.trim()).filter(Boolean);
  if (parts.length >= 2) return { customer: parts[0], job_name: parts[0], system_type: parseSystem(parts.slice(1).join(" ")) || parts.slice(1).join(", ") };
  return { customer: "", job_name: summary, system_type: parseSystem(summary) };
}

function importCustomerName(fields: AnyRecord) {
  return clean(fields.customer) || clean(fields.job_name) || "Google Calendar Import";
}

function displayCustomerName(job: AnyRecord) {
  const customer = clean(job.customer);
  return customer === "Google Calendar Import" ? "" : customer;
}

function googleEventToJobFields(event: AnyRecord, currentJob: AnyRecord | null = null) {
  const start = googleEventDateParts(event.start, false);
  const end = googleEventDateParts(event.end, true);
  let notes = clean(event.description);
  if (currentJob && generatedDescription(notes)) notes = clean(currentJob.notes);
  const summary = clean(event.summary);
  const combined = `${summary}\n${clean(event.location)}\n${notes}`;
  const title = currentJob
    ? {
        customer: clean(currentJob.customer),
        job_name: summary || clean(currentJob.job_name),
        system_type: clean(currentJob.system_type) || parseSystem(summary),
      }
    : titleParts(summary);
  return {
    ...title,
    phone: parsePhone(combined),
    address: clean(event.location),
    notes,
    square_feet: parseSquareFeet(combined),
    start_date: start.date || null,
    start_time: start.time || null,
    end_date: end.date || start.date || null,
    end_time: end.time || null,
  };
}

function jobScheduleTitle(job: AnyRecord) {
  return displayCustomerName(job) || clean(job.job_name) || "Unknown";
}

function googleCalendarTitle(job: AnyRecord) {
  return [jobScheduleTitle(job), clean(job.system_type)].filter(Boolean).join(" - ") || "SEFS Job";
}

function floorScopesText(job: AnyRecord) {
  const scopes = Array.isArray(job.floor_scopes) ? job.floor_scopes : [];
  if (!scopes.length) return `${clean(job.system_type) || "System"} - ${Number(job.square_feet) || 0} sq ft`;
  return scopes.map((floor: AnyRecord) => {
    const label = floor.floor ? `Floor ${floor.floor}${floor.area_name ? ` - ${floor.area_name}` : ""}: ` : "";
    const options = Array.isArray(floor.option_details) && floor.option_details.length ? `\n  ${floor.option_details.join("; ")}` : "";
    return `${label}${clean(floor.system) || "System"} - ${Number(floor.sqft) || 0} sq ft${options}`;
  }).join("\n");
}

function materialListText(job: AnyRecord) {
  const list = Array.isArray(job.material_list) ? job.material_list : [];
  return list.length
    ? list.map((material: AnyRecord) => `${material.floor ? `Floor ${material.floor}: ` : ""}${clean(material.name) || "Material"}${material.qty ? ` - Qty ${Math.ceil(Number(material.qty) || 0)}` : ""}`).join("\n")
    : "No material list saved.";
}

function mobileJobUrl(jobId: string) {
  const base = clean(Deno.env.get("SEFS_PUBLIC_BASE_URL")) || "https://sefs-ops-dashboard.pages.dev";
  return `${base.replace(/\/+$/, "")}/mobile-job.html?job=${encodeURIComponent(jobId)}`;
}

function calendarDescription(job: AnyRecord) {
  return [
    `Customer phone: ${clean(job.phone)}`,
    `Job address: ${clean(job.address)}`,
    `Systems / areas:\n${floorScopesText(job)}`,
    `Total square footage: ${Number(job.square_feet) || ""}`,
    `Crew/job notes: ${clean(job.notes)}`,
    `Pull sheet/material notes: ${clean(job.material_notes)}`,
    `Materials list:\n${materialListText(job)}`,
    `Open mobile job view: ${mobileJobUrl(job.id)}`,
  ].join("\n");
}

function eventBody(job: AnyRecord) {
  const timeZone = clean(Deno.env.get("SEFS_TIME_ZONE")) || "America/Chicago";
  const timed = !!cleanTime(job.start_time);
  const body: AnyRecord = {
    summary: googleCalendarTitle(job),
    location: clean(job.address),
    description: calendarDescription(job),
    extendedProperties: { private: { sefsJobId: job.id, sefsSource: "dashboard" } },
  };
  if (timed) {
    const startTime = cleanTime(job.start_time);
    const endTime = cleanTime(job.end_time) || timePlus(startTime);
    const endDate = clean(job.end_date) || clean(job.start_date);
    body.start = { dateTime: `${job.start_date}T${startTime}:00`, timeZone };
    body.end = { dateTime: `${endDate}T${endTime}:00`, timeZone };
  } else {
    body.start = { date: clean(job.start_date) };
    body.end = { date: addDays(clean(job.end_date) || clean(job.start_date), 1) };
  }
  return body;
}

function shouldSyncJob(job: AnyRecord) {
  const status = clean(job.status);
  return !!job.id && !!job.start_date && !["Complete", "Lost", "Canceled", "Needs Review", "Sync Conflict"].includes(status);
}

function safeDashboardFields(job: AnyRecord) {
  return {
    job_name: googleCalendarTitle(job),
    address: clean(job.address),
    notes: clean(job.notes),
    start_date: clean(job.start_date),
    start_time: cleanTime(job.start_time),
    end_date: clean(job.end_date),
    end_time: cleanTime(job.end_time),
  };
}

function sameFields(a: AnyRecord, b: AnyRecord) {
  return JSON.stringify(a || {}) === JSON.stringify(b || {});
}

async function googleAccessToken() {
  const clientId = Deno.env.get("GOOGLE_CLIENT_ID");
  const clientSecret = Deno.env.get("GOOGLE_CLIENT_SECRET");
  const refreshToken = Deno.env.get("GOOGLE_REFRESH_TOKEN");
  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error("Google Calendar secrets are not configured. Set GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REFRESH_TOKEN, and GOOGLE_CALENDAR_ID.");
  }
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data?.error_description || data?.error || `Google token refresh failed (${response.status})`);
  return String(data.access_token || "");
}

async function googleFetch(token: string, path: string, init: RequestInit = {}) {
  const calendarId = clean(Deno.env.get("GOOGLE_CALENDAR_ID")) || "primary";
  const response = await fetch(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
  });
  return response;
}

async function readSyncState(supa: ReturnType<typeof createClient>) {
  const calendarId = clean(Deno.env.get("GOOGLE_CALENDAR_ID")) || "primary";
  const key = `google:${calendarId}`;
  const result = await supa.from("calendar_sync_state").select("*").eq("key", key).maybeSingle();
  if (result.error) throw new Error(result.error.message);
  if (result.data) return result.data;
  const inserted = await supa.from("calendar_sync_state").insert({ key, calendar_id: calendarId }).select().single();
  if (inserted.error) throw new Error(inserted.error.message);
  return inserted.data;
}

async function writeSyncState(supa: ReturnType<typeof createClient>, state: AnyRecord, payload: AnyRecord) {
  const result = await supa
    .from("calendar_sync_state")
    .upsert({ key: state.key, calendar_id: state.calendar_id, updated_at: todayIso(), ...payload }, { onConflict: "key" });
  if (result.error) throw new Error(result.error.message);
}

async function listGoogleChanges(token: string, syncToken: string | null) {
  const events: AnyRecord[] = [];
  let pageToken = "";
  let nextSyncToken = "";
  let fullSync = !syncToken;
  const now = new Date();
  const min = new Date(now);
  min.setFullYear(min.getFullYear() - 1);
  const max = new Date(now);
  max.setFullYear(max.getFullYear() + 2);

  do {
    const params = new URLSearchParams({ maxResults: "2500", showDeleted: "true", singleEvents: "true" });
    if (pageToken) params.set("pageToken", pageToken);
    if (syncToken && !fullSync) params.set("syncToken", syncToken);
    else {
      params.set("timeMin", min.toISOString());
      params.set("timeMax", max.toISOString());
    }
    const response = await googleFetch(token, `?${params.toString()}`);
    if (response.status === 410 && syncToken) return listGoogleChanges(token, null);
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data?.error?.message || `Google event list failed (${response.status})`);
    events.push(...(Array.isArray(data.items) ? data.items : []));
    pageToken = clean(data.nextPageToken);
    nextSyncToken = clean(data.nextSyncToken) || nextSyncToken;
  } while (pageToken);

  return { events, nextSyncToken, fullSync };
}

async function updateJobSyncMeta(supa: ReturnType<typeof createClient>, job: AnyRecord, event: AnyRecord, status = "Synced", error = "") {
  const googleFields = googleEventToJobFields(event, job);
  const payload = {
    google_calendar_event_id: event.id || job.google_calendar_event_id || null,
    google_calendar_updated_at: event.updated || job.google_calendar_updated_at || null,
    google_calendar_synced_at: todayIso(),
    supabase_synced_at: todayIso(),
    google_calendar_sync_status: status,
    google_calendar_sync_error: error || null,
    google_calendar_last_snapshot: {
      dashboard: safeDashboardFields(job),
      google: googleFields,
      google_event_id: event.id || "",
      google_updated_at: event.updated || "",
      synced_at: todayIso(),
    },
  };
  const result = await supa.from("jobs").update(payload).eq("id", job.id);
  if (result.error) throw new Error(result.error.message);
  Object.assign(job, payload);
}

async function markConflict(supa: ReturnType<typeof createClient>, job: AnyRecord, event: AnyRecord) {
  const payload = {
    status: "Sync Conflict",
    google_calendar_event_id: event.id || job.google_calendar_event_id || null,
    google_calendar_updated_at: event.updated || job.google_calendar_updated_at || null,
    google_calendar_synced_at: todayIso(),
    google_calendar_sync_status: "Sync Conflict",
    google_calendar_sync_error: "Dashboard and Google Calendar both changed schedule fields. Choose which version to keep.",
    google_calendar_last_snapshot: {
      dashboard: safeDashboardFields(job),
      google: googleEventToJobFields(event, job),
      google_event_id: event.id || "",
      google_updated_at: event.updated || "",
      conflict_at: todayIso(),
    },
  };
  const result = await supa.from("jobs").update(payload).eq("id", job.id);
  if (result.error) throw new Error(result.error.message);
  Object.assign(job, payload);
}

async function findCustomer(supa: ReturnType<typeof createClient>, payload: AnyRecord) {
  const phone = clean(payload.phone).replace(/\D/g, "");
  const name = clean(payload.customer);
  if (phone) {
    const result = await supa.from("customers").select("*").limit(50);
    if (!result.error) {
      const match = (result.data || []).find((customer: AnyRecord) => clean(customer.phone).replace(/\D/g, "").endsWith(phone.slice(-7)));
      if (match) return match;
    }
  }
  if (name) {
    const result = await supa.from("customers").select("*").ilike("name", name).maybeSingle();
    if (!result.error && result.data) return result.data;
  }
  return null;
}

async function ensureCustomer(supa: ReturnType<typeof createClient>, payload: AnyRecord) {
  const customer = clean(payload.customer);
  if (!customer || customer === "Google Calendar Import") return null;
  const existing = await findCustomer(supa, payload);
  if (existing) return existing;
  const inserted = await supa.from("customers").insert({
    name: customer,
    phone: clean(payload.phone),
    address: clean(payload.address),
    notes: "Created automatically from Google Calendar import.",
  }).select().single();
  if (inserted.error) return null;
  return inserted.data;
}

async function importGoogleEvent(supa: ReturnType<typeof createClient>, event: AnyRecord, stats: AnyRecord) {
  const fields = googleEventToJobFields(event);
  const customerName = importCustomerName(fields);
  const customerPayload = {
    customer: customerName,
    phone: fields.phone,
    address: fields.address,
  };
  const customer = await ensureCustomer(supa, customerPayload);
  const payload = {
    customer_id: customer?.id || null,
    customer: customer?.name || customerName,
    phone: fields.phone || customer?.phone || "",
    job_name: fields.job_name || fields.customer || clean(event.summary) || "Imported Google Calendar Event",
    address: fields.address || customer?.address || "",
    system_type: fields.system_type || "",
    square_feet: fields.square_feet || 0,
    status: "Needs Review",
    start_date: fields.start_date,
    start_time: fields.start_time,
    end_date: fields.end_date,
    end_time: fields.end_time,
    notes: fields.notes || "Imported from Google Calendar. Review before production.",
    google_calendar_event_id: event.id,
    google_calendar_updated_at: event.updated || null,
    google_calendar_synced_at: todayIso(),
    supabase_synced_at: todayIso(),
    google_calendar_sync_status: "Imported",
    google_calendar_sync_error: "Imported from Google Calendar. Review and complete missing job details.",
    google_calendar_last_snapshot: {
      dashboard: fields,
      google: fields,
      google_event_id: event.id,
      google_updated_at: event.updated || "",
      synced_at: todayIso(),
    },
  };
  const result = await supa.from("jobs").insert(payload).select().single();
  if (result.error) {
    if (String(result.error.message || "").includes("duplicate")) return;
    throw new Error(result.error.message);
  }
  stats.imported++;
}

async function applyGoogleChange(supa: ReturnType<typeof createClient>, job: AnyRecord, event: AnyRecord, stats: AnyRecord) {
  if (event.status === "cancelled") {
    const result = await supa.from("jobs").update({
      status: "Needs Review",
      google_calendar_sync_status: "Needs Review",
      google_calendar_sync_error: "Google Calendar event was deleted or canceled. Job kept for review.",
      google_calendar_updated_at: event.updated || job.google_calendar_updated_at || null,
      google_calendar_synced_at: todayIso(),
    }).eq("id", job.id);
    if (result.error) throw new Error(result.error.message);
    stats.deleted++;
    return;
  }

  const googleFields = googleEventToJobFields(event, job);
  const dashboardFields = safeDashboardFields(job);
  const googleChanged = Date.parse(event.updated || "0") > Date.parse(job.google_calendar_updated_at || "0") + 1000;
  const dashboardPending = clean(job.google_calendar_sync_status) === "Not Synced";
  if (clean(job.status) === "Sync Conflict" || clean(job.google_calendar_sync_status) === "Sync Conflict") {
    stats.conflicts++;
    return;
  }
  if (googleChanged && dashboardPending && !sameFields(googleFields, dashboardFields)) {
    await markConflict(supa, job, event);
    stats.conflicts++;
    return;
  }
  if (googleChanged && !sameFields(googleFields, dashboardFields)) {
    const status = job.status === "Awaiting Schedule" && googleFields.start_date ? "Scheduled" : job.status;
    const payload = {
      job_name: googleFields.job_name || job.job_name,
      address: googleFields.address || job.address,
      notes: googleFields.notes || job.notes,
      start_date: googleFields.start_date,
      start_time: googleFields.start_time,
      end_date: googleFields.end_date || googleFields.start_date,
      end_time: googleFields.end_time,
      status,
      google_calendar_event_id: event.id,
      google_calendar_updated_at: event.updated || null,
      google_calendar_synced_at: todayIso(),
      supabase_synced_at: todayIso(),
      google_calendar_sync_status: "Synced",
      google_calendar_sync_error: null,
      google_calendar_last_snapshot: {
        dashboard: { ...dashboardFields, ...googleFields },
        google: googleFields,
        google_event_id: event.id,
        google_updated_at: event.updated || "",
        synced_at: todayIso(),
      },
    };
    const result = await supa.from("jobs").update(payload).eq("id", job.id);
    if (result.error) throw new Error(result.error.message);
    Object.assign(job, payload);
    stats.pulled++;
    return;
  }
  await updateJobSyncMeta(supa, job, event);
}

async function pushJob(supa: ReturnType<typeof createClient>, token: string, job: AnyRecord, stats: AnyRecord) {
  if (!shouldSyncJob(job)) {
    if (job.google_calendar_event_id && ["Complete", "Lost", "Canceled"].includes(clean(job.status))) {
      const response = await googleFetch(token, `/${encodeURIComponent(job.google_calendar_event_id)}`, { method: "DELETE" });
      if (!response.ok && response.status !== 404) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data?.error?.message || `Google delete failed (${response.status})`);
      }
      await supa.from("jobs").update({
        google_calendar_event_id: null,
        google_calendar_synced_at: todayIso(),
        google_calendar_sync_status: "Not Synced",
      }).eq("id", job.id);
    }
    return;
  }

  const body = eventBody(job);
  let response: Response | null = null;
  if (job.google_calendar_event_id) {
    response = await googleFetch(token, `/${encodeURIComponent(job.google_calendar_event_id)}`, {
      method: "PUT",
      body: JSON.stringify(body),
    });
  }
  if (!job.google_calendar_event_id || response?.status === 404) {
    response = await googleFetch(token, "", {
      method: "POST",
      body: JSON.stringify(body),
    });
  }
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data?.error?.message || `Google event write failed (${response.status})`);
  await updateJobSyncMeta(supa, job, data);
  stats.pushed++;
}

async function syncCalendar() {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) throw new Error("Supabase service secrets are not configured.");
  const supa = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const token = await googleAccessToken();
  const syncState = await readSyncState(supa);
  const stats: AnyRecord = { pulled: 0, imported: 0, pushed: 0, deleted: 0, conflicts: 0, errors: 0 };

  await writeSyncState(supa, syncState, { last_run_at: todayIso(), last_error: null });

  const jobResult = await supa.from("jobs").select("*");
  if (jobResult.error) throw new Error(jobResult.error.message);
  const jobs = jobResult.data || [];
  const jobsById = new Map(jobs.map((job: AnyRecord) => [job.id, job]));
  const jobsByEvent = new Map(jobs.filter((job: AnyRecord) => job.google_calendar_event_id).map((job: AnyRecord) => [job.google_calendar_event_id, job]));

  const changes = await listGoogleChanges(token, clean(syncState.sync_token) || null);
  for (const event of changes.events) {
    const sefsJobId = clean(event.extendedProperties?.private?.sefsJobId);
    const linkedJob = (sefsJobId && jobsById.get(sefsJobId)) || jobsByEvent.get(event.id);
    if (linkedJob) await applyGoogleChange(supa, linkedJob, event, stats);
    else if (event.status !== "cancelled") await importGoogleEvent(supa, event, stats);
  }

  for (const job of jobs) {
    if (clean(job.status) === "Sync Conflict" || clean(job.google_calendar_sync_status) === "Sync Conflict") continue;
    if (clean(job.google_calendar_sync_status) === "Needs Review" || clean(job.google_calendar_sync_status) === "Imported") continue;
    if (clean(job.google_calendar_sync_status) === "Synced" && job.google_calendar_event_id) continue;
    await pushJob(supa, token, job, stats);
  }

  await writeSyncState(supa, syncState, {
    sync_token: changes.nextSyncToken || syncState.sync_token || null,
    last_full_sync_at: changes.fullSync ? todayIso() : syncState.last_full_sync_at,
    last_incremental_sync_at: changes.fullSync ? syncState.last_incremental_sync_at : todayIso(),
    last_success_at: todayIso(),
    last_error: null,
    stats,
  });
  return stats;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "POST required" }, 405);

  try {
    const stats = await syncCalendar();
    return json({ ok: true, stats });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    try {
      const supabaseUrl = Deno.env.get("SUPABASE_URL");
      const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
      if (supabaseUrl && serviceRoleKey) {
        const supa = createClient(supabaseUrl, serviceRoleKey, {
          auth: { autoRefreshToken: false, persistSession: false },
        });
        const calendarId = clean(Deno.env.get("GOOGLE_CALENDAR_ID")) || "primary";
        await supa.from("calendar_sync_state").upsert({
          key: `google:${calendarId}`,
          calendar_id: calendarId,
          last_run_at: todayIso(),
          last_error: message,
          updated_at: todayIso(),
        }, { onConflict: "key" });
      }
    } catch {
      // Ignore secondary state-write failures; return the original error.
    }
    return json({ ok: false, error: message }, 500);
  }
});
