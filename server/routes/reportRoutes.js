import express from "express";
import { getReport, getMonthlyReport } from "../controllers/reportController.js";

const router = express.Router();

router.get("/", getReport);
router.get("/monthly", getMonthlyReport);

export default router;