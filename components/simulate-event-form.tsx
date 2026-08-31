"use client";

import { useActionState, useEffect, useRef } from "react";
import { useFormStatus } from "react-dom";

import { simulateRiskEvent } from "@/app/dashboard/actions";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type FormState = {
  error?: string;
  matched?: boolean;
  scriptText?: string;
  callStatus?: string;
  callError?: string;
  submittedAt: number;
};

const initialState: FormState = {
  error: undefined,
  matched: undefined,
  scriptText: undefined,
  callStatus: undefined,
  callError: undefined,
  submittedAt: 0,
};

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      variant="destructive"
      disabled={pending}
      className="w-fit"
    >
      {pending ? "Simulando…" : "Simular evento"}
    </Button>
  );
}

export function SimulateEventForm({ hasThreshold }: { hasThreshold: boolean }) {
  const formRef = useRef<HTMLFormElement>(null);

  const [state, formAction] = useActionState(
    async (prev: FormState, formData: FormData): Promise<FormState> => {
      const result = await simulateRiskEvent(formData);
      if (result?.error) {
        return {
          error: result.error,
          matched: undefined,
          scriptText: undefined,
          callStatus: undefined,
          callError: undefined,
          submittedAt: prev.submittedAt,
        };
      }
      return {
        error: undefined,
        matched: result.matched,
        scriptText: result.scriptText,
        callStatus: result.callStatus,
        callError: result.callError,
        submittedAt: Date.now(),
      };
    },
    initialState,
  );

  useEffect(() => {
    if (state.submittedAt) formRef.current?.reset();
  }, [state.submittedAt]);

  if (!hasThreshold) {
    return (
      <p className="text-sm text-muted-foreground">
        Primero guarda un umbral de alerta arriba para poder simular un
        evento de riesgo.
      </p>
    );
  }

  return (
    <form ref={formRef} action={formAction} className="flex flex-col gap-4">
      <div className="rounded-md border border-amber-500 bg-amber-50 dark:bg-amber-950/40 p-3 text-xs text-amber-800 dark:text-amber-300">
        DATOS SIMULADOS — sustituye al detector de patrón en el dispositivo.
        Este sistema nunca analiza si una llamada o video es falso; solo
        reacciona a este patrón de comportamiento.
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="minutes_since_call">
            Minutos desde llamada desconocida
          </Label>
          <Input
            id="minutes_since_call"
            name="minutes_since_call"
            type="number"
            min="0"
            placeholder="3"
            required
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="minutes_since_app_open">
            Minutos desde app bancaria abierta
          </Label>
          <Input
            id="minutes_since_app_open"
            name="minutes_since_app_open"
            type="number"
            min="0"
            placeholder="1"
            required
          />
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="payee_label">Destinatario de la transferencia</Label>
        <Input
          id="payee_label"
          name="payee_label"
          placeholder="Ej. Cuenta desconocida"
          required
        />
      </div>

      <div className="flex items-center gap-2">
        <Checkbox id="payee_is_new" name="payee_is_new" defaultChecked />
        <Label htmlFor="payee_is_new" className="font-normal">
          Es un destinatario nuevo
        </Label>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="amount">Monto de la transferencia (MXN)</Label>
        <Input
          id="amount"
          name="amount"
          type="number"
          min="1"
          step="1"
          placeholder="8500"
          required
        />
      </div>

      {state.error && <p className="text-sm text-red-500">{state.error}</p>}
      {!state.error && state.submittedAt > 0 && state.matched && (
        <div className="flex flex-col gap-2">
          <p className="text-sm font-medium text-red-600">
            ⚠ Patrón coincide — evento guardado. Guion de alerta generado:
          </p>
          {state.scriptText && (
            <p className="rounded-md border bg-muted/50 p-3 text-sm italic">
              &ldquo;{state.scriptText}&rdquo;
            </p>
          )}
          {state.callStatus === "initiated" && (
            <p className="text-sm font-medium text-green-600">
              ☎ Llamada real iniciada al contacto familiar verificado.
            </p>
          )}
          {state.callStatus === "failed" && (
            <p className="text-sm text-amber-600">
              ☎ No se pudo colocar la llamada real
              {state.callError ? `: ${state.callError}` : "."}
            </p>
          )}
        </div>
      )}
      {!state.error && state.submittedAt > 0 && state.matched === false && (
        <p className="text-sm text-muted-foreground">
          Sin coincidencia — no se dispara ninguna alerta. Evento guardado
          como no coincidente.
        </p>
      )}

      <SubmitButton />
    </form>
  );
}
