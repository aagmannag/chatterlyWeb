import mongoose from "mongoose";

const PreKeySchema = new mongoose.Schema(
  {
    keyId: { type: Number, required: true, min: 1 },
    publicKey: { type: String, required: true, trim: true }, // base64
    isUsed: { type: Boolean, default: false },
    usedAt: { type: Date, default: null },
  },
  { _id: false }
);

const userKeysSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", unique: true, required: true },

    identityKey: { type: String, required: true, trim: true }, // base64 public
    signedPreKeyId: { type: Number, required: true, min: 1 },
    signedPreKeyPublic: { type: String, required: true, trim: true }, // base64 public
    signedPreKeySignature: { type: String, required: true, trim: true }, // base64
    privateKey: { type: String, default: null, trim: true }, // optional server-managed pkcs8 base64
    managedByServer: { type: Boolean, default: false },

    oneTimePreKeys: [PreKeySchema],
    updatedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

userKeysSchema.index({ user: 1 }, { unique: true });

userKeysSchema.path("oneTimePreKeys").validate((preKeys) => {
  if (!Array.isArray(preKeys)) return false;
  const keyIds = new Set();
  for (const key of preKeys) {
    if (keyIds.has(key.keyId)) return false;
    keyIds.add(key.keyId);
  }
  return true;
}, "oneTimePreKeys contains duplicate keyId values");

export default mongoose.model("UserKeys", userKeysSchema);
