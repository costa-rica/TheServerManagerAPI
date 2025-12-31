import express from "express";
import type { Request, Response } from "express";
import path from "path";
import fs from "fs";
import logger from "../config/logger";

const router = express.Router();

// router.get("/", (req: Request, res: Response) => {
//   res.send("index endpoint");
// });

router.get("/", (req: Request, res: Response) => {
  logger.info("index endpoint called 🚀");

  try {
    // Use the compiled template path at runtime
    const templatePath = path.resolve(__dirname, "../templates/index.html");
    let html = fs.readFileSync(templatePath, "utf8");

    res.type("html").send(html);
  } catch (err) {
    logger.error("Error serving index page:", err);
    res.status(500).json({
      error: {
        code: "INTERNAL_ERROR",
        message: "Failed to serve index page",
        details:
          process.env.NODE_ENV !== "production"
            ? err instanceof Error
              ? err.message
              : "Unknown error"
            : undefined,
        status: 500,
      },
    });
  }
});

export default router;
