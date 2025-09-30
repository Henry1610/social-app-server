import { Server } from 'socket.io'

let ioInstance = null

export const initSocket = (httpServer) => {
	if (ioInstance) return ioInstance
	ioInstance = new Server(httpServer, {
		cors: {
			origin: "*",
			methods: ['GET', 'POST'],
      credentials: true
		}
	})

	return ioInstance;
}

export const getIO = () => {
	if (!ioInstance) {
		throw new Error('Socket.io has not been initialized. Call initSocket(server) first.')
	}
	return ioInstance
}
