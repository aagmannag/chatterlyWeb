import express from "express";
import { auth } from "../middlewares/authMiddleware.js";
import {
  addMyOneTimePreKeys,
  bootstrapMyBundle,
  getMyPreKeyStatus,
  getRecipientBundle,
  upsertMyKeyBundle,
} from "../controllers/keyController.js";

const router = express.Router();
router.use(auth);

// Modern endpoints
router.post("/me/bootstrap", bootstrapMyBundle);
router.put("/me/bundle", upsertMyKeyBundle);
router.post("/me/prekeys", addMyOneTimePreKeys);
router.get("/me/prekeys/status", getMyPreKeyStatus);
router.get("/:recipientId/bundle", getRecipientBundle);

export default router;
