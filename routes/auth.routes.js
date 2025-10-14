import express from "express";
import passport from "passport";
import { sendOtpLimiter, resetPasswordRequestLimiter } from "../middlewares/rateLimiters.js";
import { sendOtp, verifyOtpAndRegister, login, refreshToken, changePassword, requestResetPassword, resetPassword, logout, getMe, facebookCallback, getSessionAuth } from "../controllers/authController.js";
import { authenticate } from "../middlewares/authenticate.js";
import { authorize } from "../middlewares/authorize.js";
const router = express.Router();


router.get("/facebook", passport.authenticate("facebook", { scope: ["email", "public_profile", "user_birthday", "user_gender"] }));
router.get("/facebook/callback", facebookCallback);
router.get("/session-auth", getSessionAuth);
router.post("/send-otp", sendOtpLimiter, sendOtp);
router.post("/verify-otp-register", verifyOtpAndRegister);
router.post("/login", login);
router.post("/refresh-token", refreshToken);
router.post("/change-password", changePassword);
router.post('/forgot-password', resetPasswordRequestLimiter, requestResetPassword);
router.post('/reset-password', resetPassword);
router.post('/logout', logout);
router.get('/me', authenticate,authorize('user'), getMe);

export default router;
