import twilio from "twilio";

// Lấy từ Twilio console
const accountSid = process.env.TWILIO_ACCOUNT_SID; 
const authToken = process.env.TWILIO_AUTH_TOKEN;  

const client = twilio(accountSid, authToken);

export const sendSMS = async(to, message)=> {
  try {
    const sms =  client.messages.create({
      body: message,
      from: process.env.TWILIO_PHONE_NUMBER, // số Twilio
      to, 
    });
    console.log("Gửi SMS thành công:", sms.sid);
  } catch (error) {
    console.error("Lỗi gửi SMS:", error);
  }
}


