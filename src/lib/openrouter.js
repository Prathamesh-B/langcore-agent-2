// src/lib/openrouter.js
import axios from "axios";

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

export async function callOpenRouter(messages, model = "gpt-4o-mini") {
  if (!process.env.OPENROUTER_API_KEY) {
    throw new Error("OPENROUTER_API_KEY not set");
  }

  const payload = {
    model,
    messages,
    // We ask for non-streaming responses for simplicity.
    max_tokens: 800
  };

  const res = await axios.post(OPENROUTER_URL, payload, {
    headers: {
      Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
      "Content-Type": "application/json"
    }
  });

  // OpenRouter chat response structure may vary; adapt if needed.
  const choice = res.data?.choices?.[0];
  if (!choice) throw new Error("No choice from OpenRouter");

  // return the assistant content text (string)
  // Some providers place it at choice.message.content or choice.delta
  const content = choice.message?.content ?? choice.text ?? JSON.stringify(choice);
  return content;
}
