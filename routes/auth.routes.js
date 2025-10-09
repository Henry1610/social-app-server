import express from "express";
import { sendOtp, verifyOtpAndRegister, login, refreshToken, changePassword, requestResetPassword, resetPassword, logout } from "../controllers/authController.js";
const router = express.Router();
import passport from "passport";

router.get("/facebook", passport.authenticate("facebook", { scope: ["email","public_profile","user_birthday","user_gender"] }));
router.get("/facebook/callback", passport.authenticate("facebook", {
    failureRedirect: "/login",
    successRedirect: "/",
}))
router.post("/send-otp", sendOtp);
router.post("/verify-otp-register", verifyOtpAndRegister);
router.post("/login", login);
router.post("/refresh-token", refreshToken);
router.post("/change-password", changePassword);
router.post('/forgot-password', requestResetPassword);
router.post('/reset-password', resetPassword);
router.post('/logout', logout);

export default router;
