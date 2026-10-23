import express from "express";
import {
  getBudgets,
  getBudgetStatus,
  getAlerts,
  createBudget,
  updateBudget,
  deleteBudget,
} from "../controllers/budgetController.js";

const router = express.Router();

router.get("/", getBudgets);
router.get("/status", getBudgetStatus);
router.get("/alerts", getAlerts);
router.post("/", createBudget);
router.put("/:id", updateBudget);
router.delete("/:id", deleteBudget);

export default router;