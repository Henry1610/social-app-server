import prisma from "../../utils/prisma.js";

// POST api/user/follow/:id
export const followUser = async (req, res) => {
    const {id}=req.params;
    const userId=req.user.id;

    try {
        // Kiểm tra người dùng muốn follow có tồn tại không
        const userToFollow=await prisma.user.findUnique({
            where:{id:Number(id)},
            select:{id:true}
        });
        if(!userToFollow){
            return res.status(404).json({
                success:false,
                message:'Người dùng không tồn tại!'
            });
        }
        // Kiểm tra đã follow chưa
        const alreadyFollowing=await prisma.follow.findFirst({
            where:{
                followerId:userId,
                followingId:Number(id)
            },
            select: { followerId: true, followingId: true }
        });
        if(alreadyFollowing){
            return res.status(400).json({
                success:false,
                message:'Bạn đã theo dõi người dùng này!'
            });
        }
        // Tạo follow mới
        await prisma.follow.create({
            data:{
                followerId:userId,
                followingId:Number(id)
            }
        });
        res.status(201).json({
            success:true,
            message:'Bạn đã theo dõi người dùng!'
        });
    } catch (error) {   
        console.error('Error following user:',error);
        res.status(500).json({
            success:false,
            message:'Lỗi server khi theo dõi người dùng!'
        });
    }
  };

// DELETE api/user/follow/:id
export const unfollowUser = async(req,res)=>{
    const {id}=req.params;
    const userId=req.user.id;
    try {
        // Kiểm tra người dùng muốn unfollow có tồn tại không
        const userToUnfollow=await prisma.user.findUnique({
            where:{id:Number(id)},
            select:{id:true}
        });
        if(!userToUnfollow){
            return res.status(404).json({
                success:false,
                message:'Người dùng không tồn tại!'
            });
        }
        // Kiểm tra đã follow chưa
        const alreadyFollowing = await prisma.follow.findUnique({
            where: {
              followerId_followingId: {
                followerId: userId,
                followingId: Number(id),
              },
            },
          });
        if(!alreadyFollowing){
            return res.status(400).json({
                success:false,
                message:'Bạn chưa theo dõi người dùng này!'
            });
        }
        // Xóa follow
        await prisma.follow.delete({
            where: {
              followerId_followingId: {
                followerId: userId,
                followingId: Number(id),
              },
            },
          });
        res.json({
            success:true,
            message:'Bạn đã hủy theo dõi người dùng!'
        });
    } catch (error) {
        console.error('Error unfollowing user:',error);
        res.status(500).json({
            success:false,
            message:'Lỗi server khi hủy theo dõi người dùng!'
        });
    }
}

// GET api/user/follow/followers
export const getMyFollowers = async(req,res)=>{
    const userId=req.user.id;
    try {
        // Lấy danh sách followers
        const followers=await prisma.follow.findMany({
            where:{followingId:userId},
            select:{
                follower:{
                    select:{id:true,username:true,fullName:true,avatarUrl:true}
                },
                createdAt:true
            },
            orderBy:{createdAt:'desc'}
        });
        res.json({
            success:true,
            followers:followers.map(f=>f.follower)
        });
    } catch (error) {
        console.error('Error getting followers:',error);
        res.status(500).json({
            success:false,
            message:'Lỗi server khi lấy danh sách người theo dõi!'
        });
    }
}

// GET api/user/follow/following
export const getMyFollowings= async(req,res)=>{
    const userId=req.user.id;
    try {
        // Lấy danh sách followings
        const followings=await prisma.follow.findMany({
            where:{followerId:userId},
            select:{
                following:{
                    select:{id:true,username:true,fullName:true,avatarUrl:true}
                },
                createdAt:true
            },
            orderBy:{createdAt:'desc'}
        });
        res.json({
            success:true,
            followings:followings.map(f=>f.following)
        });
    } catch (error) {
        console.error('Error getting followings:',error);
        res.status(500).json({
            success:false,
            message:'Lỗi server khi lấy danh sách đang theo dõi!'
        });
    }
}