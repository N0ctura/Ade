import { Router, type IRouter } from "express";
import healthRouter from "./health";
import wolvesvilleRouter from "./wolvesville";
import discordRouter from "../bot/discord-api";
import authRouter from "./auth";
import dashboardRouter from "./dashboard";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/discord", discordRouter);
router.use(wolvesvilleRouter);
router.use("/auth", authRouter);
router.use("/dashboard", dashboardRouter);

export default router;
