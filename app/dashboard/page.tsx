import { redirect } from "next/navigation";
import { Suspense } from "react";

import { createClient } from "@/lib/supabase/server";
import { InfoIcon } from "lucide-react";

async function WelcomeMessage() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();

  if (error || !data?.claims) {
    redirect("/auth/login");
  }

  return (
    <p className="text-muted-foreground">
      Sesión iniciada como {data.claims.email as string}.
    </p>
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
      <div className="flex flex-col gap-2 items-start">
        <h1 className="font-bold text-2xl">Panel familiar</h1>
        <Suspense fallback={<p className="text-muted-foreground">Cargando…</p>}>
          <WelcomeMessage />
        </Suspense>
        <p className="text-muted-foreground">
          Configuración de contacto familiar, umbral de alerta y eventos
          simulados llega en las próximas features.
        </p>
      </div>
    </div>
  );
}
