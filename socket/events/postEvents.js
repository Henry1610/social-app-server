import EventEmitter from "events";
import {
  handleCommentCreated,
  handleRepostCreated,
  handleReactionCreated,
  handleReplyCreated
} from "./handlers/postEventHandlers.js";

// Tạo EventEmitter instance
export const postEvents = new EventEmitter();

// Đăng ký các event handlers
postEvents.on("comment_created", handleCommentCreated);
postEvents.on("repost_created", handleRepostCreated);
postEvents.on("reaction_created", handleReactionCreated);
postEvents.on("reply_created", handleReplyCreated);

