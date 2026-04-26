import express from "express";
import { getUsers, getUserById, updateAvatar, updateProfile } from "../controllers/userController.js";
import { auth } from "../middlewares/authMiddleware.js";
import upload from "../middlewares/upload.js";

const router = express.Router();

router.use(auth);

router.post("/upload-avatar", upload.single("avatar"), updateAvatar);
router.put("/profile", updateProfile);    // update name + bio

router.get("/", getUsers);
router.get("/:id", getUserById);

export default router;
