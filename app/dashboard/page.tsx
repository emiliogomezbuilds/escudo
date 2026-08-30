import { redirect } from "next/navigation";
import { InfoIcon } from "lucide-react";

import { createClient } from "@/lib/supabase/server";

// This page reads the caller's cookies/session and queries per-user rows —
// it must never be statically prerendered at build time (no real session
// exists then), or the build fails trying to render it with no cookies.
export const dynamic = "force-dynamic";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { FamilyContactForm } from "@/components/family-contact-form";
import { FamilyContactList } from "@/components/family-contact-list";
import { ThresholdForm } from "@/components/threshold-form";

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: auth, error: authError } = await supabase.auth.getClaims();

  if (authError || !auth?.claims) {
    redirect("/auth/login");
  }

  const [{ data: contacts }, { data: threshold }] = await Promise.all([
    supabase
      .from("family_contacts")
      .select("id, name, phone_e164, verified")
      .order("created_at", { ascending: true }),
    supabase
      .from("alert_thresholds")
      .select("min_amount, protected_person_label")
      .maybeSingle(),
  ]);

  return (
    <div className="flex-1 w-full flex flex-col gap-12">
      <div className="w-full">
        <div className="bg-accent text-sm p-3 px-5 rounded-md text-foreground flex gap-3 items-center">
          <InfoIcon size="16" strokeWidth={2} />
          Panel del administrador familiar — visible solo para tu cuenta.
        </div>
      </div>

      <div className="flex flex-col gap-2 items-start">
        <h1 className="font-bold text-2xl">Panel familiar</h1>
        <p className="text-muted-foreground">
          Sesión iniciada como {auth.claims.email as string}.
        </p>
      </div>

      <div className="grid gap-8 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Contacto familiar</CardTitle>
            <CardDescription>
              La persona que recibirá la llamada real de alerta. Confirma su
              número manualmente antes de que pueda recibir llamadas reales —
              la llamada de voz automática se activa en una próxima feature.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-6">
            <FamilyContactForm />
            <FamilyContactList contacts={contacts ?? []} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Umbral de alerta</CardTitle>
            <CardDescription>
              Define a partir de qué monto, hacia un destinatario nuevo, se
              considera un evento de riesgo.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ThresholdForm
              defaultMinAmount={threshold?.min_amount ?? undefined}
              defaultLabel={threshold?.protected_person_label ?? undefined}
            />
          </CardContent>
        </Card>
      </div>

      <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
        🔒 Este sistema nunca analiza si una llamada o video es falso — solo
        reacciona a un patrón de comportamiento. El formulario para simular un
        evento de riesgo y el historial de alertas llegan en próximas
        features.
      </div>
    </div>
  );
}
