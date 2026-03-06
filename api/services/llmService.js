// api/services/llmService.js
import {
  generateScript as generateScriptWithAnthropic,
  conversationWithClaude,
} from "./anthropicService.js";

import {
  generateScriptWithOpenAI,
  conversationWithOpenAI,
} from "./openaiService.js";

function pickProvider() {
  // Si quieres forzarlo por env:
  // LLM_PROVIDER=anthropic | openai
  const forced = (process.env.LLM_PROVIDER || "").toLowerCase().trim();
  if (forced === "anthropic" || forced === "openai") return forced;

  // Default inteligente: si hay key de Anthropic, úsala; si no, OpenAI.
  return process.env.ANTHROPIC_API_KEY ? "anthropic" : "openai";
}

export async function generateScript(prompt, options = {}) {
  const provider = pickProvider();

  if (provider === "anthropic") {
    return generateScriptWithAnthropic(prompt, options);
  }
  return generateScriptWithOpenAI(prompt, options);
}

export async function conversation(messages, options = {}) {
  const provider = pickProvider();

  if (provider === "anthropic") {
    return conversationWithClaude(messages, options);
  }
  return conversationWithOpenAI(messages, options);
}
