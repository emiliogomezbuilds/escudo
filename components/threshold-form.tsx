"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { saveThreshold } from "@/app/dashboard/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type FormState = { error?: string; success: boolean };

const initialState: FormState = { error: undefined, success: false };

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} className="w-fit">
      {pending ? "Guardando…" : "Guardar umbral"}
    </Button>
  );
}

export function ThresholdForm({
  defaultMinAmount,
  defaultLabel,
}: {
  defaultMinAmount?: number;
  defaultLabel?: string;
}) {
  const [state, formAction] = useActionState(
    async (_prev: FormState, formData: FormData): Promise<FormState> => {
      const result = await saveThreshold(formData);
      if (result?.error) return { error: result.error, success: false };
      return { error: undefined, success: true };
    },
    initialState,
  );

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor="protected_person_label">Persona protegida</Label>
        <Input
          id="protected_person_label"
          name="protected_person_label"
          placeholder="Ej. Doña Mari"
          defaultValue={defaultLabel}
          required
        />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="min_amount">
          Umbral de alerta (MXN, transferencia a destinatario nuevo)
        </Label>
        <Input
          id="min_amount"
          name="min_amount"
          type="number"
          min="1"
          step="1"
          placeholder="3000"
          defaultValue={defaultMinAmount}
          required
        />
      </div>
      {state.error && <p className="text-sm text-red-500">{state.error}</p>}
      {!state.error && state.success && (
        <p className="text-sm text-green-600">Umbral guardado.</p>
      )}
      <SubmitButton />
    </form>
  );
}
