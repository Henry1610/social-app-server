// ✅ Load biến môi trường ngay đầu
import dotenv from "dotenv";
dotenv.config();

import express from 'express';
import route from './routes/index.js';
import http from "http";
import session from "express-session";
import passport from "passport";
import cookieParser from 'cookie-parser';
import { initSocket } from './config/socket.js';
import { registerSocketHandlers } from './socket/index.js';
import './config/passport.js';
import cors from 'cors';

const app = express();

app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
    maxAge: 5 * 60 * 1000,
  },
}));
app.use(cookieParser());

app.use(passport.initialize());
app.use(cors({
  origin: process.env.CLIENT_URL,
  credentials: true,
}));
app.use(passport.session());

const server = http.createServer(app);
initSocket(server);
registerSocketHandlers();

app.use(express.json());
route(app);

server.listen(5000, () => {
  console.log(`Server running on ${process.env.PORT}`);
});