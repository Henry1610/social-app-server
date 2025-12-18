import EventEmitter from "events";
import {
  handleFollowCompleted,
  handleFollowRequestSent,
  handleFollowRequestAccepted,
  handleFollowRequestRejected
} from "./handlers/followEventHandlers.js";

// Tạo EventEmitter instance
export const followEvents = new EventEmitter();

// Đăng ký các event handlers
followEvents.on("follow_completed", handleFollowCompleted);
followEvents.on("follow_request_sent", handleFollowRequestSent);
followEvents.on("follow_request_accepted", handleFollowRequestAccepted);
followEvents.on("follow_request_rejected", handleFollowRequestRejected);