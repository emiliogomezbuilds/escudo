"use client";

import { useActionState, useEffect, useRef } from "react";
import { useFormStatus } from "react-dom";

import { addFamilyContact } from "@/app/dashboard/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type FormState = { error?: string; successAt: number };

const initialState: FormState = { error: undefined, successAt: 0 };

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} className="w-fit">
      {pending ? "Guardando…" : "Agregar contacto"}
    </Button>
  );
}

export function FamilyContactForm() {
  const formRef = useRef<HTMLFormElement>(null);

  const [state, formAction] = useActionState(
    async (prev: FormState, formData: FormData): Promise<FormState> => {
      const result = await addFamilyContact(formData);
      if (result?.error) return { error: result.error, successAt: prev.successAt };
      return { error: undefined, successAt: Date.now() };
    },
    initialState,
  );

  useEffect(() => {
    if (state.successAt) formRef.current?.reset();
  }, [state.successAt]);

  return (
    <form ref={formRef} action={formAction} className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor="name">Nombre del contacto</Label>
        <Input id="name" name="name" placeholder="Ej. Ana Gómez" required />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="phone">Teléfono (formato E.164, ej. +525512345678)</Label>
        <Input id="phone" name="phone" placeholder="+525512345678" required />
      </div>
      {state.error && <p className="text-sm text-red-500">{state.error}</p>}
      {!state.error && state.successAt > 0 && (
        <p className="text-sm text-green-600">Contacto agregado.</p>
      )}
      <SubmitButton />
    </form>
  );
}
