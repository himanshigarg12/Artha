import express from "express";
import { importTransactions } from "../controllers/importController.js";

const router = express.Router();

// express.json() in server.js only reads JSON, so this route reads the
// body as raw bytes (a Buffer) when the type is CSV or plain text.
router.post(
  "/transactions",
  express.raw({ type: ["text/csv", "text/plain", "application/octet-stream"], limit: "1mb" }),
  importTransactions
);

export default router;