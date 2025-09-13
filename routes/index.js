import authRoutes from './auth.routes.js'
import userRoutes from './user.routes.js'
import {authenticate}from '../middlewares/authenticate.js';
import {authorize} from '../middlewares/authorize.js';
function route(app){
    app.use("/api/auth",authRoutes);
    app.use("/api/user",authenticate,authorize('user'),userRoutes);
}
export default route;