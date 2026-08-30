import { GoogleGenAI } from "@google/genai";

// --- Feature 6: LLM alert script generation ---
//
// SHADOW CLAUSE (docs/PACKET.md): the alert script may only describe the
// behavioral pattern that was detected — timing of a call, a bank-app open,
// a transfer amount, a new payee. It must never claim, suggest, or judge
// that any call, voice, or video was confirmed, verified, real, fake,
// cloned, synthetic, or AI-generated — this system never analyzes the
// content of the call, only the pattern around it. The system instruction
// below tells the model that directly; isSafeScript() is the backstop in
// code in case the model ignores it, so this guarantee never depends on the
// model behaving.
const FORBIDDEN_PATTERNS: RegExp[] = [
  /\bfals[oa]s?\b/i,
  /\bfake\b/i,
  /deepfake/i,
  /clonad[oa]/i,
  /sint[ée]tic[oa]/i,
  /generad[oa]\s+por\s+(ia|inteligencia artificial)/i,
  /\bconfirm(ad[oa]|amos)\b/i,
  /\bverific(ad[oa]|amos)\b/i,
];

export function isSafeScript(text: string): boolean {
  return !FORBIDDEN_PATTERNS.some((re) => re.test(text));
}

type EventDetails = {
  protectedPersonLabel: string;
  amount: number;
  payeeLabel: string;
};

function formatMXN(amount: number): string {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    maximumFractionDigits: 0,
  }).format(amount);
}

// Used whenever the model is unavailable, errors, or its output fails the
// safety check — always pattern language, never a claim about authenticity.
export function fallbackScript({
  protectedPersonLabel,
  amount,
  payeeLabel,
}: EventDetails): string {
  return (
    `Alerta de patrón para ${protectedPersonLabel}. ` +
    `Se detectó una llamada de un número desconocido, seguida de actividad en ` +
    `la aplicación bancaria, seguida de un intento de transferencia de ` +
    `${formatMXN(amount)} a un destinatario nuevo, "${payeeLabel}". ` +
    `Este sistema no analiza si la llamada fue real; solo detectó este patrón. ` +
    `Por favor comunícate directamente con ${protectedPersonLabel} para ` +
    `confirmar que está bien.`
  );
}

export async function generateAlertScript(
  details: EventDetails,
): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return fallbackScript(details);

  try {
    const ai = new GoogleGenAI({ apiKey });

    const systemInstruction =
      "Escribes guiones cortos y calmados para una llamada de voz automática " +
      "a un familiar, alertándolo de un patrón de comportamiento de riesgo " +
      "(posible fraude con voz clonada) detectado en el teléfono de un ser " +
      "querido. Reglas estrictas, sin excepción: (1) Nunca afirmes, sugieras " +
      "ni des a entender que una llamada, voz o video fue confirmado, " +
      "verificado, o juzgado como real, falso, clonado, sintético o generado " +
      "por IA — este sistema NUNCA analiza el contenido de la llamada, solo " +
      "reacciona a un patrón (llamada desconocida + apertura de app bancaria " +
      "+ transferencia). (2) Usa únicamente los datos del evento que se te " +
      "dan. (3) Pide a quien escucha que llame directamente a la persona " +
      "protegida para verificar que está bien — eso es una acción a tomar, " +
      "no una afirmación sobre si la llamada era falsa. (4) Máximo 3 " +
      "oraciones cortas, español neutro, tono calmado y directo, apto para " +
      "leerse en voz alta por texto a voz.";

    const input =
      `Persona protegida: ${details.protectedPersonLabel}. ` +
      `Patrón detectado: llamada de número desconocido, seguida de actividad ` +
      `en la app bancaria, seguida de un intento de transferencia de ` +
      `${formatMXN(details.amount)} a un destinatario nuevo ` +
      `("${details.payeeLabel}"). Escribe el guion de la llamada de alerta.`;

    const interaction = await ai.interactions.create({
      model: "gemini-3.7-flash",
      system_instruction: systemInstruction,
      input,
    });

    const text = (interaction.output_text ?? "").trim();
    if (text && isSafeScript(text)) return text;
  } catch {
    // Network/API error — fall through to the safe canned script below.
  }

  return fallbackScript(details);
}
