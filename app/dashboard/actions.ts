"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { generateAlertScript } from "@/lib/gemini";
import { placeAlertCall } from "@/lib/twilio";

type ActionResult = { error?: string; success?: boolean };

const PHONE_RE = /^\+[1-9]\d{6,14}$/; // E.164

export async function addFamilyContact(
  formData: FormData,
): Promise<ActionResult> {
  const name = String(formData.get("name") || "").trim();
  const phone = String(formData.get("phone") || "").trim();

  if (!name) return { error: "El nombre es obligatorio." };
  if (!PHONE_RE.test(phone)) {
    return {
      error: "Número inválido. Usa formato E.164, ej. +525512345678.",
    };
  }

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  if (!auth?.claims) return { error: "Sesión no válida." };

  const { error } = await supabase.from("family_contacts").insert({
    name,
    phone_e164: phone,
  });

  if (error) return { error: error.message };

  revalidatePath("/dashboard");
  return { success: true };
}

export async function verifyFamilyContact(contactId: string): Promise<void> {
  "use server";
  const supabase = await createClient();
  await supabase
    .from("family_contacts")
    .update({ verified: true })
    .eq("id", contactId);

  revalidatePath("/dashboard");
}

export async function deleteFamilyContact(contactId: string): Promise<void> {
  "use server";
  const supabase = await createClient();
  await supabase.from("family_contacts").delete().eq("id", contactId);

  revalidatePath("/dashboard");
}

export async function saveThreshold(formData: FormData): Promise<ActionResult> {
  const minAmountRaw = String(formData.get("min_amount") || "").trim();
  const label = String(formData.get("protected_person_label") || "").trim();
  const minAmount = Number(minAmountRaw);

  if (!label) {
    return { error: "El nombre de la persona protegida es obligatorio." };
  }
  if (!Number.isFinite(minAmount) || minAmount <= 0) {
    return { error: "El umbral debe ser un número mayor a 0." };
  }

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  if (!auth?.claims) return { error: "Sesión no válida." };
  const ownerId = auth.claims.sub as string;

  const { data: existing } = await supabase
    .from("alert_thresholds")
    .select("id")
    .eq("owner_id", ownerId)
    .maybeSingle();

  const { error } = existing
    ? await supabase
        .from("alert_thresholds")
        .update({ min_amount: minAmount, protected_person_label: label })
        .eq("id", existing.id)
    : await supabase
        .from("alert_thresholds")
        .insert({ min_amount: minAmount, protected_person_label: label });

  if (error) return { error: error.message };

  revalidatePath("/dashboard");
  return { success: true };
}

// --- Feature 5: simulated risk event + pattern-match rule ---
//
// SHADOW CLAUSE (docs/PACKET.md): this only ever evaluates a behavioral
// pattern — timing of a call, an app open, a transfer, whether the payee is
// new, and the saved dollar threshold. It never inspects, scores, or makes
// any claim about whether a call, voice, or video is real. No ML model is
// involved; this is a plain rule below, on purpose.
const UNKNOWN_CALL_WINDOW_MIN = 30; // call must be this recent to count
const APP_OPEN_WINDOW_MIN = 15; // app-open must be this recent to count

type SimulateResult = ActionResult & {
  matched?: boolean;
  scriptText?: string;
  callStatus?: string;
  callError?: string;
};

export async function simulateRiskEvent(
  formData: FormData,
): Promise<SimulateResult> {
  const minutesSinceCall = Number(
    String(formData.get("minutes_since_call") || "").trim(),
  );
  const minutesSinceAppOpen = Number(
    String(formData.get("minutes_since_app_open") || "").trim(),
  );
  const amount = Number(String(formData.get("amount") || "").trim());
  const payeeLabel = String(formData.get("payee_label") || "").trim();
  const payeeIsNew = formData.get("payee_is_new") === "on";

  if (!payeeLabel) {
    return { error: "El nombre del destinatario es obligatorio." };
  }
  if (!Number.isFinite(minutesSinceCall) || minutesSinceCall < 0) {
    return { error: "Minutos desde la llamada debe ser un número válido." };
  }
  if (!Number.isFinite(minutesSinceAppOpen) || minutesSinceAppOpen < 0) {
    return {
      error: "Minutos desde que se abrió la app debe ser un número válido.",
    };
  }
  if (!Number.isFinite(amount) || amount <= 0) {
    return { error: "El monto debe ser un número mayor a 0." };
  }

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  if (!auth?.claims) return { error: "Sesión no válida." };
  const ownerId = auth.claims.sub as string;

  const { data: threshold } = await supabase
    .from("alert_thresholds")
    .select("min_amount, protected_person_label")
    .eq("owner_id", ownerId)
    .maybeSingle();

  if (!threshold) {
    return {
      error: "Configura un umbral de alerta antes de simular un evento.",
    };
  }

  const matched =
    payeeIsNew &&
    amount > threshold.min_amount &&
    minutesSinceCall <= UNKNOWN_CALL_WINDOW_MIN &&
    minutesSinceAppOpen <= APP_OPEN_WINDOW_MIN &&
    minutesSinceCall >= minutesSinceAppOpen;

  const { data: insertedEvent, error } = await supabase
    .from("risk_events")
    .insert({
      event_type: "llamada_desconocida_seguida_de_transferencia",
      amount,
      payee_label: payeeLabel,
      matched,
      is_simulated: true,
    })
    .select("id")
    .single();

  if (error) return { error: error.message };

  // Feature 6 + 7: on a matched event, generate the alert script, then
  // actually place the outbound Twilio call to the owner's first *verified*
  // family contact (verified here = confirmed in our own app; a Twilio
  // trial account additionally requires the number be a verified Caller ID
  // in Twilio itself, or the call will fail with a Twilio error we surface
  // below rather than silently swallow).
  let scriptText: string | undefined;
  let callStatus: string | undefined;
  let callError: string | undefined;

  if (matched && insertedEvent) {
    scriptText = await generateAlertScript({
      protectedPersonLabel: threshold.protected_person_label,
      amount,
      payeeLabel,
    });

    const { data: contact } = await supabase
      .from("family_contacts")
      .select("phone_e164")
      .eq("verified", true)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (contact) {
      const result = await placeAlertCall(contact.phone_e164, scriptText);
      if (result.ok) {
        callStatus = "initiated";
      } else {
        callStatus = "failed";
        callError = result.error;
      }
    } else {
      callStatus = "failed";
      callError =
        "No hay ningún contacto familiar confirmado (Verificado) para llamar.";
    }

    await supabase.from("alert_calls").insert({
      risk_event_id: insertedEvent.id,
      script_text: scriptText,
      call_status: callStatus,
    });
  }

  revalidatePath("/dashboard");
  return { success: true, matched, scriptText, callStatus, callError };
}
