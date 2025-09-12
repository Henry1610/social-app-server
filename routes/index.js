import authRoutes from './auth.routes.js'
import postRoutes from './user.routes.js'
import repostRoutes from './user/repost.routes.js'
function route(app){
    app.use("/api/auth",authRoutes);
    app.use("/api/user",postRoutes);
    app.use("/api/user",repostRoutes);
}
export default route;