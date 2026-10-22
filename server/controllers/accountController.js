import { randomUUID } from "crypto";
import { accounts } from "../data/store.js";

const ACCOUNT_TYPES = ["cash", "credit", "investment", "loan"];

const httpError = (status, message) => {
  const err = new Error(message);
  err.status = status;
  return err;
};

export const getAccounts = (req, res) => {
  res.json(accounts);
};

export const getAccountById = (req, res, next) => {
  const account = accounts.find((a) => a.id === req.params.id);
  if (!account) return next(httpError(404, "Account not found"));
  res.json(account);
};

export const createAccount = (req, res, next) => {
  const { name, type, balance = 0, currency = "INR" } = req.body;

  if (!name || !name.trim()) return next(httpError(400, "Name is required"));
  if (!ACCOUNT_TYPES.includes(type)) {
    return next(httpError(400, `Type must be one of: ${ACCOUNT_TYPES.join(", ")}`));
  }
  if (typeof balance !== "number") return next(httpError(400, "Balance must be a number"));

  const account = { id: randomUUID(), name: name.trim(), type, balance, currency };
  accounts.push(account);
  res.status(201).json(account);
};

export const updateAccount = (req, res, next) => {
  const account = accounts.find((a) => a.id === req.params.id);
  if (!account) return next(httpError(404, "Account not found"));

  const { name, type, balance, currency } = req.body;

  if (type !== undefined && !ACCOUNT_TYPES.includes(type)) {
    return next(httpError(400, `Type must be one of: ${ACCOUNT_TYPES.join(", ")}`));
  }
  if (balance !== undefined && typeof balance !== "number") {
    return next(httpError(400, "Balance must be a number"));
  }

  if (name !== undefined) account.name = name.trim();
  if (type !== undefined) account.type = type;
  if (balance !== undefined) account.balance = balance;
  if (currency !== undefined) account.currency = currency;

  res.json(account);
};

export const deleteAccount = (req, res, next) => {
  const index = accounts.findIndex((a) => a.id === req.params.id);
  if (index === -1) return next(httpError(404, "Account not found"));

  const [removed] = accounts.splice(index, 1);
  res.json({ message: "Account deleted", account: removed });
};