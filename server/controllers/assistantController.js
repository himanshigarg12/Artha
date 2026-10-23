import { buildFinanceContext } from "../utils/financeContext.js";
import { askGemini } from "../services/gemini.js";

const MAX_MESSAGE_LENGTH = 1000;
const MAX_HISTORY = 10;

const httpError = (status, message) => {
  const err = new Error(message);
  err.status = status;
  return err;
};

const INSTRUCTIONS = `You are Artha, a friendly personal finance assistant inside a money-management app.
Rules:
- Answer using ONLY the financial data given below. Never invent numbers, accounts or transactions.
- If the data does not contain what is needed, say so plainly and say what is missing.
- Amounts are in Indian Rupees. Write them as Rs. with Indian digit grouping, for example Rs. 1,25,000.
- Keep answers short and clear. Show the calculation when you add or compare numbers.
- For questions like "can I afford X", compare it with net worth, savings and budgets, and be honest about the risks.
- You give general information, not professional financial advice. Mention this briefly only when someone asks for investment or loan decisions.
- Only answer questions about the user's finances or basic money topics. Politely decline anything else.`;

export const chat = async (req, res, next) => {
  try {
    const { message, history = [] } = req.body;

    if (typeof message !== "string" || !message.trim()) {
      throw httpError(400, "message is required");
    }
    if (message.length > MAX_MESSAGE_LENGTH) {
      throw httpError(400, `message must be at most ${MAX_MESSAGE_LENGTH} characters`);
    }
    if (!Array.isArray(history)) {
      throw httpError(400, "history must be an array");
    }

    // Keep only valid turns and the most recent ones
    const cleanHistory = history
      .filter(
        (h) =>
          h &&
          ["user", "assistant"].includes(h.role) &&
          typeof h.content === "string" &&
          h.content.trim()
      )
      .slice(-MAX_HISTORY)
      .map((h) => ({ role: h.role, content: h.content.slice(0, MAX_MESSAGE_LENGTH * 3) }));

    // Gemini expects the conversation to begin with a user turn
    while (cleanHistory.length && cleanHistory[0].role !== "user") cleanHistory.shift();

    const systemPrompt = `${INSTRUCTIONS}\n\n--- USER'S FINANCIAL DATA ---\n${buildFinanceContext()}`;

    const { reply, model } = await askGemini({
      systemPrompt,
      history: cleanHistory,
      message: message.trim(),
    });

    res.json({ reply, model });
  } catch (err) {
    next(err);
  }
};

// Shows exactly what the AI is given. Useful for testing without an API key.
export const getContext = (req, res) => {
  res.json({ context: buildFinanceContext() });
};

// Starter questions for the chat panel
export const getSuggestions = (req, res) => {
  res.json([
    "Where did I spend the most in the last 30 days?",
    "How is my budget doing this month?",
    "What is my net worth?",
    "How are my investments performing?",
    "Can I afford a Rs. 50,000 phone?",
  ]);
};