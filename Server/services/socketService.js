import Message from "../models/Message.js";
import Conversation from "../models/Conversation.js";
import { decryptMessageText, encryptMessageText } from "../utils/messageCrypto.js";

export const createMessageAndBroadcast = async (io, payload) => {
  console.log("🧩 Received payload:", payload);

  const { conversationId, senderId, text, attachments, cipherText, contentType } = payload;

  if (!conversationId) {
    console.error("❌ Missing conversationId in payload");
    return;
  }

  const plainText = typeof text === "string" ? text.trim() : "";
  let finalCipherText = typeof cipherText === "string" ? cipherText.trim() : "";
  let finalContentType = contentType || "signal:whisper";

  if (!finalCipherText && plainText) {
    finalCipherText = encryptMessageText(plainText);
    finalContentType = "server:aes-gcm";
  }

  // ✅ Use conversationId if that’s your schema field
  const message = new Message({
    conversationId,
    sender: senderId,
    cipherText: finalCipherText || null,
    contentType: finalCipherText
      ? finalContentType
      : attachments?.length
      ? "signal:attachment"
      : "legacy:plaintext",
    attachments: attachments || []
  });

  await message.save();

  // update conversation lastMessage
  await Conversation.findByIdAndUpdate(
    conversationId,
    { lastMessage: message._id, updatedAt: new Date() }
  );

  // populate message for broadcast
  const populated =
    (message.populate && (await message.populate("sender", "name email avatar"))) ||
    (await Message.findById(message._id).populate("sender", "name email avatar"));

  const messageObj = populated.toObject ? populated.toObject() : populated;
  messageObj.text = plainText || decryptMessageText(messageObj.cipherText, messageObj.contentType) || undefined;

  // emit to conversation room
  io.to(conversationId).emit("message:receive", messageObj);

  // emit to each participant personal room
  const conv = await Conversation.findById(conversationId).populate("participants", "_id");
  for (const p of conv.participants) {
    io.to(String(p._id)).emit("notification:new_message", { conversationId, message: messageObj });
  }

  console.log("📤 Message broadcasted to conversation:", conversationId);
};
