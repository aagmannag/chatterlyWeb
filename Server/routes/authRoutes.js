import express from "express";
import { signup, login, getMe } from "../controllers/authController.js";
import { auth } from "../middlewares/authMiddleware.js";

const router = express.Router();

router.post("/signup", signup);
router.post("/login", login);
router.get("/me", auth, getMe);  // validate token + get fresh profile

export default router;
