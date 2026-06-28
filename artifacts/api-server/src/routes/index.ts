import { Router, type IRouter } from "express";
import healthRouter from "./health";
import wolvesvilleRouter from "./wolvesville";
import discordRouter from "../bot/discord-api";
import authRouter from "./auth";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/discord", discordRouter);
router.use(wolvesvilleRouter);
router.use("/auth", authRouter);

export default router;
