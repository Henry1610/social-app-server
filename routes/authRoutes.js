import express from "express";
import { sendOtp, verifyOtpAndRegister,login, refreshToken, changePassword, requestResetPassword, resetPassword, logout } from "../controllers/authController.js";
const router = express.Router();

router.post("/send-otp", sendOtp);              
router.post("/verify-otp-register", verifyOtpAndRegister); 
router.post("/login", login);                    
router.post("/refresh-token", refreshToken);                    
router.post("/change-password", changePassword);   
router.post('/forgot-password', requestResetPassword);
router.post('/reset-password', resetPassword);                 
router.post('/logout', logout);                 

export default router;
