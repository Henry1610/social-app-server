// Helper function để tạo message cho thông báo
export const formatNotificationMessage = (notification) => {
  const { type, metadata, actor } = notification;
  
  // Nếu có metadata (thông báo đã gom nhóm)
  if (metadata && metadata.count > 1) {
    const { count, lastActorName, actorIds } = metadata;
    const actorName = actor?.username || lastActorName;
    
    switch (type) {
      case 'FOLLOW':
        if (count === 2) {
          return `${actorName} và 1 người khác đã theo dõi bạn.`;
        } else {
          return `${actorName} và ${count - 1} người khác đã theo dõi bạn.`;
        }
        
      case 'REACTION':
        if (count === 2) {
          return `${actorName} và 1 người khác đã thích bài viết của bạn.`;
        } else {
          return `${actorName} và ${count - 1} người khác đã thích bài viết của bạn.`;
        }
        
      case 'COMMENT':
        if (count === 2) {
          return `${actorName} và 1 người khác đã bình luận bài viết của bạn.`;
        } else {
          return `${actorName} và ${count - 1} người khác đã bình luận bài viết của bạn.`;
        }
        
      case 'REPOST':
        if (count === 2) {
          return `${actorName} và 1 người khác đã chia sẻ bài viết của bạn.`;
        } else {
          return `${actorName} và ${count - 1} người khác đã chia sẻ bài viết của bạn.`;
        }
        
      case 'REPLY':
        if (count === 2) {
          return `${actorName} và 1 người khác đã phản hồi bình luận của bạn.`;
        } else {
          return `${actorName} và ${count - 1} người khác đã phản hồi bình luận của bạn.`;
        }
        
      case 'FOLLOW_REQUEST':
        if (count === 2) {
          return `${actorName} và 1 người khác đã gửi yêu cầu theo dõi bạn.`;
        } else {
          return `${actorName} và ${count - 1} người khác đã gửi yêu cầu theo dõi bạn.`;
        }
        
      default:
        return `${actorName} và ${count - 1} người khác đã tương tác với bạn.`;
    }
  }
  
  // Thông báo đơn lẻ
  const actorName = actor?.username;
  
  switch (type) {
    case 'FOLLOW':
      return `${actorName} đã theo dõi bạn.`;
      
    case 'REACTION':
      return `${actorName} đã thích bài viết của bạn.`;
      
    case 'COMMENT':
      return `${actorName} đã bình luận bài viết của bạn.`;
      
    case 'REPLY':
      return `${actorName} đã phản hồi bình luận của bạn.`;
      
    case 'REPOST':
      return `${actorName} đã chia sẻ bài viết của bạn.`;
      
    case 'FOLLOW_REQUEST':
      return `${actorName} đã gửi yêu cầu theo dõi bạn.`;

    case 'FOLLOW_ACCEPTED':
      return `${actorName} đã chấp nhận yêu cầu theo dõi của bạn.`;

    case 'FOLLOW_REJECTED':
      return `${actorName} đã từ chối yêu cầu theo dõi của bạn.`;
      
    case 'MESSAGE':
      return `${actorName} đã gửi tin nhắn cho bạn.`;
      
    default:
      return `${actorName} đã tương tác với bạn.`;
  }
};



