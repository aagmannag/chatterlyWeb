import mongoose from "mongoose";
import { createHash, generateKeyPairSync } from "crypto";
import UserKeys from "../models/UserKeys.js";
import {
  validateKeyBundlePayload,
  validateOneTimePreKeysPayload,
} from "../utils/e2eeValidation.js";

const toObjectId = (value) => {
  if (!mongoose.Types.ObjectId.isValid(value)) return null;
  return new mongoose.Types.ObjectId(value);
};

const sha256Base64 = (value) =>
  createHash("sha256").update(value).digest("base64");

const generateServerManagedKeyBundle = () => {
  const { publicKey, privateKey } = generateKeyPairSync("rsa", {
    modulusLength: 2048,
    publicKeyEncoding: { type: "spki", format: "der" },
    privateKeyEncoding: { type: "pkcs8", format: "der" },
  });

  const publicKeyBase64 = publicKey.toString("base64");
  const privateKeyBase64 = privateKey.toString("base64");

  return {
    identityKey: publicKeyBase64,
    signedPreKeyId: 1,
    signedPreKeyPublic: publicKeyBase64,
    signedPreKeySignature: sha256Base64(publicKey),
    privateKey: privateKeyBase64,
    managedByServer: true,
    oneTimePreKeys: [],
  };
};

export const bootstrapMyBundle = async (req, res) => {
  try {
    let keys = await UserKeys.findOne({ user: req.user._id });

    if (!keys) {
      const generated = generateServerManagedKeyBundle();
      keys = await UserKeys.create({
        user: req.user._id,
        ...generated,
      });
    } else if (!keys.privateKey) {
      // Legacy/incomplete bundle: recover by issuing a server-managed pair
      // so this user can decrypt incoming client:rsa-aes messages.
      const generated = generateServerManagedKeyBundle();
      keys.identityKey = generated.identityKey;
      keys.signedPreKeyId = generated.signedPreKeyId;
      keys.signedPreKeyPublic = generated.signedPreKeyPublic;
      keys.signedPreKeySignature = generated.signedPreKeySignature;
      keys.privateKey = generated.privateKey;
      keys.managedByServer = true;
      keys.updatedAt = new Date();
      await keys.save();
    }

    return res.status(200).json({
      success: true,
      hasBundle: true,
      data: {
        identityKey: keys.identityKey,
        signedPreKeyId: keys.signedPreKeyId,
        signedPreKeyPublic: keys.signedPreKeyPublic,
        signedPreKeySignature: keys.signedPreKeySignature,
        privateKey: keys.privateKey || null,
        managedByServer: Boolean(keys.managedByServer),
      },
    });
  } catch (error) {
    console.error("keys/bootstrap error:", error);
    return res.status(500).json({ success: false, message: "Failed to bootstrap key bundle" });
  }
};

export const upsertMyKeyBundle = async (req, res) => {
  try {
    const validated = validateKeyBundlePayload(req.body);
    if (!validated.ok) {
      return res.status(400).json({ success: false, message: validated.message });
    }

    const {
      identityKey,
      signedPreKeyId,
      signedPreKeyPublic,
      signedPreKeySignature,
      oneTimePreKeys,
    } = validated.value;

    const $set = {
      identityKey,
      signedPreKeyId,
      signedPreKeyPublic,
      signedPreKeySignature,
      managedByServer: false,
      updatedAt: new Date(),
    };

    if (oneTimePreKeys) {
      $set.oneTimePreKeys = oneTimePreKeys;
    }

    await UserKeys.findOneAndUpdate(
      { user: req.user._id },
      { $set, $unset: { privateKey: 1 } },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    return res.status(200).json({ success: true, message: "Key bundle updated" });
  } catch (error) {
    console.error("keys/upsert error:", error);
    return res.status(500).json({ success: false, message: "Failed to update key bundle" });
  }
};

export const addMyOneTimePreKeys = async (req, res) => {
  try {
    const validated = validateOneTimePreKeysPayload(req.body);
    if (!validated.ok) {
      return res.status(400).json({ success: false, message: validated.message });
    }

    const userKeys = await UserKeys.findOne({ user: req.user._id });
    if (!userKeys) {
      return res.status(400).json({
        success: false,
        message: "Upload identity and signed prekey bundle before adding one-time prekeys",
      });
    }

    const existingIds = new Set((userKeys.oneTimePreKeys || []).map((key) => key.keyId));
    const toInsert = validated.value.filter((key) => !existingIds.has(key.keyId));

    if (!toInsert.length) {
      return res.status(200).json({
        success: true,
        message: "No new prekeys inserted",
        data: {
          inserted: 0,
          available: (userKeys.oneTimePreKeys || []).filter((k) => !k.isUsed).length,
        },
      });
    }

    userKeys.oneTimePreKeys.push(...toInsert);
    userKeys.updatedAt = new Date();
    await userKeys.save();

    return res.status(200).json({
      success: true,
      message: "One-time prekeys added",
      data: {
        inserted: toInsert.length,
        available: userKeys.oneTimePreKeys.filter((k) => !k.isUsed).length,
      },
    });
  } catch (error) {
    console.error("keys/add-prekeys error:", error);
    return res.status(500).json({ success: false, message: "Failed to add one-time prekeys" });
  }
};

export const getMyPreKeyStatus = async (req, res) => {
  try {
    const userKeys = await UserKeys.findOne({ user: req.user._id }).select("oneTimePreKeys updatedAt").lean();
    if (!userKeys) {
      return res.status(404).json({ success: false, message: "No key bundle found" });
    }

    const total = userKeys.oneTimePreKeys?.length || 0;
    const available = (userKeys.oneTimePreKeys || []).filter((k) => !k.isUsed).length;
    return res.status(200).json({
      success: true,
      data: {
        total,
        available,
        used: total - available,
        updatedAt: userKeys.updatedAt,
      },
    });
  } catch (error) {
    console.error("keys/status error:", error);
    return res.status(500).json({ success: false, message: "Failed to fetch key status" });
  }
};

export const getRecipientBundle = async (req, res) => {
  try {
    const rawRecipientId = req.params.recipientId || req.body?.recipientId;
    const recipientId = toObjectId(rawRecipientId);

    if (!recipientId) {
      return res.status(400).json({ success: false, message: "Valid recipientId is required" });
    }

    const keys = await UserKeys.findOne({ user: recipientId }).lean();
    if (!keys) {
      const generated = generateServerManagedKeyBundle();
      const created = await UserKeys.create({
        user: recipientId,
        ...generated,
      });

      return res.status(200).json({
        success: true,
        hasBundle: true,
        data: {
          identityKey: created.identityKey,
          signedPreKeyId: created.signedPreKeyId,
          signedPreKeyPublic: created.signedPreKeyPublic,
          signedPreKeySignature: created.signedPreKeySignature,
          oneTimePreKey: null,
        },
      });
    }

    let reservedOneTimePreKey = null;
    const unused = (keys.oneTimePreKeys || [])
      .filter((k) => !k.isUsed)
      .sort((a, b) => a.keyId - b.keyId);

    for (const candidate of unused) {
      const claimResult = await UserKeys.updateOne(
        {
          user: recipientId,
          oneTimePreKeys: { $elemMatch: { keyId: candidate.keyId, isUsed: false } },
        },
        {
          $set: {
            "oneTimePreKeys.$.isUsed": true,
            "oneTimePreKeys.$.usedAt": new Date(),
          },
        }
      );

      if (claimResult.modifiedCount === 1) {
        reservedOneTimePreKey = {
          keyId: candidate.keyId,
          publicKey: candidate.publicKey,
        };
        break;
      }
    }

    return res.status(200).json({
      success: true,
      hasBundle: true,
      data: {
        identityKey: keys.identityKey,
        signedPreKeyId: keys.signedPreKeyId,
        signedPreKeyPublic: keys.signedPreKeyPublic,
        signedPreKeySignature: keys.signedPreKeySignature,
        oneTimePreKey: reservedOneTimePreKey,
      },
    });
  } catch (error) {
    console.error("keys/bundle error:", error);
    return res.status(500).json({ success: false, message: "Failed to fetch recipient bundle" });
  }
};
