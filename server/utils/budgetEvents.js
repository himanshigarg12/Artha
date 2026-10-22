import { EventEmitter } from "events";

export const budgetEvents = new EventEmitter();

budgetEvents.on("budgetExceeded", ({ category, spent, limit }) => {
  console.log(`Budget exceeded for ${category}: ${spent}/${limit}`);
});