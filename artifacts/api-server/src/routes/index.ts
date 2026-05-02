import { Router, type IRouter } from "express";
import healthRouter from "./health";
import dashboardRouter from "./dashboard";
import policiesRouter from "./policies";
import connectRouter from "./connect";

const router: IRouter = Router();

router.use(healthRouter);
router.use(dashboardRouter);
router.use(policiesRouter);
router.use(connectRouter);

export default router;
