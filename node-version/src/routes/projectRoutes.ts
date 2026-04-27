import { Router } from "express";
import {
  buildProject,
  createProject,
  getProject,
  setProject,
  startProject,
  stopProject,
} from "../controllers/projectController";

const router = Router();

router.get("/project", getProject);
router.post("/project", setProject);
router.post("/project/create", createProject);
router.post("/project/start", startProject);
router.post("/project/stop", stopProject);
router.post("/project/build", buildProject);

export default router;
