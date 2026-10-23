const BASE_URL = "https://generativelanguage.googleapis.com/v1beta/models";

const httpError = (status, message) => {
  const err = new Error(message);
  err.status = status;
  return err;
};

// history: [{ role: "user" | "assistant", content: "..." }]
export const askGemini = async ({ systemPrompt, history, message }) => {
  // Read the environment at call time: dotenv.config() in server.js runs
  // after the imports are loaded, so reading it earlier would give undefined.
  const apiKey = process.env.GEMINI_API_KEY;
  const model = process.env.GEMINI_MODEL || "gemini-3.8-flash";
  const timeoutMs = Number(process.env.GEMINI_TIMEOUT_MS) || 60000;

  if (!apiKey) {
    throw httpError(503, "AI assistant is not configured. Add GEMINI_API_KEY to server/.env");
  }

  const contents = [
    ...history.map((h) => ({
      role: h.role === "assistant" ? "model" : "user",
      parts: [{ text: h.content }],
    })),
    { role: "user", parts: [{ text: message }] },
  ];

  // Stop waiting if Gemini takes too long. The timer covers both the
  // request and reading the response body.
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const startedAt = Date.now();

  let response;
  let data;
  try {
    response = await fetch(`${BASE_URL}/${model}:generateContent`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey,
      },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemPrompt }] },
        contents,
        generationConfig: { temperature: 0.4, maxOutputTokens: 2048 },
      }),
      signal: controller.signal,
    });

    data = await response.json().catch(() => ({}));
  } catch (err) {
    if (err.name === "AbortError") {
      console.error(`Gemini timed out after ${timeoutMs} ms (model: ${model})`);
      throw httpError(504, "The AI took too long to respond. Please try again.");
    }
    // err.cause usually holds the real reason, e.g. ENOTFOUND or ETIMEDOUT
    console.error("Gemini request failed:", err.message, err.cause?.code || err.cause || "");
    throw httpError(502, "Could not reach the AI service.");
  } finally {
    clearTimeout(timer);
  }

  console.log(
    `Gemini responded: status ${response.status}, ${Date.now() - startedAt} ms, model ${model}`
  );

  if (!response.ok) {
    const detail = data?.error?.message || "Unknown error";
    console.error(`Gemini error ${response.status}: ${detail}`);
    if (response.status === 429) {
      throw httpError(429, "AI usage limit reached. Wait a minute and try again.");
    }
    throw httpError(502, `AI service error (${response.status}). Check the server terminal for details.`);
  }

  const candidate = data.candidates?.[0];
  const reply = candidate?.content?.parts
    ?.filter((p) => p.text && !p.thought)
    .map((p) => p.text)
    .join("")
    .trim();

  if (!reply) {
    const reason = data.promptFeedback?.blockReason || candidate?.finishReason || "no content";
    console.error(`Gemini returned no text (${reason})`);
    throw httpError(502, `The AI returned no answer (${reason}). Try rephrasing your question.`);
  }

  return { reply, model };
};