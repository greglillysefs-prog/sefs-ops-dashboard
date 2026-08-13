import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const RESPONSE_HEADERS = {
  "Content-Type": "application/xml; charset=utf-8",
};

const BRAND = "Southeast Flooring Solutions";
const COMPLIANCE_URL = "https://sefs-sms-compliance.pages.dev";
const OPT_IN_MESSAGE =
  `${BRAND}: You are opted in for job intake, scheduling, follow-up, and operations SMS. Msg freq varies. Msg&data rates may apply. Privacy/Terms: ${COMPLIANCE_URL} Reply HELP for help. Reply STOP to opt out.`;
const HELP_MESSAGE =
  `${BRAND}: Text customer/job details and I will create an intake lead or ask one follow-up question. Privacy/Terms: ${COMPLIANCE_URL} Reply STOP to opt out.`;
const OPT_OUT_MESSAGE =
  `${BRAND}: You have successfully opted out. You will not receive any more messages from this number. Reply START to opt back in.`;

type AnyRecord = Record<string, unknown>;

function clean(value: unknown) {
  return String(value ?? "").trim();
}

function digits(value: unknown) {
  return clean(value).replace(/\D/g, "");
}

function normalizePhone(value: unknown) {
  const raw = clean(value);
  const onlyDigits = digits(raw);
  if (!onlyDigits) return "";
  if (onlyDigits.length === 10) return `+1${onlyDigits}`;
  if (onlyDigits.length === 11 && onlyDigits.startsWith("1")) return `+${onlyDigits}`;
  return raw;
}

function xmlEscape(value: unknown) {
  return clean(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function twiml(message: string) {
  return new Response(`<?xml version="1.0" encoding="UTF-8"?><Response><Message>${xmlEscape(message)}</Message></Response>`, {
    headers: RESPONSE_HEADERS,
  });
}

function twimlStatus(message: string, status = 200) {
  return new Response(`<?xml version="1.0" encoding="UTF-8"?><Response><Message>${xmlEscape(message)}</Message></Response>`, {
    headers: RESPONSE_HEADERS,
    status,
  });
}

async function hmacSha1Base64(key: string, text: string) {
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(key),
    { name: "HMAC", hash: "SHA-1" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", cryptoKey, new TextEncoder().encode(text));
  let binary = "";
  for (const byte of new Uint8Array(signature)) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function safeEqual(a: string, b: string) {
  if (!a || !b || a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i += 1) result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return result === 0;
}

async function verifyTwilioSignature(req: Request, params: URLSearchParams) {
  const token = Deno.env.get("TWILIO_AUTH_TOKEN");
  if (!token) return true;
  const signature = req.headers.get("x-twilio-signature") || "";
  if (!signature) return false;
  const configuredUrl = clean(Deno.env.get("TWILIO_WEBHOOK_URL")) || req.url.split("?")[0];
  const sorted = [...params.entries()].sort(([a], [b]) => a.localeCompare(b));
  const signed = configuredUrl + sorted.map(([key, value]) => `${key}${value}`).join("");
  const expected = await hmacSha1Base64(token, signed);
  return safeEqual(signature, expected);
}

function allowedSender(fromPhone: string) {
  const allowed = clean(Deno.env.get("SEFS_SMS_ALLOWED_FROM"));
  if (!allowed) return true;
  const set = new Set(allowed.split(",").map((phone) => normalizePhone(phone)).filter(Boolean));
  return set.has(normalizePhone(fromPhone));
}

function isoToday() {
  return new Date().toISOString().slice(0, 10);
}

function formatDate(date: unknown) {
  const value = clean(date);
  if (!value) return "today";
  const parsed = new Date(`${value}T12:00:00`);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function customerSearchText(customer: AnyRecord) {
  return [customer.name, customer.phone, customer.email, customer.address, customer.notes]
    .map(clean)
    .join(" ")
    .toLowerCase();
}

function scoreCustomer(customer: AnyRecord, message: string) {
  const lower = message.toLowerCase();
  const messageDigits = digits(message);
  const name = clean(customer.name).toLowerCase();
  const phone = digits(customer.phone);
  const email = clean(customer.email).toLowerCase();
  const address = clean(customer.address).toLowerCase();
  let score = 0;
  if (name && lower.includes(name)) score += 90;
  if (name) {
    const parts = name.split(/\s+/).filter((part) => part.length > 2);
    score += parts.filter((part) => lower.includes(part)).length * 20;
  }
  if (phone && messageDigits.includes(phone.slice(-7))) score += 90;
  if (email && lower.includes(email)) score += 85;
  if (address && lower.includes(address)) score += 45;
  if (customerSearchText(customer).split(/\s+/).some((part) => part.length > 4 && lower.includes(part))) score += 8;
  return score;
}

async function loadCustomerMatches(supa: ReturnType<typeof createClient>, message: string) {
  const result = await supa
    .from("customers")
    .select("id,name,phone,email,address,status,notes,updated_at")
    .order("updated_at", { ascending: false })
    .limit(250);

  if (result.error) return [];
  return (result.data || [])
    .map((customer: AnyRecord) => ({ ...customer, match_score: scoreCustomer(customer, message) }))
    .filter((customer: AnyRecord) => Number(customer.match_score || 0) >= 18)
    .sort((a: AnyRecord, b: AnyRecord) => Number(b.match_score || 0) - Number(a.match_score || 0))
    .slice(0, 8);
}

function parseJsonText(data: AnyRecord) {
  const direct = clean(data.output_text);
  if (direct) return JSON.parse(direct);
  const output = Array.isArray(data.output) ? data.output : [];
  for (const item of output) {
    const content = Array.isArray(item?.content) ? item.content : [];
    for (const part of content) {
      if (part?.type === "output_text" && clean(part.text)) return JSON.parse(clean(part.text));
    }
  }
  throw new Error("AI returned no structured intake.");
}

async function organizeIntake(message: string, customerMatches: AnyRecord[]) {
  const apiKey = Deno.env.get("OPENAI_API_KEY");
  const model = Deno.env.get("OPENAI_MODEL") || "gpt-4.1-mini";
  if (!apiKey) throw new Error("OPENAI_API_KEY is not configured.");

  const schema = {
    type: "object",
    additionalProperties: false,
    properties: {
      customer_name: { type: ["string", "null"] },
      phone: { type: ["string", "null"] },
      email: { type: ["string", "null"] },
      address: { type: ["string", "null"] },
      job_name: { type: ["string", "null"] },
      system_type: { type: ["string", "null"] },
      square_feet: { type: ["number", "null"] },
      desired_date: { type: ["string", "null"] },
      follow_up_date: { type: ["string", "null"] },
      description: { type: ["string", "null"] },
      notes: { type: ["string", "null"] },
      missing_fields: { type: "array", items: { type: "string" } },
      missing_questions: { type: "array", items: { type: "string" } },
      matched_customer_id: { type: ["string", "null"] },
      matched_customer_name: { type: ["string", "null"] },
      match_reason: { type: ["string", "null"] },
    },
    required: [
      "customer_name",
      "phone",
      "email",
      "address",
      "job_name",
      "system_type",
      "square_feet",
      "desired_date",
      "follow_up_date",
      "description",
      "notes",
      "missing_fields",
      "missing_questions",
      "matched_customer_id",
      "matched_customer_name",
      "match_reason",
    ],
  };

  const today = isoToday();
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      input: [
        {
          role: "system",
          content: [
            {
              type: "input_text",
              text: [
                `You are the SMS intake secretary for ${BRAND}.`,
                "Organize messy job intake texts into a dashboard lead.",
                "Use customer_matches to recognize existing customers. If the text clearly names a listed customer, copy that customer's known phone, email, and address instead of asking for it.",
                "Do not invent unknown facts. Do not create pricing, quotes, or scheduled jobs.",
                "Normalize system_type to one of: Flake, Metallic, Quartz, Mortar, Wood/Stone Overlay, Broom Overlay, Grind/Stain/Seal, Polish, Prep Only, or null.",
                `Dates must be ISO yyyy-mm-dd. Today is ${today}.`,
                "missing_questions must contain at most one short question, asking only for the most important missing detail.",
              ].join(" "),
            },
          ],
        },
        {
          role: "user",
          content: [{
            type: "input_text",
            text: JSON.stringify({ message, customer_matches: customerMatches }),
          }],
        },
      ],
      text: {
        format: {
          type: "json_schema",
          name: "sefs_sms_intake",
          strict: true,
          schema,
        },
      },
    }),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(clean((data as AnyRecord).error?.message) || `OpenAI request failed with ${response.status}.`);
  return parseJsonText(data as AnyRecord);
}

async function ensureCustomer(supa: ReturnType<typeof createClient>, intake: AnyRecord) {
  const matchedId = clean(intake.matched_customer_id);
  if (matchedId) return matchedId;
  const name = clean(intake.customer_name);
  const phone = clean(intake.phone);
  if (!name) return null;

  const filters = [`name.ilike.%${name.replace(/[%_,]/g, "")}%`];
  const phoneTail = digits(phone).slice(-7);
  if (phoneTail) filters.push(`phone.ilike.%${phoneTail}%`);

  const existing = await supa
    .from("customers")
    .select("id,name,phone,email,address")
    .or(filters.join(","))
    .limit(1)
    .maybeSingle();

  if (existing.data?.id) return existing.data.id;

  const created = await supa
    .from("customers")
    .insert({
      name,
      phone: phone || null,
      email: clean(intake.email) || null,
      address: clean(intake.address) || null,
      status: "Active",
      notes: "Created from SMS AI intake.",
    })
    .select("id")
    .single();

  if (created.error) throw new Error(created.error.message);
  return created.data.id;
}

async function createLead(supa: ReturnType<typeof createClient>, intake: AnyRecord, message: string, from: string) {
  const customerId = await ensureCustomer(supa, intake);
  const customer = clean(intake.customer_name) || clean(intake.matched_customer_name);
  if (!customer) return null;

  const notes = [
    "Created from SMS AI intake.",
    `Sender: ${from || "unknown"}`,
    `Raw message: ${message}`,
    clean(intake.description) ? `Description: ${clean(intake.description)}` : "",
    clean(intake.notes) ? `Notes: ${clean(intake.notes)}` : "",
    clean(intake.match_reason) ? `Customer match: ${clean(intake.match_reason)}` : "",
  ].filter(Boolean).join("\n");

  const lead = await supa
    .from("leads")
    .insert({
      customer_id: customerId,
      customer,
      phone: clean(intake.phone) || null,
      email: clean(intake.email) || null,
      address: clean(intake.address) || null,
      stage: "New Lead",
      next_followup: clean(intake.follow_up_date) || isoToday(),
      estimated_value: 0,
      notes,
    })
    .select("id")
    .single();

  if (lead.error) throw new Error(lead.error.message);
  return lead.data.id;
}

async function updateLeadFromIntake(supa: ReturnType<typeof createClient>, leadId: string, intake: AnyRecord, message: string) {
  if (!leadId) return;
  const update: AnyRecord = {
    notes: [
      "SMS AI intake follow-up received.",
      `Combined message: ${message}`,
      clean(intake.description) ? `Description: ${clean(intake.description)}` : "",
      clean(intake.notes) ? `Notes: ${clean(intake.notes)}` : "",
    ].filter(Boolean).join("\n"),
  };
  if (clean(intake.phone)) update.phone = clean(intake.phone);
  if (clean(intake.email)) update.email = clean(intake.email);
  if (clean(intake.address)) update.address = clean(intake.address);
  if (clean(intake.follow_up_date)) update.next_followup = clean(intake.follow_up_date);
  await supa.from("leads").update(update).eq("id", leadId);
}

async function openThreadForSender(supa: ReturnType<typeof createClient>, from: string) {
  if (!from) return null;
  const result = await supa
    .from("sms_intake_threads")
    .select("*")
    .eq("sender_phone", from)
    .eq("status", "open")
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return result.data || null;
}

async function saveThread(supa: ReturnType<typeof createClient>, thread: AnyRecord | null, payload: AnyRecord) {
  if (thread?.id) {
    const result = await supa
      .from("sms_intake_threads")
      .update({ ...payload, updated_at: new Date().toISOString() })
      .eq("id", thread.id)
      .select("*")
      .single();
    if (result.error) return thread;
    return result.data;
  }
  const result = await supa
    .from("sms_intake_threads")
    .insert(payload)
    .select("*")
    .single();
  if (result.error) return null;
  return result.data;
}

async function logSms(
  supa: ReturnType<typeof createClient>,
  threadId: string | null,
  from: string,
  inbound: string,
  outbound: string,
  intake: AnyRecord | null,
  action: string,
) {
  await supa.from("sms_intake_logs").insert({
    thread_id: threadId,
    sender_phone: from || null,
    inbound_message: inbound,
    outbound_message: outbound,
    parsed_intake: intake,
    action,
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204 });

  try {
    const type = req.headers.get("content-type") || "";
    let body = "";
    let from = "";
    let to = "";
    let accountSid = "";
    const params = new URLSearchParams();
    if (type.includes("application/x-www-form-urlencoded") || type.includes("multipart/form-data")) {
      const form = await req.formData();
      body = clean(form.get("Body"));
      from = clean(form.get("From"));
      to = clean(form.get("To"));
      accountSid = clean(form.get("AccountSid"));
      for (const [key, value] of form.entries()) params.append(key, clean(value));
    } else {
      const json = await req.json().catch(() => ({}));
      body = clean(json.Body || json.body || json.message);
      from = clean(json.From || json.from);
      to = clean(json.To || json.to);
      accountSid = clean(json.AccountSid || json.accountSid);
      Object.entries(json).forEach(([key, value]) => params.append(key, clean(value)));
    }

    const signatureOk = await verifyTwilioSignature(req, params);
    if (!signatureOk) return twimlStatus(`${BRAND}: SMS intake could not verify this message.`, 403);

    const expectedAccountSid = clean(Deno.env.get("TWILIO_ACCOUNT_SID"));
    if (expectedAccountSid && accountSid && accountSid !== expectedAccountSid) {
      return twimlStatus(`${BRAND}: SMS intake account mismatch.`, 403);
    }

    const command = body.toLowerCase().trim();
    if (["start", "yes", "unstop"].includes(command)) return twiml(OPT_IN_MESSAGE);
    if (["help", "info"].includes(command)) return twiml(HELP_MESSAGE);
    if (["stop", "stopall", "unsubscribe", "cancel", "end", "quit"].includes(command)) return twiml(OPT_OUT_MESSAGE);
    if (!body) return twiml(`${BRAND}: Send customer name, job description, sqft, system type, and follow-up timing.`);
    if (!allowedSender(from)) return twiml(`${BRAND}: This intake number is limited to approved SEFS users. Reply HELP for help or STOP to opt out.`);

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceRoleKey) throw new Error("Supabase service secrets are not configured.");
    const supa = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const existingThread = await openThreadForSender(supa, from);
    const combinedBody = existingThread?.combined_message
      ? `${clean(existingThread.combined_message)}\nFollow-up reply: ${body}`
      : body;
    const matches = await loadCustomerMatches(supa, combinedBody);
    const intake = await organizeIntake(combinedBody, matches);
    const missing = Array.isArray(intake.missing_questions) ? intake.missing_questions.filter(Boolean) : [];
    const shouldCreate = clean(intake.customer_name) || clean(intake.matched_customer_name);
    let leadId = existingThread?.lead_id ? clean(existingThread.lead_id) : null;
    if (!leadId && shouldCreate) {
      leadId = await createLead(supa, intake, combinedBody, from);
    } else if (leadId) {
      await updateLeadFromIntake(supa, leadId, intake, combinedBody);
    }

    if (!leadId) {
      const reply = `${BRAND}: Got it so far. ${missing[0] || "What is the customer name?"}`;
      const saved = await saveThread(supa, existingThread, {
        sender_phone: from,
        original_message: clean(existingThread?.original_message) || body,
        combined_message: combinedBody,
        status: "open",
        last_question: missing[0] || "What is the customer name?",
      });
      await logSms(supa, clean(saved?.id) || null, from, body, reply, intake, "missing_customer");
      return twiml(reply);
    }

    const customer = clean(intake.customer_name) || clean(intake.matched_customer_name) || "customer";
    const followUp = clean(intake.follow_up_date) || isoToday();
    const nextQuestion = missing[0] ? ` ${missing[0]}` : "";
    const reply = `${BRAND}: Lead created for ${customer}. Follow-up is set for ${formatDate(followUp)}.${nextQuestion}`;
    const saved = await saveThread(supa, existingThread, {
      sender_phone: from,
      original_message: clean(existingThread?.original_message) || body,
      combined_message: combinedBody,
      status: missing.length ? "open" : "completed",
      last_question: missing[0] || null,
      lead_id: leadId,
      customer_id: clean(intake.matched_customer_id) || null,
    });
    await logSms(supa, clean(saved?.id) || null, from, body, reply, intake, missing.length ? "lead_created_needs_info" : "lead_created");
    return twiml(reply);
  } catch (error) {
    console.error(error);
    return twiml(`${BRAND}: I could not save that intake yet. Please try again or enter it in the dashboard.`);
  }
});
