import { Router, type IRouter } from "express";
import healthRouter from "./health";
import wolvesvilleRouter from "./wolvesville";
import discordRouter from "../bot/discord-api";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/discord", discordRouter);
router.use(wolvesvilleRouter);

export default router;
