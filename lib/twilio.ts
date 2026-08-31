import twilio from "twilio";

// --- Feature 7: Twilio Voice call placement ---
//
// Places a real outbound call and reads the already-generated alert script
// aloud via TTS (Spanish). This module never decides *whether* to call —
// that's the pattern-match rule in app/dashboard/actions.ts — it only places
// the call once told to. Trial Twilio accounts can only call numbers that
// have been verified directly with Twilio (Console → Phone Numbers →
// Verified Caller IDs) — that's separate from this app's own "Confirmar
// número" flag, which only tracks the family admin's own confirmation.
export type PlaceCallResult =
  | { ok: true; callSid: string; status: string }
  | { ok: false; error: string };

export async function placeAlertCall(
  toNumber: string,
  scriptText: string,
): Promise<PlaceCallResult> {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const fromNumber = process.env.TWILIO_PHONE_NUMBER;

  if (!accountSid || !authToken || !fromNumber) {
    return {
      ok: false,
      error: "Twilio no está configurado (faltan variables de entorno).",
    };
  }

  try {
    const client = twilio(accountSid, authToken);

    const voiceResponse = new twilio.twiml.VoiceResponse();
    voiceResponse.say({ language: "es-MX" }, scriptText);

    const call = await client.calls.create({
      to: toNumber,
      from: fromNumber,
      twiml: voiceResponse.toString(),
    });

    return { ok: true, callSid: call.sid, status: call.status };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Error desconocido de Twilio.";
    return { ok: false, error: message };
  }
}
