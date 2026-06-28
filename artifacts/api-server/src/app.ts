import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import path from "path";
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
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/api", router);

// Serve the React dashboard static files from the working directory
const dashboardBuildPath = path.resolve(process.cwd(), "dashboard/build");
app.use(express.static(dashboardBuildPath));

// For any routes that don't match API, send back the React index.html
app.use((req, res, next) => {
  if (!req.url.startsWith("/api")) {
    res.sendFile(path.resolve(dashboardBuildPath, "index.html"));
  } else {
    next();
  }
});

export default app;
