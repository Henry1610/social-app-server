import express from "express";
import { sendOtp, verifyOtpAndRegister,login } from "../controllers/authController.js";
const router = express.Router();

router.post("/send-otp", sendOtp);              
router.post("/verify-otp-register", verifyOtpAndRegister); 
router.post("/login", login);                    

export default router;
