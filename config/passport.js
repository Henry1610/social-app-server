import passport from "passport";
import { Strategy as FacebookStrategy } from "passport-facebook";
import dotenv from "dotenv";
import prisma from "../utils/prisma.js"; 
import { createAccessToken, createRefreshToken } from "../utils/token.js"; 

dotenv.config();

const callbackURL = `${process.env.SEVER_URL}${process.env.FACEBOOK_CALLBACK_URL}`;

passport.use(new FacebookStrategy(
  {
    clientID: process.env.FACEBOOK_APP_ID,
    clientSecret: process.env.FACEBOOK_APP_SECRET,
    callbackURL,
    profileFields: ["id", "displayName", "emails"],
  },
  async (accessToken, refreshToken, profile, done) => {
    try {
      // const email = profile.emails?.[0]?.value || null;
      // const facebookId = profile.id;

      // // Tìm user đã tồn tại
      // let user = await prisma.user.findFirst({
      //   where: {  facebookId },
      // });

      // // Nếu chưa có -> tạo mới
      // if (!user) {
      //   user = await prisma.user.create({
      //     data: {
      //       fullname:profile.name,
      //       email,
      //       facebookId,
      //       provider: "facebook",

      //     },
      //   });
      // }

      // // Tạo JWT
      // const tokens = {
      //   accessToken: createAccessToken(user),
      //   refreshToken: createRefreshToken(user),
      // };

      // return done(null, { user, tokens });
            console.log("✅ Profile Facebook:", profile); // để test
      return done(null, profile);

    } catch (err) {
      return done(err, null);
    }
  }
));

passport.serializeUser((data, done) => done(null, data));
passport.deserializeUser((data, done) => done(null, data));
