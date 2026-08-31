import { Suspense } from "react";
import { redirect } from "next/navigation";
import { InfoIcon } from "lucide-react";

import { createClient } from "@/lib/supabase/server";
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
import { SimulateEventForm } from "@/components/simulate-event-form";
import { AlertHistoryList } from "@/components/alert-history-list";

// This project uses Next.js Cache Components (next.config.ts: cacheComponents:
// true). Under that model there's no `export const dynamic` — instead, any
// part of the page that reads cookies/session or queries per-user rows must
// be isolated in its own component and wrapped in <Suspense> below, so the
// build can prerender the static shell and stream this part in at request
// time instead of trying (and failing) to prerender it with no real session.
async function FamilyDashboardContent() {
  const supabase = await createClient();
  const { data: auth, error: authError } = await supabase.auth.getClaims();

  if (authError || !auth?.claims) {
    redirect("/auth/login");
  }

  const [{ data: contacts }, { data: threshold }, { data: riskEvents }] =
    await Promise.all([
      supabase
        .from("family_contacts")
        .select("id, name, phone_e164, verified")
        .order("created_at", { ascending: true }),
      supabase
        .from("alert_thresholds")
        .select("min_amount, protected_person_label")
        .maybeSingle(),
      supabase
        .from("risk_events")
        .select(
          "id, amount, payee_label, matched, is_simulated, created_at, alert_calls(id, script_text, call_status, placed_at)",
        )
        .order("created_at", { ascending: false })
        .limit(20),
    ]);

  return (
    <>
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

      <Card>
        <CardHeader>
          <CardTitle>Simular evento de riesgo</CardTitle>
          <CardDescription>
            Reemplaza al detector de patrón en el dispositivo (no construido
            esta semana). Verifica la regla contra tu umbral guardado —
            nunca analiza si una llamada o video es falso.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <SimulateEventForm hasThreshold={!!threshold} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Historial de alertas</CardTitle>
          <CardDescription>
            Eventos recientes y, cuando corresponde, la llamada real
            resultante. Visible solo para tu cuenta.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <AlertHistoryList events={riskEvents ?? []} />
        </CardContent>
      </Card>

      <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
        🔒 Este sistema nunca analiza si una llamada o video es falso — solo
        reacciona a un patrón de comportamiento.
      </div>
    </>
  );
}

export default function DashboardPage() {
  return (
    <div className="flex-1 w-full flex flex-col gap-12">
      <div className="w-full">
        <div className="bg-accent text-sm p-3 px-5 rounded-md text-foreground flex gap-3 items-center">
          <InfoIcon size="16" strokeWidth={2} />
          Panel del administrador familiar — visible solo para tu cuenta.
        </div>
      </div>

      <Suspense
        fallback={<p className="text-muted-foreground">Cargando…</p>}
      >
        <FamilyDashboardContent />
      </Suspense>
    </div>
  );
}
