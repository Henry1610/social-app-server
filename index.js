import express from 'express'
import route from './routes/index.js';
import http from "http";
import session from "express-session";
import passport from "passport";
import { initSocket } from './config/socket.js';
import { registerSocketHandlers } from './socket/index.js'
import './config/passport.js';

const app=express();
app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: true
}));
app.use(passport.initialize());
app.use(passport.session());
const server = http.createServer(app);

initSocket(server);
registerSocketHandlers();
app.use(express.json());
route(app);

server.listen(5000, () => {
  console.log(`Server running on ${process.env.PORT}`);
});