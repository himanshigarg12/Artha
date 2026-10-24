import { randomUUID } from "crypto";
import { accounts, transactions } from "../data/store.js";
import { applyFlow } from "./transactionController.js";
import { checkBudget } from "../utils/budgetHelpers.js";
import { parseCsv, bufferToText } from "../utils/csv.js";
import { isValidDate } from "../utils/validators.js";

const TYPES = ["income", "expense", "transfer"];
const REQUIRED_COLUMNS = ["date", "type", "amount", "category", "account"];
const MAX_ROWS = 1000;
const MAX_ERRORS_SHOWN = 20;

const httpError = (status, message) => {
  const err = new Error(message);
  err.status = status;
  return err;
};

const round = (n) => Math.round(n * 100) / 100;

// "toAccount", "to_account" and "To Account" all become "toaccount"
const normalize = (s) => s.toLowerCase().replace(/[^a-z]/g, "");

// Accounts can be given by id or by name
const findAccount = (ref) => {
  const needle = ref.trim().toLowerCase();
  const byId = accounts.find((a) => a.id.toLowerCase() === needle);
  if (byId) return { account: byId };

  const byName = accounts.filter((a) => a.name.toLowerCase() === needle);
  if (byName.length === 1) return { account: byName[0] };
  if (byName.length > 1) {
    return { error: `Several accounts are named "${ref}". Use the account id instead` };
  }
  return { error: `Account "${ref}" not found` };
};

// Checks one row. Returns { value } when it is valid or { error } when it is not.
const checkRow = (cells, col, rowNumber) => {
  const cell = (name) => (col[name] === undefined ? "" : (cells[col[name]] ?? "").trim());
  const fail = (message) => ({ error: { row: rowNumber, message } });

  const date = cell("date");
  const type = cell("type").toLowerCase();
  const rawAmount = cell("amount");
  const amount = Number(rawAmount.replace(/,/g, ""));

  if (!isValidDate(date)) return fail("date must be a real date in YYYY-MM-DD format");
  if (!TYPES.includes(type)) return fail(`type must be one of: ${TYPES.join(", ")}`);
  if (!rawAmount || !Number.isFinite(amount) || amount <= 0) {
    return fail("amount must be a number greater than 0");
  }

  const source = findAccount(cell("account"));
  if (source.error) return fail(source.error);

  let target = null;
  if (type === "transfer") {
    const found = findAccount(cell("toaccount"));
    if (found.error) return fail(`toAccount: ${found.error}`);
    if (found.account.id === source.account.id) return fail("cannot transfer to the same account");
    target = found.account;
  } else if (!cell("category")) {
    return fail("category is required for income and expense");
  }

  return {
    value: {
      date,
      type,
      amount,
      category: type === "transfer" ? "Transfer" : cell("category"),
      source: source.account,
      target,
      note: cell("note"),
    },
  };
};

// Saves one checked row and updates balances, like createTransaction does
const applyRow = (v) => {
  if (v.type === "transfer") {
    applyFlow(v.source, "out", v.amount);
    applyFlow(v.target, "in", v.amount);
  } else {
    applyFlow(v.source, v.type === "income" ? "in" : "out", v.amount);
  }

  const transaction = {
    id: randomUUID(),
    type: v.type,
    amount: v.amount,
    category: v.category,
    account: v.source.id,
    toAccount: v.target ? v.target.id : null,
    date: v.date,
    note: v.note,
  };

  transactions.push(transaction);
  checkBudget(transaction); // can fire the "budgetExceeded" event
  return transaction;
};

const summarize = (list) => {
  const out = {
    income: { count: 0, total: 0 },
    expense: { count: 0, total: 0 },
    transfer: { count: 0, total: 0 },
  };
  for (const t of list) {
    out[t.type].count += 1;
    out[t.type].total += t.amount;
  }
  for (const key of Object.keys(out)) out[key].total = round(out[key].total);
  return out;
};

// POST /api/import/transactions[?dryRun=true]
// The body is the raw CSV file. express.raw() delivers it as a Buffer.
export const importTransactions = (req, res, next) => {
  try {
    if (!Buffer.isBuffer(req.body) || req.body.length === 0) {
      throw httpError(415, "Send the CSV file as the request body with Content-Type: text/csv");
    }

    const text = bufferToText(req.body);

    let rows;
    try {
      rows = parseCsv(text);
    } catch (err) {
      throw httpError(400, err.message);
    }

    if (rows.length < 2) {
      throw httpError(400, "The CSV needs a header row and at least one data row");
    }
    if (rows.length - 1 > MAX_ROWS) {
      throw httpError(400, `A file can have at most ${MAX_ROWS} rows`);
    }

    // Map each column name to its position
    const col = {};
    rows[0].forEach((name, i) => {
      const key = normalize(name);
      if (key && col[key] === undefined) col[key] = i;
    });

    const missing = REQUIRED_COLUMNS.filter((c) => col[c] === undefined);
    if (missing.length) {
      throw httpError(400, `Missing column(s): ${missing.join(", ")}. Expected: date,type,amount,category,account,toAccount,note`);
    }

    const valid = [];
    const errors = [];

    rows.slice(1).forEach((cells, i) => {
      if (cells.every((c) => c.trim() === "")) return; // skip blank lines
      const result = checkRow(cells, col, i + 2); // row 1 is the header
      if (result.error) errors.push(result.error);
      else valid.push(result.value);
    });

    // All or nothing: one bad row stops the whole import
    if (errors.length) {
      return res.status(422).json({
        message: "Import failed. No rows were saved.",
        rowsChecked: valid.length + errors.length,
        errorCount: errors.length,
        errors: errors.slice(0, MAX_ERRORS_SHOWN),
      });
    }

    if (valid.length === 0) throw httpError(400, "The CSV has no data rows");

    if (req.query.dryRun === "true") {
      return res.json({
        dryRun: true,
        rowsChecked: valid.length,
        bytes: req.body.length,
        summary: summarize(valid),
        preview: valid.slice(0, 5).map((v) => ({
          date: v.date,
          type: v.type,
          amount: v.amount,
          category: v.category,
          account: v.source.name,
          toAccount: v.target ? v.target.name : null,
          note: v.note,
        })),
      });
    }

    const created = valid.map(applyRow);
    res.status(201).json({ imported: created.length, summary: summarize(created) });
  } catch (err) {
    next(err);
  }
};