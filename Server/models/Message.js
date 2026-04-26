import mongoose from "mongoose";

const messageSchema = new mongoose.Schema(
  {
    conversationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Conversation",
      required: [true, "Conversation ID is required"],
      index: true,
    },
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Sender is required"],
      index: true,
    },

    // E2EE — only ciphertext is stored, plaintext never persists
    cipherText: { type: String, index: true }, // RSA-OAEP+AES-256-GCM or server:aes-gcm envelope
    contentType: { type: String, default: "client:rsa-aes" }, // 'client:rsa-aes' | 'server:aes-gcm' | 'signal:attachment'

    attachments: [{ type: String, trim: true }], // if you still need array of URLs
    readBy: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    deliveredTo: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    isDeleted: { type: Boolean, default: false },

    // Optimistic UI / Idempotency
    clientId: { type: String, index: true, sparse: true },

    // Optional envelope for file encryption (if you implement AES-GCM per file)
    attachmentUrl: { type: String },
    attachmentSize: { type: Number },
    attachmentNonce: { type: String },
    attachmentTag: { type: String },
  },
  { timestamps: true }
);

messageSchema.index({ conversationId: 1, createdAt: 1 });
messageSchema.index({ conversationId: 1, clientId: 1 }, { unique: true, sparse: true });

export default mongoose.model("Message", messageSchema);
