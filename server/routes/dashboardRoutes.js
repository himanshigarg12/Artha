import express from "express";
import {
  getDashboard,
  getSummary,
  getCashflow,
  getRecent,
} from "../controllers/dashboardController.js";

const router = express.Router();

router.get("/", getDashboard);
router.get("/summary", getSummary);
router.get("/cashflow", getCashflow);
router.get("/recent", getRecent);

export default router;