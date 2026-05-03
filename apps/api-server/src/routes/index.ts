import { Router, type IRouter } from "express";
import healthRouter from "./health";
import dashboardRouter from "./dashboard";
import policiesRouter from "./policies";
import connectRouter from "./connect";
import aiRouter from "./ai";
import adminRouter from "./admin";
import webhookRouter from "./webhook";
import knowledgeRouter from "./knowledge";

const router: IRouter = Router();

router.use(healthRouter);
router.use(dashboardRouter);
router.use(policiesRouter);
router.use(connectRouter);
router.use(aiRouter);
router.use(adminRouter);
router.use(webhookRouter);
router.use("/knowledge", knowledgeRouter);

export default router;
