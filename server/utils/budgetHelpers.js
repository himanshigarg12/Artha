import { budgets, transactions } from "../data/store.js";
import { budgetEvents } from "./budgetEvents.js";

export const currentMonth = () => new Date().toISOString().slice(0, 7);

// Total expenses for one category in one month ("YYYY-MM")
export const getSpent = (category, month) =>
  transactions
    .filter(
      (t) =>
        t.type === "expense" &&
        t.category.toLowerCase() === category.toLowerCase() &&
        t.date.startsWith(month)
    )
    .reduce((sum, t) => sum + t.amount, 0);

export const getStatus = (spent, limit) => {
  const percent = Math.round((spent / limit) * 100);
  let status = "safe";
  if (spent > limit) status = "exceeded";
  else if (percent >= 80) status = "near_limit";
  return { percent, status };
};

// Called after an expense is saved. Fires the event only at the moment
// spending crosses the limit, so you don't get an alert on every later expense.
export const checkBudget = (transaction) => {
  if (transaction.type !== "expense") return;

  const budget = budgets.find(
    (b) => b.category.toLowerCase() === transaction.category.toLowerCase()
  );
  if (!budget) return;

  const month = transaction.date.slice(0, 7);
  const spentAfter = getSpent(budget.category, month);
  const spentBefore = spentAfter - transaction.amount;

  if (spentBefore <= budget.limit && spentAfter > budget.limit) {
    budgetEvents.emit("budgetExceeded", {
      category: budget.category,
      spent: spentAfter,
      limit: budget.limit,
      month,
    });
  }
};