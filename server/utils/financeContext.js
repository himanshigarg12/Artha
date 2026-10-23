import { accounts, transactions, budgets, holdings } from "../data/store.js";
import { getSpent, getStatus } from "./budgetHelpers.js";

const LIABILITIES = ["credit", "loan"];

const inr = (n) =>
  `Rs. ${Number(n).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;

const toISO = (d) => d.toISOString().slice(0, 10);

const daysAgo = (n) => {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - n);
  return toISO(d);
};

const totalsByCategory = (list) => {
  const map = new Map();
  for (const t of list) map.set(t.category, (map.get(t.category) || 0) + t.amount);
  return [...map.entries()].sort((a, b) => b[1] - a[1]);
};

export const buildFinanceContext = () => {
  const today = toISO(new Date());
  const from = daysAgo(29); // last 30 days including today
  const month = today.slice(0, 7);
  const lines = [];

  lines.push(`Today's date: ${today}`);
  lines.push("Currency: Indian Rupees (Rs.)");

  // Accounts and net worth
  lines.push("", "ACCOUNTS:");
  for (const a of accounts) {
    const owed = LIABILITIES.includes(a.type) ? " (amount owed)" : "";
    lines.push(`- ${a.name} [${a.type}]: ${inr(a.balance)}${owed}`);
  }
  const assets = accounts
    .filter((a) => !LIABILITIES.includes(a.type))
    .reduce((s, a) => s + a.balance, 0);
  const owedTotal = accounts
    .filter((a) => LIABILITIES.includes(a.type))
    .reduce((s, a) => s + a.balance, 0);
  lines.push(
    `Total assets: ${inr(assets)}. Total owed: ${inr(owedTotal)}. Net worth: ${inr(assets - owedTotal)}.`
  );

  // Last 30 days of income and spending (transfers are not income or spending)
  const recent = transactions.filter(
    (t) => t.type !== "transfer" && t.date >= from && t.date <= today
  );
  const income = recent.filter((t) => t.type === "income");
  const expense = recent.filter((t) => t.type === "expense");
  const totalIncome = income.reduce((s, t) => s + t.amount, 0);
  const totalExpense = expense.reduce((s, t) => s + t.amount, 0);

  lines.push("", `LAST 30 DAYS (${from} to ${today}):`);
  lines.push(`Income: ${inr(totalIncome)}. Spending: ${inr(totalExpense)}. Saved: ${inr(totalIncome - totalExpense)}.`);

  const spendingRows = totalsByCategory(expense);
  lines.push(
    spendingRows.length
      ? "Spending by category: " + spendingRows.map(([c, v]) => `${c} ${inr(v)}`).join(", ")
      : "Spending by category: none"
  );
  const incomeRows = totalsByCategory(income);
  lines.push(
    incomeRows.length
      ? "Income by source: " + incomeRows.map(([c, v]) => `${c} ${inr(v)}`).join(", ")
      : "Income by source: none"
  );

  // Budgets for the current month
  lines.push("", `BUDGETS (${month}):`);
  if (budgets.length === 0) lines.push("- none set");
  for (const b of budgets) {
    const spent = getSpent(b.category, month);
    const { percent, status } = getStatus(spent, b.limit);
    lines.push(`- ${b.category}: spent ${inr(spent)} of ${inr(b.limit)} (${percent}%, ${status})`);
  }

  // Investments
  lines.push("", "INVESTMENTS:");
  if (holdings.length === 0) lines.push("- none");
  let invested = 0;
  let value = 0;
  for (const h of holdings) {
    const cost = h.quantity * h.buyPrice;
    const current = h.quantity * h.currentPrice;
    invested += cost;
    value += current;
    const gainPct = cost > 0 ? (((current - cost) / cost) * 100).toFixed(2) : "0.00";
    lines.push(
      `- ${h.symbol} (${h.assetType}): ${h.quantity} units, invested ${inr(cost)}, now ${inr(current)} (${gainPct}%)`
    );
  }
  if (holdings.length) {
    lines.push(`Portfolio: invested ${inr(invested)}, current value ${inr(value)}, gain ${inr(value - invested)}.`);
  }

  // Latest transactions
  lines.push("", "LATEST TRANSACTIONS (newest first):");
  const latest = [...transactions]
    .reverse()
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 10);
  if (latest.length === 0) lines.push("- none");
  for (const t of latest) {
    lines.push(`- ${t.date} ${t.type} ${inr(t.amount)} ${t.category}${t.note ? ` (${t.note})` : ""}`);
  }

  return lines.join("\n");
};