import express from "express";
import { chat, getContext, getSuggestions } from "../controllers/assistantController.js";

const router = express.Router();

router.post("/", chat);
router.get("/context", getContext);
router.get("/suggestions", getSuggestions);

export default router;