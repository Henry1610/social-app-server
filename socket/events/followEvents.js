import { getIO } from "../../config/socket.js"

export const emitFollow = (follower, following) => {
    const io = getIO()
    io.to(`user_${following.id}`).emit("follow:new", { follower })
}

export const emitUnfollow = (followerId, followingId) => {
    const io = getIO()
    io.to(`user_${followingId}`).emit("follow:removed", { followerId })
}

export const emitFollowRequest = (follower, following) => {
    const io = getIO()
    io.to(`user_${following.id}`).emit("follow:request", { follower })
}

export const emitFollowAccepted = (following, follower) => {
    const io = getIO()
    io.to(`user_${follower.id}`).emit("follow:accepted", { following })
}

export const emitFollowRejected = (following, follower) => {
    const io = getIO()
    io.to(`user_${follower.id}`).emit("follow:rejected", { following })
}