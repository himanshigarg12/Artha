import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { logger } from "./middleware/logger.js";
import { errorHandler } from "./middleware/errorHandler.js";
import accountRoutes from "./routes/accountRoutes.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());
app.use(logger);

app.get("/api/health", (req, res) => {
  res.json({ app: "Artha", status: "running" });
});

app.use("/api/accounts", accountRoutes);
app.use(errorHandler);

app.listen(PORT, () => console.log(`Artha server running on port ${PORT}`));