import express, { type Express, type Request, type Response } from "express";
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

// API routes
app.use("/api", router);

// Serve the React dashboard static build
// __dirname is set by the build banner to the directory of the running bundle
// (artifacts/api-server/dist), so we resolve up to the repo root then into
// dashboard/build where Vite outputs the compiled React app.
const dashboardBuildDir = path.resolve(__dirname, "../../../dashboard/build");
app.use(express.static(dashboardBuildDir));

// SPA fallback — any route not matched by the API or a static file gets
// index.html so that React Router can handle client-side navigation.
app.use((req: Request, res: Response) => {
  if (req.path.startsWith("/api")) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  res.sendFile(path.join(dashboardBuildDir, "index.html"));
});

export default app;
