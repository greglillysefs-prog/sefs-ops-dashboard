import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function clean(value: unknown) {
  return String(value ?? "").trim();
}

function digits(value: unknown) {
  return clean(value).replace(/\D/g, "");
}

function customerSearchText(customer: Record<string, unknown>) {
  return [
    customer.name,
    customer.phone,
    customer.email,
    customer.address,
    customer.notes,
  ].map(clean).join(" ").toLowerCase();
}

function scoreCustomer(customer: Record<string, unknown>, message: string) {
  const lower = message.toLowerCase();
  const messageDigits = digits(message);
  const name = clean(customer.name).toLowerCase();
  const phone = digits(customer.phone);
  const email = clean(customer.email).toLowerCase();
  const address = clean(customer.address).toLowerCase();
  let score = 0;
  if (name && lower.includes(name)) score += 80;
  if (name) {
    const parts = name.split(/\s+/).filter((part) => part.length > 2);
    score += parts.filter((part) => lower.includes(part)).length * 18;
  }
  if (phone && messageDigits.includes(phone.slice(-7))) score += 90;
  if (email && lower.includes(email)) score += 85;
  if (address && lower.includes(address)) score += 45;
  if (customerSearchText(customer).split(/\s+/).some((part) => part.length > 4 && lower.includes(part))) score += 8;
  return score;
}

async function loadCustomerMatches(message: string) {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) return [];

  const supa = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const result = await supa
    .from("customers")
    .select("id,name,phone,email,address,status,notes,updated_at")
    .order("updated_at", { ascending: false })
    .limit(250);

  if (result.error) return [];
  return (result.data || [])
    .map((customer) => ({ ...customer, match_score: scoreCustomer(customer, message) }))
    .filter((customer) => customer.match_score >= 18)
    .sort((a, b) => b.match_score - a.match_score)
    .slice(0, 8);
}

function parseJsonText(data: Record<string, unknown>) {
  const direct = clean(data.output_text);
  if (direct) return JSON.parse(direct);

  const output = Array.isArray(data.output) ? data.output : [];
  for (const item of output) {
    const content = Array.isArray((item as Record<string, unknown>).content) ? (item as Record<string, unknown>).content as Record<string, unknown>[] : [];
    for (const part of content) {
      const text = clean(part.text);
      if (text) return JSON.parse(text);
    }
  }
  throw new Error("AI response did not include structured intake JSON.");
}

const intakeSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    recommended_record_type: { type: "string", enum: ["lead", "quote_draft", "job_needs_quote", "field_measure", "customer_note", "unknown"] },
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
    urgency: { type: ["string", "null"] },
    confidence: { type: "number" },
    missing_fields: { type: "array", items: { type: "string" } },
    missing_questions: { type: "array", items: { type: "string" } },
    matched_customer_id: { type: ["string", "null"] },
    matched_customer_name: { type: ["string", "null"] },
    match_reason: { type: ["string", "null"] },
  },
  required: [
    "recommended_record_type",
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
    "urgency",
    "confidence",
    "missing_fields",
    "missing_questions",
    "matched_customer_id",
    "matched_customer_name",
    "match_reason",
  ],
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "POST required" }, 405);

  const apiKey = Deno.env.get("OPENAI_API_KEY");
  const model = Deno.env.get("OPENAI_MODEL") || "gpt-4.1-mini";
  if (!apiKey) return json({ error: "AI intake is not configured. Set OPENAI_API_KEY in Supabase Edge Function secrets." }, 500);

  let payload: Record<string, unknown>;
  try {
    payload = await req.json();
  } catch {
    return json({ error: "Invalid JSON payload." }, 400);
  }

  const message = clean(payload.message);
  if (!message) return json({ error: "Message is required." }, 400);
  if (message.length > 6000) return json({ error: "Message is too long. Keep intake notes under 6000 characters." }, 400);

  try {
    const today = new Date().toISOString().slice(0, 10);
    const customerMatches = await loadCustomerMatches(message);
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
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
                  "You organize messy intake notes for Southeast Flooring Solutions.",
                  "Extract only facts that are present or strongly implied.",
                  "Do not invent customer details, pricing, schedule dates, or measurements.",
                  "Use provided customer matches to fill known phone, email, and address only when the message clearly names or identifies the same customer.",
                  "If an existing customer match is clear, set matched_customer_id, matched_customer_name, and keep phone/address from that customer instead of asking for them.",
                  "If no customer match is clear, leave matched_customer_id null and ask for missing customer contact fields.",
                  "Pick recommended_record_type as lead by default. Use quote_draft when the note clearly requests an estimate/quote. Use job_needs_quote only when the note says the work is approved or won but still lacks quote/material details. Use field_measure when the main request is measuring/site documentation. Use customer_note when there is no job request.",
                  "Normalize system_type to one of: Flake, Metallic, Quartz, Mortar, Wood/Stone Overlay, Broom Overlay, Grind/Stain/Seal, Polish, Prep Only, or null.",
                  "Dates must be ISO yyyy-mm-dd when enough information is present. Today is " + today + ".",
                  "missing_fields should include important missing facts needed to act safely. missing_questions should be short questions to ask the user next. Ask at most one missing question unless multiple facts are required before any useful action.",
                ].join(" "),
              },
            ],
          },
          {
            role: "user",
            content: [{
              type: "input_text",
              text: JSON.stringify({
                message,
                customer_matches: customerMatches,
              }),
            }],
          },
        ],
        text: {
          format: {
            type: "json_schema",
            name: "sefs_intake",
            schema: intakeSchema,
            strict: true,
          },
        },
      }),
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = data?.error?.message || `OpenAI request failed (${response.status})`;
      return json({ error }, response.status);
    }

    const intake = parseJsonText(data as Record<string, unknown>);
    return json({ ok: true, intake, customer_matches: customerMatches });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : String(error) }, 500);
  }
});
