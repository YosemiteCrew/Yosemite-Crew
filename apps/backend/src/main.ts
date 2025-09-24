import express, { Request, Response } from "express";
import { logger } from "./utils/logger";

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

app.get("/", (req: Request, res: Response) => {
  res.send("Hello, TypeScript + Express + pnpm!");
});

app.listen(PORT, () => {
    logger.info(`🚀 Server is running at http://localhost:${PORT}`)
})