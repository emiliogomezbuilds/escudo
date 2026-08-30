"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";

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
