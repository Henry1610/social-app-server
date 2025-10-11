import passport from "passport";
import { Strategy as FacebookStrategy } from "passport-facebook";
import dotenv from "dotenv";
import prisma from "../utils/prisma.js";
import { createAccessToken, createRefreshToken } from "../utils/token.js";

dotenv.config();

const callbackURL = `${process.env.SERVER_URL || 'http://localhost:5000'}${process.env.FACEBOOK_CALLBACK_URL || '/api/auth/facebook/callback'}`;

passport.use(new FacebookStrategy(
  {
    clientID: process.env.FACEBOOK_APP_ID,
    clientSecret: process.env.FACEBOOK_APP_SECRET,
    callbackURL,
    profileFields: ["id", "displayName", "emails"],
  },
  async (accessToken, refreshToken, profile, done) => {
    try {
      const facebookId = profile.id;
      const email = profile.emails?.[0]?.value;
    

      let user = await prisma.user.findFirst({
        where: { facebookId },
      });

      if (!user && email) {
        // Thử tìm theo email
        user = await prisma.user.findUnique({ where: { email } });
        if (user) {
          user = await prisma.user.update({
            where: { email },
            data: { facebookId,provider: "facebook", },
          });
        }
      }

      // Nếu chưa có -> tạo mới
      if (!user) {
        user = await prisma.user.create({
          data: {
            fullName: profile.displayName,
            email,
            facebookId,
            provider: "facebook",
            username: profile.displayName.replace(/\s+/g, '').toLowerCase(),
            avatarUrl: profile.photos?.[0]?.value || null,
            role: "user"
          },
        });
      }

      // Tạo JWT
      const tokens = {
        accessToken: createAccessToken(user),
        refreshToken: await createRefreshToken(user),
      };

      // console.log("✅ Profile Facebook:", profile);
      return done(null, { user, tokens });

    } catch (err) {
      return done(err, null);
    }
  }
));

passport.serializeUser((data, done) => done(null, data));
passport.deserializeUser((data, done) => done(null, data));
