import { Router } from "express";
import multer from "multer";

import isAuth from "../middleware/isAuth";
import * as FlowController from "../controllers/FlowController";
import AppError from "../errors/AppError";
import uploadFlow from "../config/uploadFlow";

const flowRoutes = Router();

flowRoutes.get("/flows", isAuth, FlowController.listFlows);
flowRoutes.post("/flows", isAuth, FlowController.createFlow);
flowRoutes.get("/flows/:flowId", isAuth, FlowController.showFlow);
flowRoutes.put("/flows/:flowId", isAuth, FlowController.updateFlow);
flowRoutes.delete("/flows/:flowId", isAuth, FlowController.archiveFlow);
flowRoutes.post("/flows/:flowId/duplicate", isAuth, FlowController.duplicateFlow);
flowRoutes.post("/flows/:flowId/media-upload", isAuth, (req, res, next) => {
  uploadFlow.single("file")(req, res, async (err: any) => {
    if (err) {
      if (err instanceof multer.MulterError && err.code === "LIMIT_FILE_SIZE") {
        return next(new AppError("Arquivo excede o limite de 40MB.", 400));
      }
      return next(err);
    }

    return FlowController.uploadFlowMedia(req as any, res as any).catch(next);
  });
});

flowRoutes.get("/flows/:flowId/versions", isAuth, FlowController.listFlowVersions);
flowRoutes.post("/flows/:flowId/versions", isAuth, FlowController.createFlowVersion);
flowRoutes.put("/flows/:flowId/versions/:versionId/graph", isAuth, FlowController.saveFlowGraph);
flowRoutes.post("/flows/:flowId/versions/:versionId/validate", isAuth, FlowController.validateFlowVersion);
flowRoutes.post("/flows/:flowId/versions/:versionId/publish", isAuth, FlowController.publishFlowVersion);

flowRoutes.post("/flows/:flowId/activate", isAuth, FlowController.activateFlow);
flowRoutes.post("/flows/:flowId/deactivate", isAuth, FlowController.deactivateFlow);

flowRoutes.post("/flows/:flowId/bindings", isAuth, FlowController.createFlowBinding);
flowRoutes.put("/flows/:flowId/bindings/:bindingId", isAuth, FlowController.updateFlowBinding);
flowRoutes.delete("/flows/:flowId/bindings/:bindingId", isAuth, FlowController.deleteFlowBinding);

flowRoutes.get("/flow-executions/current", isAuth, FlowController.getCurrentExecution);
flowRoutes.get("/flow-executions/:executionId/events", isAuth, FlowController.getExecutionEvents);
flowRoutes.post("/flow-executions/:executionId/input", isAuth, FlowController.processExecutionInput);

export default flowRoutes;
