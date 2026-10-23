import { accounts, transactions } from "../data/store.js";

const RANGES = { "7d": 7, "30d": 30, "90d": 90, "1y": 365 };
const LIABILITIES = ["credit", "loan"];

const httpError = (status, message) => {
  const err = new Error(message);
  err.status = status;
  return err;
};

const round = (n) => Math.round(n * 100) / 100;
const toISO = (d) => d.toISOString().slice(0, 10);

const addDays = (iso, n) => {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return toISO(d);
};

// "30d" means the last 30 days including today.
// The previous period is the same number of days right before it.
const resolveRange = (query) => {
  const key = query.range || "30d";
  if (!Object.hasOwn(RANGES, key)) {
    throw httpError(400, `range must be one of: ${Object.keys(RANGES).join(", ")}`);
  }
  const days = RANGES[key];
  const to = toISO(new Date());
  const from = addDays(to, -(days - 1));
  const prevTo = addDays(from, -1);
  const prevFrom = addDays(prevTo, -(days - 1));
  return { key, from, to, prevFrom, prevTo };
};

// Income and expense only (transfers are left out)
const flows = (from, to) =>
  transactions.filter((t) => t.type !== "transfer" && t.date >= from && t.date <= to);

const totalOf = (list, type) =>
  list.filter((t) => t.type === type).reduce((sum, t) => sum + t.amount, 0);

const changePercent = (current, previous) =>
  previous === 0 ? null : round(((current - previous) / previous) * 100);

const savingsRate = (income, expense) =>
  income > 0 ? round(((income - expense) / income) * 100) : 0;

const sumByCategory = (list) => {
  const map = new Map();
  for (const t of list) map.set(t.category, (map.get(t.category) || 0) + t.amount);
  return [...map.entries()]
    .map(([name, value]) => ({ name, value: round(value) }))
    .sort((a, b) => b.value - a.value);
};

const buildSummary = (range) => {
  const current = flows(range.from, range.to);
  const previous = flows(range.prevFrom, range.prevTo);

  const income = totalOf(current, "income");
  const expense = totalOf(current, "expense");
  const prevIncome = totalOf(previous, "income");
  const prevExpense = totalOf(previous, "expense");

  // Assets minus what you owe (credit cards and loans store the amount owed)
  const totalAssets = accounts
    .filter((a) => !LIABILITIES.includes(a.type))
    .reduce((sum, a) => sum + a.balance, 0);
  const totalLiabilities = accounts
    .filter((a) => LIABILITIES.includes(a.type))
    .reduce((sum, a) => sum + a.balance, 0);

  return {
    range: range.key,
    from: range.from,
    to: range.to,
    netWorth: {
      value: round(totalAssets - totalLiabilities),
      totalAssets: round(totalAssets),
      totalLiabilities: round(totalLiabilities),
    },
    income: {
      value: round(income),
      previous: round(prevIncome),
      changePercent: changePercent(income, prevIncome),
    },
    expense: {
      value: round(expense),
      previous: round(prevExpense),
      changePercent: changePercent(expense, prevExpense),
    },
    savings: {
      net: round(income - expense),
      rate: savingsRate(income, expense),
      previousRate: savingsRate(prevIncome, prevExpense),
    },
  };
};

// Sankey data: income sources -> Cash Flow -> expense categories (+ surplus).
// If you spent more than you earned, a "Deficit" source balances the chart.
const buildCashflow = (range) => {
  const list = flows(range.from, range.to);
  const incomeItems = sumByCategory(list.filter((t) => t.type === "income"));
  const expenseItems = sumByCategory(list.filter((t) => t.type === "expense"));

  const totalIncome = incomeItems.reduce((s, i) => s + i.value, 0);
  const totalExpense = expenseItems.reduce((s, i) => s + i.value, 0);
  const net = totalIncome - totalExpense;

  const base = {
    range: range.key,
    from: range.from,
    to: range.to,
    totalIncome: round(totalIncome),
    totalExpense: round(totalExpense),
    net: round(net),
  };

  if (totalIncome === 0 && totalExpense === 0) {
    return { ...base, nodes: [], links: [] };
  }

  const nodes = [];
  const links = [];

  for (const item of incomeItems) {
    const id = `income:${item.name}`;
    nodes.push({ id, name: item.name, type: "income" });
    links.push({ source: id, target: "hub", value: item.value });
  }

  if (net < 0) {
    nodes.push({ id: "deficit", name: "Deficit", type: "deficit" });
    links.push({ source: "deficit", target: "hub", value: round(-net) });
  }

  nodes.push({ id: "hub", name: "Cash Flow", type: "hub" });

  for (const item of expenseItems) {
    const id = `expense:${item.name}`;
    nodes.push({ id, name: item.name, type: "expense" });
    links.push({ source: "hub", target: id, value: item.value });
  }

  if (net > 0) {
    nodes.push({ id: "surplus", name: "Surplus", type: "surplus" });
    links.push({ source: "hub", target: "surplus", value: round(net) });
  }

  return { ...base, nodes, links };
};

const buildRecent = (limitParam) => {
  const limit = limitParam === undefined ? 5 : Number(limitParam);
  if (!Number.isInteger(limit) || limit < 1 || limit > 50) {
    throw httpError(400, "limit must be a whole number between 1 and 50");
  }
  // Newest date first; for the same date, the most recently added first
  return [...transactions]
    .reverse()
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, limit);
};

// GET /api/dashboard?range=30d&limit=5   (everything for the home screen)
export const getDashboard = (req, res) => {
  const range = resolveRange(req.query);
  res.json({
    summary: buildSummary(range),
    cashflow: buildCashflow(range),
    recent: buildRecent(req.query.limit),
  });
};

export const getSummary = (req, res) => res.json(buildSummary(resolveRange(req.query)));
export const getCashflow = (req, res) => res.json(buildCashflow(resolveRange(req.query)));
export const getRecent = (req, res) => res.json(buildRecent(req.query.limit));