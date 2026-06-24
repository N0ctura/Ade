import { Router, type IRouter } from "express";
import healthRouter from "./health";
import wolvesvilleRouter from "./wolvesville";

const router: IRouter = Router();

router.use(healthRouter);
router.use(wolvesvilleRouter);

export default router;
