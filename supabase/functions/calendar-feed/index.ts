import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

type AnyRecord = Record<string, any>;

function text(body: string, status = 200, contentType = "text/plain; charset=utf-8") {
  return new Response(body, {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": contentType,
      "Cache-Control": "no-store, max-age=0",
    },
  });
}

function supabaseAdmin() {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) throw new Error("Supabase service secrets are not configured.");
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

function clean(value: unknown) {
  return String(value ?? "").trim();
}

function addDays(dateText: string, days: number) {
  const date = new Date(`${dateText}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function compactDate(dateText: string) {
  return clean(dateText).replaceAll("-", "");
}

function cleanTime(value: unknown) {
  const textValue = clean(value);
  if (!textValue) return "";
  const match = textValue.match(/^(\d{1,2}):(\d{2})/);
  return match ? `${match[1].padStart(2, "0")}${match[2]}00` : "";
}

function timePlus(value: unknown, minutes = 60) {
  const textValue = clean(value);
  const match = textValue.match(/^(\d{1,2}):(\d{2})/) || textValue.match(/^(\d{2})(\d{2})\d{2}$/);
  const h = match ? Number(match[1]) : 8;
  const m = match ? Number(match[2]) : 0;
  const date = new Date(Date.UTC(2000, 0, 1, h || 0, m || 0));
  date.setUTCMinutes(date.getUTCMinutes() + minutes);
  return `${String(date.getUTCHours()).padStart(2, "0")}${String(date.getUTCMinutes()).padStart(2, "0")}00`;
}

function icsEscape(value: unknown) {
  return clean(value)
    .replace(/\\/g, "\\\\")
    .replace(/\r\n|\r|\n/g, "\\n")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,");
}

function foldLine(line: string) {
  const chunks: string[] = [];
  let rest = line;
  while (rest.length > 73) {
    chunks.push(rest.slice(0, 73));
    rest = ` ${rest.slice(73)}`;
  }
  chunks.push(rest);
  return chunks.join("\r\n");
}

function prop(name: string, value: unknown) {
  return foldLine(`${name}:${icsEscape(value)}`);
}

function nowStamp() {
  return new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

function toStamp(value: unknown) {
  const parsed = Date.parse(clean(value));
  return Number.isFinite(parsed) ? new Date(parsed).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z") : nowStamp();
}

function baseUrl() {
  return (clean(Deno.env.get("SEFS_PUBLIC_BASE_URL")) || "https://sefs-ops-dashboard.pages.dev").replace(/\/+$/, "");
}

function mobileJobUrl(jobId: string) {
  return `${baseUrl()}/mobile-job.html?job=${encodeURIComponent(jobId)}&crew=1`;
}

function dashboardUrl(path = "index.html") {
  return `${baseUrl()}/${path.replace(/^\/+/, "")}`;
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
  if (!list.length) return "No material list saved.";
  return list.map((material: AnyRecord) => {
    const qty = material.qty ? ` - Qty ${Math.ceil(Number(material.qty) || 0)}` : "";
    const unit = clean(material.unit) ? ` ${clean(material.unit)}` : "";
    return `${material.floor ? `Floor ${material.floor}: ` : ""}${clean(material.name) || "Material"}${qty}${unit}`;
  }).join("\n");
}

function jobScheduleTitle(job: AnyRecord) {
  const customer = clean(job.customer);
  const jobName = clean(job.job_name);
  const system = clean(job.system_type);
  return [customer || jobName || "SEFS Job", system].filter(Boolean).join(" - ");
}

function taskScheduleTitle(task: AnyRecord) {
  return clean(task.title) || "SEFS Task";
}

function jobDescription(job: AnyRecord) {
  return [
    "Type: Job",
    `Status: ${clean(job.status)}`,
    `Customer: ${clean(job.customer)}`,
    `Phone: ${clean(job.phone)}`,
    `Address: ${clean(job.address)}`,
    `Crew lead: ${clean(job.crew) || clean(job.crew_lead) || "Unassigned"}`,
    `Systems / areas:\n${floorScopesText(job)}`,
    `Total square footage: ${Number(job.square_feet) || ""}`,
    `Crew/job notes: ${clean(job.notes)}`,
    `Pull sheet/material notes: ${clean(job.material_notes)}`,
    `Materials list:\n${materialListText(job)}`,
    `Open mobile job view: ${mobileJobUrl(job.id)}`,
    `Open SEFS dashboard: ${dashboardUrl("index.html?app=dashboard")}`,
  ].join("\n");
}

function leadDescription(lead: AnyRecord) {
  return [
    "Type: Lead Follow Up",
    `Status: ${clean(lead.stage) || "New Lead"}`,
    `Customer: ${clean(lead.customer)}`,
    `Phone: ${clean(lead.phone)}`,
    `Email: ${clean(lead.email)}`,
    `Address: ${clean(lead.address)}`,
    `Notes: ${clean(lead.notes)}`,
    `Open SEFS dashboard: ${dashboardUrl("index.html?app=dashboard")}`,
  ].join("\n");
}

function taskDescription(task: AnyRecord) {
  return [
    "Type: Task",
    `Status: ${clean(task.status) || "Open"}`,
    `Priority: ${clean(task.priority) || "Normal"}`,
    `Assigned to: ${clean(task.assigned_to) || "Unassigned"}`,
    `Details: ${clean(task.details)}`,
    `Open SEFS dashboard: ${dashboardUrl("index.html?app=dashboard")}`,
  ].join("\n");
}

function eventDates(record: AnyRecord) {
  const startDate = clean(record.start_date || record.due_date);
  const endDate = clean(record.end_date || record.start_date || record.due_date);
  const startTime = cleanTime(record.start_time || record.due_time);
  const endTime = cleanTime(record.end_time);
  if (!startDate) return [];
  if (startTime) {
    const finalEndDate = endDate || startDate;
    const finalEndTime = endTime || (finalEndDate !== startDate ? "170000" : timePlus(startTime));
    return [
      `DTSTART;TZID=${icsEscape(clean(Deno.env.get("SEFS_TIME_ZONE")) || "America/Chicago")}:${compactDate(startDate)}T${startTime}`,
      `DTEND;TZID=${icsEscape(clean(Deno.env.get("SEFS_TIME_ZONE")) || "America/Chicago")}:${compactDate(finalEndDate)}T${finalEndTime}`,
    ];
  }
  return [
    `DTSTART;VALUE=DATE:${compactDate(startDate)}`,
    `DTEND;VALUE=DATE:${compactDate(addDays(endDate || startDate, 1))}`,
  ];
}

function eventBlock(record: AnyRecord, type: "job" | "lead" | "task") {
  const dates = eventDates(record);
  if (!dates.length) return "";
  const idPrefix = type === "job" ? "job" : type === "lead" ? "lead" : "task";
  const summary = type === "job" ? jobScheduleTitle(record) : type === "lead" ? `Lead follow up - ${clean(record.customer) || "Lead"}` : taskScheduleTitle(record);
  const description = type === "job" ? jobDescription(record) : type === "lead" ? leadDescription(record) : taskDescription(record);
  const location = type === "job" || type === "lead" ? clean(record.address) : "";
  const url = type === "job" ? mobileJobUrl(record.id) : dashboardUrl("index.html?app=dashboard");
  return [
    "BEGIN:VEVENT",
    prop("UID", `${idPrefix}-${record.id}@sefs-ops-dashboard`),
    prop("SUMMARY", summary),
    ...dates,
    prop("DTSTAMP", nowStamp()),
    prop("CREATED", record.created_at ? toStamp(record.created_at) : nowStamp()),
    prop("LAST-MODIFIED", record.updated_at ? toStamp(record.updated_at) : nowStamp()),
    location ? prop("LOCATION", location) : "",
    prop("DESCRIPTION", description),
    prop("URL", url),
    "END:VEVENT",
  ].filter(Boolean).join("\r\n");
}

function withinWindow(dateText: unknown, pastDays: number, futureDays: number) {
  const date = clean(dateText);
  if (!date) return false;
  const now = new Date();
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const low = new Date(start);
  low.setUTCDate(low.getUTCDate() - pastDays);
  const high = new Date(start);
  high.setUTCDate(high.getUTCDate() + futureDays);
  const value = new Date(`${date}T00:00:00Z`);
  return value >= low && value <= high;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return text("", 204);
  if (req.method !== "GET") return text("Method not allowed", 405);

  try {
    const url = new URL(req.url);
    const configuredToken = clean(Deno.env.get("SEFS_CALENDAR_FEED_TOKEN"));
    const allowPublic = clean(Deno.env.get("SEFS_ALLOW_PUBLIC_CALENDAR_FEED")) === "1";
    if (!allowPublic) {
      if (!configuredToken) return text("Calendar feed token is not configured.", 503);
      if (url.searchParams.get("token") !== configuredToken) return text("Unauthorized calendar feed.", 401);
    }

    const pastDays = Math.max(0, Math.min(1095, Number(url.searchParams.get("pastDays")) || 365));
    const futureDays = Math.max(1, Math.min(1095, Number(url.searchParams.get("futureDays")) || 730));
    const supa = supabaseAdmin();

    const [jobsResult, leadsResult, tasksResult] = await Promise.all([
      supa.from("jobs").select("*").not("start_date", "is", null).order("start_date", { ascending: true }),
      supa.from("leads").select("*").not("next_followup", "is", null).order("next_followup", { ascending: true }),
      supa.from("tasks").select("*").not("due_date", "is", null).order("due_date", { ascending: true }),
    ]);

    if (jobsResult.error) throw jobsResult.error;
    if (leadsResult.error) throw leadsResult.error;
    if (tasksResult.error) throw tasksResult.error;

    const jobs = (jobsResult.data || [])
      .filter((job: AnyRecord) => !["Lost", "Canceled"].includes(clean(job.status)))
      .filter((job: AnyRecord) => withinWindow(job.start_date, pastDays, futureDays));

    const leads = (leadsResult.data || [])
      .filter((lead: AnyRecord) => !["Won", "Lost"].includes(clean(lead.stage)))
      .filter((lead: AnyRecord) => withinWindow(lead.next_followup, pastDays, futureDays))
      .map((lead: AnyRecord) => ({ ...lead, start_date: lead.next_followup, end_date: lead.next_followup }));

    const tasks = (tasksResult.data || [])
      .filter((task: AnyRecord) => clean(task.show_on_schedule) !== "false" && clean(task.status) !== "Done")
      .filter((task: AnyRecord) => withinWindow(task.due_date, pastDays, futureDays));

    const body = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//SEFS//Operations Schedule//EN",
      "CALSCALE:GREGORIAN",
      "METHOD:PUBLISH",
      "X-WR-CALNAME:SEFS Schedule",
      "X-WR-TIMEZONE:America/Chicago",
      "REFRESH-INTERVAL;VALUE=DURATION:PT15M",
      "X-PUBLISHED-TTL:PT15M",
      ...jobs.map((job: AnyRecord) => eventBlock(job, "job")),
      ...leads.map((lead: AnyRecord) => eventBlock(lead, "lead")),
      ...tasks.map((task: AnyRecord) => eventBlock(task, "task")),
      "END:VCALENDAR",
      "",
    ].filter(Boolean).join("\r\n");

    return new Response(body, {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": "text/calendar; charset=utf-8",
        "Content-Disposition": "inline; filename=\"sefs-schedule.ics\"",
        "Cache-Control": "no-store, max-age=0",
      },
    });
  } catch (error) {
    console.error(error);
    return text(error?.message || String(error), 500);
  }
});
