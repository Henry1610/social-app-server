import prisma from "../../utils/prisma.js";

// GET api/user/comments/posts/:id 
export const getCommentsByPost = async (req, res) => {
    try {
      const { id } = req.params;
      const { 
        page = 1, 
        limit = 20,
        sortBy = 'desc' // 'desc' (mới nhất) hoặc 'asc' (cũ nhất)
      } = req.query;
  
      // Kiểm tra post có tồn tại không
      const postExists = await prisma.post.findFirst({
        where: {
          id: Number(id),
          deletedAt: null
        },
        select: { id: true }
      });
  
      if (!postExists) {
        return res.status(404).json({
          success: false,
          message: 'Bài viết không tồn tại hoặc đã bị xóa!'
        });
      }
  
      const skip = (Number(page) - 1) * Number(limit);
  
      // Lấy comments với pagination
      const [comments, totalComments] = await Promise.all([
        prisma.comment.findMany({
          where: { 
            postId: Number(id), 
            deletedAt: null 
          },
          include: {
            user: {
              select: { id: true, username: true, fullName: true, avatarUrl: true }
            },
            _count: { 
              select: { 
                replies: true,   // đếm số reply
                mentions: true   // đếm số mention
              } 
            }
          },
          orderBy: { createdAt: sortBy },
          skip: skip,
          take: Number(limit)
        }),
        // Đếm tổng số comments
        prisma.comment.count({
          where: { 
            postId: Number(id), 
            deletedAt: null 
          }
        })
      ]);
  
      // Metadata cho pagination
      const totalPages = Math.ceil(totalComments / Number(limit));
      const hasNextPage = Number(page) < totalPages;
      const hasPrevPage = Number(page) > 1;
  
      res.json({
        success: true,
        comments,
        pagination: {
          currentPage: Number(page),
          limit: Number(limit),
          totalComments,
          totalPages,
          hasNextPage,
          hasPrevPage
        }
      });
  
    } catch (error) {
      console.error('Error getting comments:', error);
      res.status(500).json({
        success: false,
        message: 'Lỗi server khi lấy bình luận!'
      });
    }
  };
// POST api/user/comments/posts/:id 
export const commentPost= async(req,res)=>{
    try {
        const {id}=req.params;
        const {content}=req.body;
        const userId=req.user.id;

        // Kiểm tra bài viết có tồn tại không
        const postExists=await prisma.post.findFirst({
            where:{
                id:Number(id),
                deletedAt:null
            },
            select:{id:true}
        });
        if(!postExists){
            return res.status(404).json({
                success:false,
                message:'Bài viết không tồn tại hoặc đã bị xóa!'
            });
        }
        // Tạo bình luận mới
        const newComment=await prisma.comment.create({
            data:{
                content,
                postId:Number(id),
                userId:userId
            },
            include:{
                user:{
                    select:{id:true,username:true,fullName:true,avatarUrl:true}
                },
                _count:{
                    select:{
                        replies:true,
                        mentions:true
                    }
                }
            }
        });
        res.status(201).json({
            success:true,
            message:'Bình luận đã được thêm!',
            comment:newComment
        });
    } catch (error) {
        console.error('Error commenting on post:',error);
        res.status(500).json({
            success:false,
            message:'Lỗi server khi thêm bình luận!'
        });
    }
}
// PATCH api/user/comments/posts/:id 
export const editComment= async(req,res)=>{
    const {id}=req.params;
    const {content}=req.body;
    const userId=req.user.id;
    try {
        // Kiểm tra bình luận có tồn tại và thuộc về user
        const commentExists=await prisma.comment.findFirst({
            where:{
                id:Number(id),
                userId:userId,
                deletedAt:null
            },
            select:{id:true}
        });
        if(!commentExists){
            return res.status(404).json({
                success:false,
                message:'Bình luận không tồn tại hoặc bạn không có quyền sửa!'
            });
        }
        // Cập nhật bình luận
        const updatedComment=await prisma.comment.update({
            where:{id:Number(id)},
            data:{content},
            include:{
                user:{
                    select:{id:true,username:true,fullName:true,avatarUrl:true}
                },
                _count:{
                    select:{
                        replies:true,
                        mentions:true
                    }
                }
            }
        });
        res.json({
            success:true,
            message:'Bình luận đã được cập nhật!',
            comment:updatedComment
        });
    } catch (error) {
        console.error('Error editing comment:',error);
        res.status(500).json({
            success:false,
            message:'Lỗi server khi sửa bình luận!'
        });
    }
}
// DELETE api/user/comments/posts/:id 
export const deleteComment= async(req,res)=>{
    const {id}=req.params;
    const userId=req.user.id;
    try {
        // Kiểm tra bình luận có tồn tại và thuộc về user
        const commentExists=await prisma.comment.findFirst({
            where:{
                id:Number(id),
                userId:userId,
                deletedAt:null
            },
            select:{id:true}
        });
        if(!commentExists){
            return res.status(404).json({
                success:false,
                message:'Bình luận không tồn tại hoặc bạn không có quyền xóa!'
            });
        }
        // Xóa bình luận (soft delete)
        await prisma.comment.update({
            where:{id:Number(id)},
            data:{deletedAt:new Date()}
        });
        res.json({
            success:true,
            message:'Bình luận đã được xóa!'
        });
    } catch (error) {
        console.error('Error deleting comment:',error);
        res.status(500).json({
            success:false,
            message:'Lỗi server khi xóa bình luận!'
        });
    }
}