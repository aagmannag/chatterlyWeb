import express from "express";
import { auth } from "../middlewares/authMiddleware.js";
import upload from "../middlewares/upload.js";

import {
  createOrGetConversation,
  getConversations,
  getMessages,
  sendMessage,
  deleteMessage,
} from "../controllers/chatController.js";

const router = express.Router();
router.use(auth);

// Conversations
router.post("/conversations", createOrGetConversation);
router.get("/conversations", getConversations);

// Messages
router.get("/conversations/:conversationId/messages", getMessages);
router.post("/conversations/:conversationId/messages", upload.single("attachment"), sendMessage);
router.delete("/conversations/:conversationId/messages/:messageId", deleteMessage);

export default router;
