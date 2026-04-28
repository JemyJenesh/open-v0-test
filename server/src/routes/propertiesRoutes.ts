import { Router } from "express";
import { updateProperties } from "../controllers/propertiesController";

const router = Router();

router.post("/properties", updateProperties);

export default router;
