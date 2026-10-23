import { transactions } from "../data/store.js";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const httpError = (status, message) => {
  const err = new Error(message);
  err.status = status;
  return err;
};

const round = (n) => Math.round(n * 100) / 100;

const isValidDate = (s) =>
  DATE_RE.test(s) &&
  !isNaN(new Date(s).getTime()) &&
  new Date(s).toISOString().slice(0, 10) === s;

// Defaults to the current month so far (1st of the month up to today)
const resolveRange = (query) => {
  const today = new Date().toISOString().slice(0, 10);
  const from = query.from || `${today.slice(0, 7)}-01`;
  const to = query.to || today;

  if (!isValidDate(from) || !isValidDate(to)) {
    throw httpError(400, "from and to must be valid dates in YYYY-MM-DD format");
  }
  if (from > to) throw httpError(400, "from must not be after to");

  return { from, to };
};

// Transactions are stored with dates as "YYYY-MM-DD", so plain string
// comparison works for date ranges. Transfers are left out.
const inRange = (from, to) =>
  transactions.filter((t) => t.type !== "transfer" && t.date >= from && t.date <= to);

const sumAmount = (list) => list.reduce((sum, t) => sum + t.amount, 0);

const groupByCategory = (list) => {
  const total = sumAmount(list);
  const groups = new Map();

  for (const t of list) {
    const entry = groups.get(t.category) || { category: t.category, amount: 0, count: 0 };
    entry.amount += t.amount;
    entry.count += 1;
    groups.set(t.category, entry);
  }

  return [...groups.values()]
    .map((g) => ({
      category: g.category,
      amount: round(g.amount),
      count: g.count,
      percent: total > 0 ? round((g.amount / total) * 100) : 0,
    }))
    .sort((a, b) => b.amount - a.amount);
};

// GET /api/reports?from=YYYY-MM-DD&to=YYYY-MM-DD
export const getReport = (req, res) => {
  const { from, to } = resolveRange(req.query);
  const list = inRange(from, to);

  const incomeList = list.filter((t) => t.type === "income");
  const expenseList = list.filter((t) => t.type === "expense");

  const totalIncome = sumAmount(incomeList);
  const totalExpense = sumAmount(expenseList);
  const net = totalIncome - totalExpense;

  res.json({
    from,
    to,
    summary: {
      totalIncome: round(totalIncome),
      totalExpense: round(totalExpense),
      net: round(net),
      savingsRate: totalIncome > 0 ? round((net / totalIncome) * 100) : 0,
      transactionCount: list.length,
    },
    expensesByCategory: groupByCategory(expenseList),
    incomeByCategory: groupByCategory(incomeList),
  });
};

// GET /api/reports/monthly?from=YYYY-MM-DD&to=YYYY-MM-DD
export const getMonthlyReport = (req, res) => {
  const { from, to } = resolveRange(req.query);
  const months = new Map();

  for (const t of inRange(from, to)) {
    const key = t.date.slice(0, 7);
    const entry = months.get(key) || { month: key, income: 0, expense: 0 };
    if (t.type === "income") entry.income += t.amount;
    else entry.expense += t.amount;
    months.set(key, entry);
  }

  const result = [...months.values()]
    .sort((a, b) => a.month.localeCompare(b.month))
    .map((m) => ({
      month: m.month,
      income: round(m.income),
      expense: round(m.expense),
      net: round(m.income - m.expense),
    }));

  res.json({ from, to, months: result });
};