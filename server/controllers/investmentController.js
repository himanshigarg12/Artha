import { randomUUID } from "crypto";
import { accounts, holdings } from "../data/store.js";

const ASSET_TYPES = ["stock", "mutual_fund", "etf", "gold", "crypto"];

const httpError = (status, message) => {
  const err = new Error(message);
  err.status = status;
  return err;
};

const round = (n) => Math.round(n * 100) / 100;
const isPositive = (n) => typeof n === "number" && Number.isFinite(n) && n > 0;
const isText = (s) => typeof s === "string" && s.trim().length > 0;

// Adds the calculated fields to a holding
const enrich = (h) => {
  const invested = h.quantity * h.buyPrice;
  const currentValue = h.quantity * h.currentPrice;
  const gain = currentValue - invested;
  return {
    ...h,
    invested: round(invested),
    currentValue: round(currentValue),
    gain: round(gain),
    gainPercent: invested > 0 ? round((gain / invested) * 100) : 0,
  };
};

// Holdings must belong to an investment account. If none is given,
// the first investment account is used.
const resolveAccount = (id) => {
  if (id === undefined) {
    const first = accounts.find((a) => a.type === "investment");
    if (!first) throw httpError(400, "Create an investment account first");
    return first;
  }
  const account = accounts.find((a) => a.id === id);
  if (!account) throw httpError(404, "Account not found");
  if (account.type !== "investment") {
    throw httpError(400, "Holdings must belong to an investment account");
  }
  return account;
};

// GET /api/investments
export const getHoldings = (req, res) => {
  res.json(holdings.map(enrich));
};

// GET /api/investments/summary
export const getSummary = (req, res) => {
  const list = holdings.map(enrich);

  const invested = list.reduce((s, h) => s + h.invested, 0);
  const currentValue = list.reduce((s, h) => s + h.currentValue, 0);
  const gain = currentValue - invested;

  const groups = new Map();
  for (const h of list) {
    groups.set(h.assetType, (groups.get(h.assetType) || 0) + h.currentValue);
  }
  const allocation = [...groups.entries()]
    .map(([assetType, value]) => ({
      assetType,
      value: round(value),
      percent: currentValue > 0 ? round((value / currentValue) * 100) : 0,
    }))
    .sort((a, b) => b.value - a.value);

  const ranked = [...list].sort((a, b) => b.gainPercent - a.gainPercent);
  const pick = (h) => (h ? { symbol: h.symbol, name: h.name, gainPercent: h.gainPercent } : null);

  res.json({
    holdingsCount: list.length,
    invested: round(invested),
    currentValue: round(currentValue),
    gain: round(gain),
    gainPercent: invested > 0 ? round((gain / invested) * 100) : 0,
    allocation,
    bestPerformer: pick(ranked[0]),
    worstPerformer: pick(ranked[ranked.length - 1]),
  });
};

// GET /api/investments/:id
export const getHoldingById = (req, res, next) => {
  const holding = holdings.find((h) => h.id === req.params.id);
  if (!holding) return next(httpError(404, "Holding not found"));
  res.json(enrich(holding));
};

// POST /api/investments
export const createHolding = (req, res, next) => {
  const { symbol, name, assetType, quantity, buyPrice, currentPrice, account } = req.body;

  if (!isText(symbol)) return next(httpError(400, "Symbol is required"));
  if (!isText(name)) return next(httpError(400, "Name is required"));
  if (!ASSET_TYPES.includes(assetType)) {
    return next(httpError(400, `assetType must be one of: ${ASSET_TYPES.join(", ")}`));
  }
  if (!isPositive(quantity)) return next(httpError(400, "Quantity must be a number greater than 0"));
  if (!isPositive(buyPrice)) return next(httpError(400, "buyPrice must be a number greater than 0"));
  if (currentPrice !== undefined && !isPositive(currentPrice)) {
    return next(httpError(400, "currentPrice must be a number greater than 0"));
  }

  const target = resolveAccount(account);
  const code = symbol.trim().toUpperCase();

  if (holdings.some((h) => h.symbol === code && h.account === target.id)) {
    return next(httpError(409, `${code} already exists in this account. Update it instead.`));
  }

  const holding = {
    id: randomUUID(),
    symbol: code,
    name: name.trim(),
    assetType,
    quantity,
    buyPrice,
    currentPrice: currentPrice === undefined ? buyPrice : currentPrice,
    account: target.id,
  };

  holdings.push(holding);
  res.status(201).json(enrich(holding));
};

// PUT /api/investments/:id  (send only the fields you want to change)
export const updateHolding = (req, res, next) => {
  const holding = holdings.find((h) => h.id === req.params.id);
  if (!holding) return next(httpError(404, "Holding not found"));

  const { name, assetType, quantity, buyPrice, currentPrice, account } = req.body;

  if (name !== undefined && !isText(name)) return next(httpError(400, "Name cannot be empty"));
  if (assetType !== undefined && !ASSET_TYPES.includes(assetType)) {
    return next(httpError(400, `assetType must be one of: ${ASSET_TYPES.join(", ")}`));
  }
  if (quantity !== undefined && !isPositive(quantity)) {
    return next(httpError(400, "Quantity must be a number greater than 0"));
  }
  if (buyPrice !== undefined && !isPositive(buyPrice)) {
    return next(httpError(400, "buyPrice must be a number greater than 0"));
  }
  if (currentPrice !== undefined && !isPositive(currentPrice)) {
    return next(httpError(400, "currentPrice must be a number greater than 0"));
  }

  if (account !== undefined) holding.account = resolveAccount(account).id;
  if (name !== undefined) holding.name = name.trim();
  if (assetType !== undefined) holding.assetType = assetType;
  if (quantity !== undefined) holding.quantity = quantity;
  if (buyPrice !== undefined) holding.buyPrice = buyPrice;
  if (currentPrice !== undefined) holding.currentPrice = currentPrice;

  res.json(enrich(holding));
};

// DELETE /api/investments/:id
export const deleteHolding = (req, res, next) => {
  const index = holdings.findIndex((h) => h.id === req.params.id);
  if (index === -1) return next(httpError(404, "Holding not found"));

  const [removed] = holdings.splice(index, 1);
  res.json({ message: "Holding deleted", holding: removed });
};