import { Router } from "express";
import { getApiKeyStatus, setApiKey } from "../controllers/apiKeyController";

const router = Router();

router.get("/api-key/status", getApiKeyStatus);
router.post("/api-key", setApiKey);

export default router;
