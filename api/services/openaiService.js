// api/services/openaiService.js
import OpenAI from "openai";

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

function assertOpenAIKey() {
  if (!OPENAI_API_KEY) {
    throw new Error(
      "OPENAI_API_KEY no configurada. Configura OPENAI_API_KEY en Render (Environment)."
    );
  }
}

export async function generateScriptWithOpenAI(prompt, options = {}) {
  assertOpenAIKey();

  const client = new OpenAI({ apiKey: OPENAI_API_KEY });

  const model = options.model || process.env.OPENAI_MODEL || "gpt-4o-mini";

  const resp = await client.chat.completions.create({
    model,
    messages: [
      {
        role: "system",
        content:
          options.system ||
          "Eres un experto en guiones virales para redes sociales. Responde en español.",
      },
      { role: "user", content: prompt },
    ],
    temperature: options.temperature ?? 0.7,
  });

  return resp.choices?.[0]?.message?.content?.trim() || "";
}

export async function conversationWithOpenAI(messages, options = {}) {
  assertOpenAIKey();

  const client = new OpenAI({ apiKey: OPENAI_API_KEY });

  const model = options.model || process.env.OPENAI_MODEL || "gpt-4o-mini";

  const resp = await client.chat.completions.create({
    model,
    messages,
    temperature: options.temperature ?? 0.7,
  });

  return resp.choices?.[0]?.message?.content?.trim() || "";
}
