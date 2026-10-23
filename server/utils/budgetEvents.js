import { EventEmitter } from "events";
import { randomUUID } from "crypto";
import { alerts } from "../data/store.js";

export const budgetEvents = new EventEmitter();

budgetEvents.on("budgetExceeded", ({ category, spent, limit, month }) => {
  const message = `Budget exceeded for ${category}: spent ${spent} of ${limit}`;
  console.log(message);

  alerts.push({
    id: randomUUID(),
    category,
    spent,
    limit,
    month,
    message,
    createdAt: new Date().toISOString(),
  });
});