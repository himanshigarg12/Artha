import express from "express";
import {
  exportTransactions,
  saveExport,
  listFiles,
  downloadFile,
  deleteFile,
} from "../controllers/exportController.js";

const router = express.Router();

router.get("/transactions", exportTransactions);
router.post("/transactions/save", saveExport);
router.get("/files", listFiles);
router.get("/files/:name", downloadFile);
router.delete("/files/:name", deleteFile);

export default router;