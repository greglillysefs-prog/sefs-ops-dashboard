import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

type Intake = {
  recommended_record_type: "lead" | "quote_draft" | "job_needs_quote" | "field_measure" | "customer_note" | "unknown";
  customer_name: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  job_name: string | null;
  system_type: string | null;
  square_feet: number | null;
  desired_date: string | null;
  follow_up_date: string | null;
  description: string | null;
  notes: string | null;
  urgency: string | null;
  confidence: number;
  missing_fields: string[];
  missing_questions: string[];
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-twilio-signature",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function clean(value: unknown) {
  return String(value ?? "").trim();
}

function normalizePhone(value: unknown) {
  const digits = clean(value).replace(/\D/g, "");
  if (!digits) return "";
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return clean(value);
}

function todayIso() {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 10);
}

function isoFromDate(d: Date) {
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 10);
}

function addDaysIso(days: number) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return isoFromDate(d);
}

function addMonthsIso(months: number) {
  const d = new Date();
  const day = d.getDate();
  d.setMonth(d.getMonth() + months);
  if (d.getDate() < day) d.setDate(0);
  return isoFromDate(d);
}

function weekdayOffset(target: number, nextOnly = false) {
  const current = new Date().getDay();
  let diff = (target - current + 7) % 7;
  if (nextOnly || diff === 0) diff += 7;
  return diff;
}

function parseIntakeDate(text: string) {
  const s = text.toLowerCase();
  const explicit = s.match(/\b(\d{1,2})[\/\-](\d{1,2})(?:[\/\-](\d{2,4}))?\b/);
  if (explicit) {
    let year = explicit[3] ? Number(explicit[3]) : new Date().getFullYear();
    if (year < 100) year += 2000;
    return `${year}-${String(Number(explicit[1])).padStart(2, "0")}-${String(Number(explicit[2])).padStart(2, "0")}`;
  }

  const relative = s.match(/\b(?:in|within|after|follow\s*up\s*in)\s+(\d{1,3})\s*(day|days|week|weeks|month|months)\b/);
  if (relative) {
    const amount = Number(relative[1]);
    const unit = relative[2];
    if (unit.startsWith("day")) return addDaysIso(amount);
    if (unit.startsWith("week")) return addDaysIso(amount * 7);
    if (unit.startsWith("month")) return addMonthsIso(amount);
  }

  const weekdayMap: Record<string, number> = {
    sunday: 0,
    sun: 0,
    monday: 1,
    mon: 1,
    tuesday: 2,
    tue: 2,
    tues: 2,
    wednesday: 3,
    wed: 3,
    thursday: 4,
    thu: 4,
    thur: 4,
    thurs: 4,
    friday: 5,
    fri: 5,
    saturday: 6,
    sat: 6,
  };
  const weekday = s.match(/\b(this|next)?\s*(sunday|sun|monday|mon|tuesday|tue|tues|wednesday|wed|thursday|thu|thur|thurs|friday|fri|saturday|sat)\b/);
  if (weekday) return addDaysIso(weekdayOffset(weekdayMap[weekday[2]], weekday[1] === "next"));

  if (/\btomorrow\b/.test(s)) return addDaysIso(1);
  if (/\bnext week\b/.test(s)) return addDaysIso(7);
  if (/\bnext month\b/.test(s)) return addMonthsIso(1);
  if (/\btoday\b/.test(s)) return todayIso();
  return null;
}

function titleCaseName(value: string) {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

function parseIntakeSystem(text: string) {
  const s = text.toLowerCase();
  const map: Array<[string, RegExp]> = [
    ["Grind/Stain/Seal", /\b(grind|stain|seal|gss)\b/],
    ["Wood/Stone Overlay", /\b(wood|stone)\b/],
    ["Broom Overlay", /\b(broom|overlay)\b/],
    ["Metallic", /\bmetallic\b/],
    ["Quartz", /\bquartz\b/],
    ["Flake", /\bflake|chip\b/],
    ["Polish", /\bpolish(ed)?\b/],
    ["Prep Only", /\bprep only|grind only|surface prep\b/],
    ["Mortar", /\bmortar|repair\b/],
  ];
  const found = map.find(([, rx]) => rx.test(s));
  return found ? found[0] : null;
}

function parseIntakeAddress(text: string) {
  const match = text.match(/\b\d{2,6}\s+[A-Za-z0-9 .'-]+?\s+(?:st|street|ave|avenue|rd|road|dr|drive|ln|lane|ct|court|cir|circle|blvd|boulevard|way|pkwy|parkway|hwy|highway|depot)(?:\s+(?:st|street|ave|avenue|rd|road|dr|drive|ln|lane|ct|court|cir|circle|blvd|boulevard|way|pkwy|parkway|hwy|highway))?\b/i);
  return match ? match[0].replace(/[,.]+$/, "").trim() : null;
}

function parseIntakeName(text: string, phone: string | null, email: string | null, address: string | null) {
  let cleanText = text
    .replace(phone || "", "")
    .replace(email || "", "")
    .replace(address || "", "")
    .replace(/\b\d{2,6}(?:\.\d+)?\s*(?:sq\.?\s*ft|sqft|square\s*feet|sf)\b/gi, "")
    .trim();

  const labeled = cleanText.match(/\b(?:customer|client|name|call from|called|for)\s*[:\-]?\s*([A-Za-z][A-Za-z.'-]*(?:\s+[A-Za-z][A-Za-z.'-]*){0,2})\b/i);
  if (labeled) return titleCaseName(labeled[1].replace(/\b(about|wants|needs|called|has|for)\b.*$/i, "").trim());

  cleanText = cleanText.replace(/^\s*(?:new lead|lead|job|quote|estimate)\s*[:\-]?\s*/i, "");
  const firstChunk = cleanText.match(/^\s*([A-Za-z][A-Za-z.'-]*(?:\s+[A-Za-z][A-Za-z.'-]*){0,2})(?=\s+(?:wants|needs|called|about|for|has|is|with)\b|[,.-]|$)/i);
  if (firstChunk) return titleCaseName(firstChunk[1].trim());
  return null;
}

function localIntakeParse(text: string): Intake {
  const phone = normalizePhone((text.match(/(?:\+?1[\s.-]?)?(?:\(?\d{3}\)?[\s.-]?)\d{3}[\s.-]?\d{4}/) || [])[0] || "") || null;
  const email = (text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i) || [])[0] || null;
  const address = parseIntakeAddress(text);
  const squareFeet = (text.match(/\b(\d{2,6}(?:\.\d+)?)\s*(?:sq\.?\s*ft|sqft|square\s*feet|sf)\b/i) || [])[1] || null;
  const system = parseIntakeSystem(text);
  const followUp = parseIntakeDate(text);
  const name = parseIntakeName(text, phone, email, address);
  const lower = text.toLowerCase();
  const type = /\b(measure|measurement|site visit)\b/.test(lower)
    ? "field_measure"
    : /\b(approved|won|do the job|ready to schedule)\b/.test(lower)
      ? "job_needs_quote"
      : /\b(quote|estimate|price|bid)\b/.test(lower)
        ? "quote_draft"
        : "lead";

  const missing: string[] = [];
  const questions: string[] = [];
  if (!name) {
    missing.push("customer_name");
    questions.push("What is the customer name?");
  }
  if (!phone) {
    missing.push("phone");
    questions.push("What phone number should I use for the customer?");
  }
  if (!address) {
    missing.push("address");
    questions.push("What is the job address?");
  }
  if (!system) {
    missing.push("system_type");
    questions.push("What floor system or type is this for?");
  }
  if (!squareFeet) {
    missing.push("square_feet");
    questions.push("What is the approximate square footage?");
  }

  const description = text
    .replace(phone || "", "")
    .replace(email || "", "")
    .replace(address || "", "")
    .replace(/\s+/g, " ")
    .trim();

  return {
    recommended_record_type: type,
    customer_name: name,
    phone,
    email,
    address,
    job_name: name,
    system_type: system,
    square_feet: squareFeet ? Number(squareFeet) : null,
    desired_date: null,
    follow_up_date: followUp || todayIso(),
    description: description || null,
    notes: null,
    urgency: /\b(asap|urgent|today|tomorrow)\b/i.test(text) ? "urgent" : null,
    confidence: [name, phone, address, system, squareFeet].filter(Boolean).length / 5,
    missing_fields: missing,
    missing_questions: questions,
  };
}

function twiml(message: string, status = 200) {
  const safe = message
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  return new Response(`<?xml version="1.0" encoding="UTF-8"?><Response><Message>${safe}</Message></Response>`, {
    status,
    headers: { "Content-Type": "text/xml; charset=utf-8" },
  });
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function hmacSha1Base64(key: string, text: string) {
  const cryptoKey = await crypto.subtle.importKey("raw", new TextEncoder().encode(key), { name: "HMAC", hash: "SHA-1" }, false, ["sign"]);
  const signature = await crypto.subtle.sign("HMAC", cryptoKey, new TextEncoder().encode(text));
  let binary = "";
  for (const byte of new Uint8Array(signature)) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function safeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) result |= a.charCodeAt(i) ^ b.charCodeAt(i);
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

function normalizeName(value: unknown) {
  return clean(value)
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function removeMissing(intake: Intake, fields: string[]) {
  const fieldSet = new Set(fields);
  intake.missing_fields = intake.missing_fields.filter((field) => !fieldSet.has(field));
  intake.missing_questions = intake.missing_questions.filter((question) => {
    const q = question.toLowerCase();
    if (fieldSet.has("phone") && q.includes("phone")) return false;
    if (fieldSet.has("address") && q.includes("address")) return false;
    if (fieldSet.has("email") && q.includes("email")) return false;
    if (fieldSet.has("customer_name") && q.includes("customer name")) return false;
    return true;
  });
}

async function findExistingCustomer(supa: ReturnType<typeof createClient>, intake: Intake) {
  const phone = normalizePhone(intake.phone);
  if (phone) {
    const digits = phone.replace(/\D/g, "");
    const { data, error } = await supa
      .from("customers")
      .select("id, name, phone, email, address")
      .or(`phone.eq.${phone},phone.ilike.%${digits}%`)
      .limit(2);
    if (error) throw error;
    if ((data || []).length === 1) return data[0];
  }

  const name = normalizeName(intake.customer_name);
  if (!name || name.length < 3) return null;
  const words = name.split(" ").filter((word) => word.length > 1);
  if (!words.length) return null;

  const { data, error } = await supa
    .from("customers")
    .select("id, name, phone, email, address")
    .ilike("name", `%${words.join("%")}%`)
    .limit(10);
  if (error) throw error;

  const matches = (data || []).filter((customer) => {
    const customerName = normalizeName(customer.name);
    return customerName === name || words.every((word) => customerName.includes(word));
  });
  return matches.length === 1 ? matches[0] : null;
}

function applyCustomerMatch(intake: Intake, customer: Record<string, unknown> | null) {
  if (!customer) return intake;
  const filled: string[] = [];
  if (!intake.customer_name && clean(customer.name)) {
    intake.customer_name = clean(customer.name);
    filled.push("customer_name");
  }
  if (!intake.phone && clean(customer.phone)) {
    intake.phone = normalizePhone(customer.phone);
    filled.push("phone");
  }
  if (!intake.email && clean(customer.email)) {
    intake.email = clean(customer.email);
    filled.push("email");
  }
  if (!intake.address && clean(customer.address)) {
    intake.address = clean(customer.address);
    filled.push("address");
  }
  if (filled.length) removeMissing(intake, filled);
  return intake;
}

function leadNotes(rawMessages: string, intake: Intake, fromPhone: string) {
  return [
    `Created from SMS intake from ${fromPhone}.`,
    "",
    "Raw intake:",
    rawMessages,
    "",
    intake.system_type ? `System/type: ${intake.system_type}` : "",
    intake.square_feet ? `Square feet: ${intake.square_feet}` : "",
    intake.description ? `Description: ${intake.description}` : "",
    intake.urgency ? `Urgency: ${intake.urgency}` : "",
    "Quote builder/material list required before scheduling.",
  ].filter(Boolean).join("\n");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "POST required" }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) return twiml("SEFS intake is missing Supabase configuration.", 500);

  const supa = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  let params: URLSearchParams;
  try {
    params = new URLSearchParams(await req.text());
  } catch {
    return twiml("SEFS intake could not read that message.", 400);
  }

  const signatureOk = await verifyTwilioSignature(req, params);
  if (!signatureOk) return twiml("SEFS intake could not verify this message.", 403);

  const accountSid = clean(Deno.env.get("TWILIO_ACCOUNT_SID"));
  if (accountSid && clean(params.get("AccountSid")) && clean(params.get("AccountSid")) !== accountSid) {
    return twiml("SEFS intake account mismatch.", 403);
  }

  const fromPhone = normalizePhone(params.get("From"));
  const toPhone = normalizePhone(params.get("To"));
  const body = clean(params.get("Body"));
  const messageSid = clean(params.get("MessageSid") || params.get("SmsMessageSid"));

  if (!body) return twiml("SEFS intake received a blank message.");

  const existingMessage = messageSid
    ? await supa
        .from("sms_intake_messages")
        .select("response_body")
        .eq("twilio_message_sid", messageSid)
        .maybeSingle()
    : { data: null, error: null };
  if (!existingMessage.error && existingMessage.data?.response_body) {
    return twiml(existingMessage.data.response_body);
  }

  const upperBody = body.toUpperCase();
  if (upperBody === "START" || upperBody === "YES") {
    return twiml("Southeast Flooring Solutions: You are opted in for job intake, scheduling, follow-up, and operations SMS. Msg freq varies. Msg&data rates may apply. Privacy/Terms: https://sefs-sms-compliance.pages.dev Reply HELP for help. Reply STOP to opt out.");
  }
  if (upperBody === "HELP" || upperBody === "INFO") {
    return twiml("Southeast Flooring Solutions SMS help: call 321-284-8168. Msg freq varies. Msg&data rates may apply. Reply STOP to opt out. Privacy/Terms: https://sefs-sms-compliance.pages.dev");
  }
  if (upperBody === "STOP" || upperBody === "STOPALL" || upperBody === "UNSUBSCRIBE" || upperBody === "CANCEL" || upperBody === "END" || upperBody === "QUIT") {
    return twiml("Southeast Flooring Solutions: You have successfully opted out. You will not receive any more messages from this number. Reply START to opt back in.");
  }
  if (!allowedSender(fromPhone)) return twiml("This SEFS intake number is limited to approved SEFS users. Reply HELP for help or STOP to opt out.");

  try {
    const { data: conversation, error: conversationError } = await supa
      .from("sms_intake_conversations")
      .select("id, status, created_lead_id")
      .eq("from_phone", fromPhone)
      .eq("status", "collecting")
      .order("latest_message_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (conversationError) throw conversationError;

    let conversationId = conversation?.id;
    if (!conversationId) {
      const { data: insertedConversation, error: insertConversationError } = await supa
        .from("sms_intake_conversations")
        .insert({ from_phone: fromPhone, to_phone: toPhone, status: "collecting" })
        .select("id")
        .single();
      if (insertConversationError) throw insertConversationError;
      conversationId = insertedConversation.id;
    }

    const inbound = await supa
      .from("sms_intake_messages")
      .insert({
        conversation_id: conversationId,
        twilio_message_sid: messageSid || null,
        direction: "inbound",
        from_phone: fromPhone,
        to_phone: toPhone,
        body,
      })
      .select("id")
      .single();
    if (inbound.error) throw inbound.error;

    const { data: messageRows, error: messageRowsError } = await supa
      .from("sms_intake_messages")
      .select("body")
      .eq("conversation_id", conversationId)
      .eq("direction", "inbound")
      .order("created_at");
    if (messageRowsError) throw messageRowsError;

    const combinedText = (messageRows || []).map((row) => clean(row.body)).filter(Boolean).join("\n");
    const intake = localIntakeParse(combinedText);
    const matchedCustomer = await findExistingCustomer(supa, intake);
    applyCustomerMatch(intake, matchedCustomer);
    const nextQuestion = intake.missing_questions[0] || "";
    let reply = "";

    if (nextQuestion) {
      reply = `Southeast Flooring Solutions: Got it so far. ${nextQuestion}`;
    } else {
      let customerId = matchedCustomer?.id;
      if (!customerId) {
        const { data: insertedCustomer, error: insertedCustomerError } = await supa
          .from("customers")
          .insert({
            name: intake.customer_name || "SMS Intake",
            phone: intake.phone,
            email: intake.email,
            address: intake.address,
            status: "Active",
            notes: "Created from SMS intake.",
          })
          .select("id")
          .single();
        if (insertedCustomerError) throw insertedCustomerError;
        customerId = insertedCustomer?.id;
      }

      if (!customerId) throw new Error("Could not create or find customer.");

      const { data: lead, error: leadError } = await supa
        .from("leads")
        .insert({
          customer_id: customerId,
          customer: intake.customer_name || "SMS Intake",
          phone: intake.phone,
          email: intake.email,
          address: intake.address,
          stage: "New Lead",
          next_followup: intake.follow_up_date || todayIso(),
          estimated_value: 0,
          notes: leadNotes(combinedText, intake, fromPhone),
        })
        .select("id")
        .single();
      if (leadError) throw leadError;

      await supa
        .from("sms_intake_conversations")
        .update({
          status: "lead_created",
          latest_analysis: intake,
          pending_fields: intake.missing_fields,
          pending_questions: intake.missing_questions,
          created_customer_id: customerId,
          created_lead_id: lead.id,
          latest_message_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", conversationId);

      reply = `Southeast Flooring Solutions: Lead created for ${intake.customer_name}. ${intake.square_feet ? `${intake.square_feet} sq ft ` : ""}${intake.system_type || "job"} follow-up set for ${intake.follow_up_date || todayIso()}.`;
    }

    if (nextQuestion) {
      await supa
        .from("sms_intake_conversations")
        .update({
          latest_analysis: intake,
          pending_fields: intake.missing_fields,
          pending_questions: intake.missing_questions,
          created_customer_id: matchedCustomer?.id || null,
          latest_message_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", conversationId);
    }

    await supa
      .from("sms_intake_messages")
      .update({ parsed_payload: intake, response_body: reply })
      .eq("id", inbound.data.id);

    await supa
      .from("sms_intake_messages")
      .insert({
        conversation_id: conversationId,
        direction: "outbound",
        from_phone: toPhone,
        to_phone: fromPhone,
        body: reply,
        parsed_payload: intake,
      });

    return twiml(reply);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return twiml(`Southeast Flooring Solutions: SMS intake hit an error. ${message}`, 500);
  }
});
