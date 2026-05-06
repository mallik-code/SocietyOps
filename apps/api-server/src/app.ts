import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.use(cors());
app.use(express.json({ limit: "15mb" }));
app.use(express.urlencoded({ extended: true, limit: "15mb" }));

app.use("/api", router);

// 404 handler
app.use((req: express.Request, res: express.Response) => {
  logger.warn({ url: req.url }, "Route not found");
  res.status(404).json({
    error: "Not Found",
    message: `The requested path ${req.path} does not exist.`
  });
});

// Global error handler
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  const errorId = Math.random().toString(36).substring(7);
  logger.error({ err, errorId, url: req.url, method: req.method }, "Unhandled application error");
  
  if (res.headersSent) {
    return next(err);
  }

  const statusCode = err.status || err.statusCode || 500;
  res.status(statusCode).json({
    error: statusCode === 500 ? "Internal Server Error" : "Request Error",
    message: process.env.NODE_ENV === "development" ? err.message : "An unexpected error occurred",
    errorId: process.env.NODE_ENV === "development" ? undefined : errorId
  });
});

export default app;
