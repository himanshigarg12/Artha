import express from "express";
import {
  getHoldings,
  getSummary,
  getHoldingById,
  createHolding,
  updateHolding,
  deleteHolding,
} from "../controllers/investmentController.js";

const router = express.Router();

router.get("/", getHoldings);
router.get("/summary", getSummary);
router.get("/:id", getHoldingById);
router.post("/", createHolding);
router.put("/:id", updateHolding);
router.delete("/:id", deleteHolding);

export default router;