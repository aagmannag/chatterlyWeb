// controllers/chatController.js
import Conversation from "../models/Conversation.js";
import Message from "../models/Message.js";
import UserKeys from "../models/UserKeys.js";
import { emitMessageToRoom } from "../utils/socketUtils.js";
import { decryptMessageText, encryptMessageText, decryptClientE2EE } from "../utils/messageCrypto.js";

/**
 * Create or Get a 1-1 Conversation (atomic, race-safe via pairKey)
 */
export const createOrGetConversation = async (req, res) => {
  try {
    const { participantId } = req.body;
    if (!participantId)
      return res.status(400).json({ message: "participantId is required" });

    const a = req.user._id.toString();
    const b = participantId.toString();
    const [u1, u2] = [a, b].sort();
    const pairKey = `${u1}:${u2}`;

    const convo = await Conversation.findOneAndUpdate(
      { pairKey },
      { $setOnInsert: { participants: [u1, u2], pairKey } },
      { new: true, upsert: true }
    )
      .populate("participants", "name email avatar")
      .populate({
        path: "lastMessage",
        populate: { path: "sender", select: "name email avatar" },
      });

    return res.status(200).json(convo);
  } catch (err) {
    if (err?.code === 11000) {
      const again = await Conversation.findOne({ pairKey })
        .populate("participants", "name email avatar")
        .populate({
          path: "lastMessage",
          populate: { path: "sender", select: "name email avatar" },
        });
      return res.status(200).json(again);
    }
    console.error("❌ createOrGetConversation:", err);
    return res
      .status(500)
      .json({ error: "Failed to create or get conversation" });
  }
};

/**
 * Get all conversations for the user
 */
export const getConversations = async (req, res) => {
  try {
    const conversations = await Conversation.find({
      participants: req.user._id,
    })
      .populate("participants", "name email avatar")
      .populate({
        path: "lastMessage",
        populate: { path: "sender", select: "name email avatar" },
      })
      .sort({ updatedAt: -1 });

    return res.status(200).json(conversations);
  } catch (err) {
    console.error("❌ Error in getConversations:", err.message);
    return res.status(500).json({ error: "Failed to fetch conversations" });
  }
};

/**
 * Get messages in a conversation
 * NOTE: For E2EE we return cipherText + contentType; client decrypts locally.
 */
export const getMessages = async (req, res) => {
  try {
    const { conversationId } = req.params;

    // authorize membership
    const exists = await Conversation.exists({
      _id: conversationId,
      participants: req.user._id,
    });
    if (!exists) {
      return res.status(403).json({ message: "Access denied to conversation" });
    }

    const messages = await Message.find({ conversationId })
      .select(
        "_id conversationId sender cipherText contentType clientId attachments attachmentUrl attachmentMime attachmentOriginalName attachmentBytes isDeleted createdAt"
      )
      .populate("sender", "name email avatar")
      .sort({ createdAt: 1 });

    // Server-side decrypt so every participant always sees plaintext
    // (server holds the private key for managedByServer accounts).
    const userKeys = await UserKeys.findOne({ user: req.user._id }).select("privateKey managedByServer").lean();
    const privateKeyB64 = userKeys?.privateKey || null;

    const resolved = messages.map((msg) => {
      const m = msg.toObject();
      if (m.isDeleted) return { ...m, text: "This message was deleted" };

      let text = "";
      if (m.contentType === "client:rsa-aes" && privateKeyB64) {
        text = decryptClientE2EE(m.cipherText, privateKeyB64);
      } else if (m.contentType === "server:aes-gcm") {
        text = decryptMessageText(m.cipherText, m.contentType);
      }

      return { ...m, text: text || undefined };
    });

    return res.status(200).json(resolved);
  } catch (err) {
    console.error("❌ Error in getMessages:", err.message);
    return res.status(500).json({ error: "Failed to fetch messages" });
  }
};

/**
 * Send message (E2EE-first):
 * - Expect { cipherText, contentType, clientId }
 * - Optional legacy { text } during migration (not recommended long-term)
 * - Optional file via `upload.single('attachment')` which should be ALREADY encrypted client-side.
 */
export const sendMessage = async (req, res) => {
  try {
    const { conversationId } = req.params;

    // E2EE fields from client
    const { cipherText, contentType, clientId } = req.body;

    // Attachment
    const attachmentUrl = req.file ? req.file.path : null;
    const attachmentMime = req.file?.mimetype || null;
    const attachmentOriginalName = req.file?.originalname || null;
    const attachmentBytes = req.file?.size || null;

    let finalCipherText = typeof cipherText === "string" ? cipherText.trim() : "";
    let finalContentType = contentType || "client:rsa-aes";

    // Server-side fallback: if client couldn't encrypt (e.g. key not ready),
    // encrypt the plaintext with server AES-GCM so nothing is ever stored raw.
    if (!finalCipherText && req.body.text) {
      const plaintext = typeof req.body.text === "string" ? req.body.text.trim() : "";
      if (plaintext) {
        finalCipherText = encryptMessageText(plaintext);
        finalContentType = "server:aes-gcm";
      }
    }

    // client:rsa-aes envelopes are already encrypted by the browser.
    const isClientE2EE = finalContentType === "client:rsa-aes";

    if (!finalCipherText && !attachmentUrl) {
      return res.status(400).json({
        success: false,
        message: "cipherText is required — send an encrypted envelope",
      });
    }

    // authorize membership
    const conv = await Conversation.findOne({
      _id: conversationId,
      participants: req.user._id,
    });
    if (!conv) {
      return res
        .status(403)
        .json({ success: false, message: "Access denied to conversation" });
    }

    // Persist
    const doc = await Message.create({
      conversationId,
      sender: req.user._id,
      cipherText: finalCipherText || null,
      contentType: finalCipherText
        ? finalContentType
        : attachmentUrl
        ? "signal:attachment"
        : "legacy:plaintext",
      clientId: clientId || null,
      attachments: attachmentUrl ? [attachmentUrl] : [],
      attachmentUrl: attachmentUrl || undefined,
      attachmentMime: attachmentMime || undefined,
      attachmentOriginalName: attachmentOriginalName || undefined,
      attachmentBytes: attachmentBytes || undefined,
    });

    await Conversation.findByIdAndUpdate(conversationId, {
      lastMessage: doc._id,
      updatedAt: new Date(),
    });

    // Payload for socket broadcast and API response.
    // For client:rsa-aes the server cannot decrypt — return cipherText only.
    // For server:aes-gcm the server decrypts so the sender's tab sees the text immediately.
    const resolvedText = isClientE2EE
      ? undefined
      : (decryptMessageText(doc.cipherText, doc.contentType) || undefined);

    const payload = {
      _id: doc._id,
      cipherText: doc.cipherText || null,
      contentType: doc.contentType,
      text: resolvedText,
      sender: { _id: req.user._id },
      attachments: doc.attachments || [],
      attachmentUrl: doc.attachmentUrl || null,
      attachmentMime: doc.attachmentMime || null,
      attachmentOriginalName: doc.attachmentOriginalName || null,
      attachmentBytes: doc.attachmentBytes || null,
      createdAt: doc.createdAt,
      conversationId,
      clientId: doc.clientId || null,
      status: "sent",
    };

    // Realtime broadcast
    emitMessageToRoom(conversationId, payload);

    return res.status(201).json({
      success: true,
      message: "Message sent successfully",
      data: payload,
    });
  } catch (error) {
    console.error("❌ Error in sendMessage:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to send message",
      error: error.message,
    });
  }
};

/**
 * Delete a message (soft-delete, WhatsApp "delete for everyone")
 * Only the sender can delete their own message.
 */
export const deleteMessage = async (req, res) => {
  try {
    const { conversationId, messageId } = req.params;

    const msg = await Message.findOne({
      _id: messageId,
      conversationId,
      sender: req.user._id,
    });

    if (!msg) {
      return res.status(404).json({ success: false, message: "Message not found or not yours" });
    }

    msg.isDeleted = true;
    msg.cipherText = null;    // wipe ciphertext on delete
    msg.contentType = "deleted";
    await msg.save();

    // Broadcast deletion so all open chat windows update immediately
    emitMessageToRoom(conversationId, {
      type: "message:deleted",
      _id: messageId,
      conversationId,
    });

    return res.status(200).json({ success: true, message: "Message deleted" });
  } catch (error) {
    console.error("❌ Error in deleteMessage:", error);
    return res.status(500).json({ success: false, message: "Failed to delete message" });
  }
};
