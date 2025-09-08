import authRoutes from './authRoutes.js'

function route(app){
    app.use("/api/auth",authRoutes)
}
export default route;