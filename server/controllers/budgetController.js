import { randomUUID } from "crypto";
import { budgets, alerts } from "../data/store.js";
import { currentMonth, getSpent, getStatus } from "../utils/budgetHelpers.js";

const httpError = (status, message) => {
  const err = new Error(message);
  err.status = status;
  return err;
};

export const getBudgets = (req, res) => {
  res.json(budgets);
};

// Spent vs limit for every budget in a month (default: current month)
export const getBudgetStatus = (req, res, next) => {
  const month = req.query.month || currentMonth();

  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) {
    return next(httpError(400, "Month must be in YYYY-MM format"));
  }

  const result = budgets.map((b) => {
    const spent = getSpent(b.category, month);
    const { percent, status } = getStatus(spent, b.limit);
    return {
      id: b.id,
      category: b.category,
      month,
      limit: b.limit,
      spent,
      remaining: b.limit - spent,
      percent,
      status,
    };
  });

  res.json(result);
};

export const getAlerts = (req, res) => {
  res.json([...alerts].reverse());
};

export const createBudget = (req, res, next) => {
  const { category, limit } = req.body;

  if (!category || !category.trim()) return next(httpError(400, "Category is required"));
  if (typeof limit !== "number" || limit <= 0) {
    return next(httpError(400, "Limit must be a number greater than 0"));
  }

  const exists = budgets.some((b) => b.category.toLowerCase() === category.trim().toLowerCase());
  if (exists) return next(httpError(409, "A budget for this category already exists"));

  const budget = { id: randomUUID(), category: category.trim(), limit, period: "monthly" };
  budgets.push(budget);
  res.status(201).json(budget);
};

export const updateBudget = (req, res, next) => {
  const budget = budgets.find((b) => b.id === req.params.id);
  if (!budget) return next(httpError(404, "Budget not found"));

  const { limit } = req.body;
  if (typeof limit !== "number" || limit <= 0) {
    return next(httpError(400, "Limit must be a number greater than 0"));
  }

  budget.limit = limit;
  res.json(budget);
};

export const deleteBudget = (req, res, next) => {
  const index = budgets.findIndex((b) => b.id === req.params.id);
  if (index === -1) return next(httpError(404, "Budget not found"));

  const [removed] = budgets.splice(index, 1);
  res.json({ message: "Budget deleted", budget: removed });
};