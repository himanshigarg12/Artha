import { randomUUID } from "crypto";
import { accounts, transactions } from "../data/store.js";
import { checkBudget } from "../utils/budgetHelpers.js";

const TYPES = ["income", "expense", "transfer"];
const LIABILITIES = ["credit", "loan"];

const httpError = (status, message) => {
  const err = new Error(message);
  err.status = status;
  return err;
};

const findAccount = (id) => accounts.find((a) => a.id === id);

// flow "in"  = money coming into the account
// flow "out" = money leaving the account
// For credit/loan accounts the balance is the amount owed, so it moves the opposite way
export const applyFlow = (account, flow, amount) => {
  const sign = flow === "in" ? 1 : -1;
  const isLiability = LIABILITIES.includes(account.type);
  account.balance += isLiability ? -sign * amount : sign * amount;
};

export const getTransactions = (req, res) => {
  const { from, to, category, account, type } = req.query;

  let result = [...transactions];

  if (from) result = result.filter((t) => new Date(t.date) >= new Date(from));
  if (to) result = result.filter((t) => new Date(t.date) <= new Date(to));
  if (category) result = result.filter((t) => t.category.toLowerCase() === category.toLowerCase());
  if (type) result = result.filter((t) => t.type === type);
  if (account) {
    result = result.filter((t) => t.account === account || t.toAccount === account);
  }

  result.sort((a, b) => new Date(b.date) - new Date(a.date));
  res.json(result);
};

export const getTransactionById = (req, res, next) => {
  const transaction = transactions.find((t) => t.id === req.params.id);
  if (!transaction) return next(httpError(404, "Transaction not found"));
  res.json(transaction);
};

export const createTransaction = (req, res, next) => {
  const { type, amount, category, account, toAccount, date, note = "" } = req.body;

  if (!TYPES.includes(type)) {
    return next(httpError(400, `Type must be one of: ${TYPES.join(", ")}`));
  }
  if (typeof amount !== "number" || amount <= 0) {
    return next(httpError(400, "Amount must be a number greater than 0"));
  }

  const source = findAccount(account);
  if (!source) return next(httpError(404, "Account not found"));

  const when = date ? new Date(date) : new Date();
  if (isNaN(when.getTime())) return next(httpError(400, "Invalid date"));

  let target = null;

  if (type === "transfer") {
    target = findAccount(toAccount);
    if (!target) return next(httpError(404, "Destination account not found"));
    if (target.id === source.id) {
      return next(httpError(400, "Cannot transfer to the same account"));
    }
    applyFlow(source, "out", amount);
    applyFlow(target, "in", amount);
  } else {
    if (!category || !category.trim()) {
      return next(httpError(400, "Category is required for income and expense"));
    }
    applyFlow(source, type === "income" ? "in" : "out", amount);
  }

  const transaction = {
    id: randomUUID(),
    type,
    amount,
    category: type === "transfer" ? "Transfer" : category.trim(),
    account: source.id,
    toAccount: target ? target.id : null,
    date: when.toISOString().slice(0, 10),
    note,
  };

  transactions.push(transaction);
  checkBudget(transaction);
  res.status(201).json(transaction);
};

// Only category, note and date can be edited.
// To change an amount or account, delete the transaction and add a new one.
export const updateTransaction = (req, res, next) => {
  const transaction = transactions.find((t) => t.id === req.params.id);
  if (!transaction) return next(httpError(404, "Transaction not found"));

  const { category, note, date } = req.body;

  if (category !== undefined && transaction.type !== "transfer") {
    transaction.category = category.trim();
  }
  if (note !== undefined) transaction.note = note;
  if (date !== undefined) {
    const when = new Date(date);
    if (isNaN(when.getTime())) return next(httpError(400, "Invalid date"));
    transaction.date = when.toISOString().slice(0, 10);
  }

  res.json(transaction);
};

export const deleteTransaction = (req, res, next) => {
  const index = transactions.findIndex((t) => t.id === req.params.id);
  if (index === -1) return next(httpError(404, "Transaction not found"));

  const [removed] = transactions.splice(index, 1);

  // Reverse the effect on balances
  const source = findAccount(removed.account);
  const target = findAccount(removed.toAccount);

  if (removed.type === "transfer") {
    if (source) applyFlow(source, "in", removed.amount);
    if (target) applyFlow(target, "out", removed.amount);
  } else if (source) {
    applyFlow(source, removed.type === "income" ? "out" : "in", removed.amount);
  }

  res.json({ message: "Transaction deleted", transaction: removed });
};