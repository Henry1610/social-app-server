import express from 'express'
import route from './routes/index.js';
import http from "http";
import { initSocket } from './config/socket.js';
import { registerSocketHandlers } from './socket/index.js'

const app=express();
const server = http.createServer(app);

initSocket(server);
registerSocketHandlers();
app.use(express.json());
route(app);

server.listen(5000, () => {
  console.log(`Server running on ${process.env.SERVER_PORT}`);
});