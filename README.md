# 🚀 Social App Backend Server

Backend server cho ứng dụng mạng xã hội, được xây dựng với Node.js, Express, Prisma, PostgreSQL, Socket.io, và các dịch vụ tích hợp như Cloudinary, Resend, Redis, Twilio.

## 📑 Table of Contents

- [Tech Stack](#-tech-stack)
- [Prerequisites](#-prerequisites)
- [Installation](#-installation)
- [Running the Server](#-running-the-server)
- [Project Structure](#-project-structure)
- [API Endpoints](#-api-endpoints)
- [Authentication Flow](#-authentication-flow)
- [Database & Prisma](#-database--prisma)
- [Socket.io Events](#-socketio-events)
- [Deployment](#-deployment)
- [Contributing](#-contributing)
- [License](#-license)

## 🚀 Tech Stack

- **Runtime**: Node.js (ES Modules)
- **Framework**: Express.js 5.x
- **Database**: PostgreSQL + Prisma ORM
- **Authentication**: JWT (Access & Refresh Token), Passport.js (Facebook OAuth)
- **Real-time**: Socket.io
- **Cache / Session Store**: Redis (ioredis)
- **File Upload**: Cloudinary + Multer
- **Email**: Resend
- **SMS**: Twilio
- **Session**: express-session

## 📋 Prerequisites

- Node.js v18+
- PostgreSQL v14+
- Redis (optional nhưng recommended)
- npm hoặc yarn

## 🔧 Installation

### 1. Clone repo và cd vào server

```bash
git clone <repo-url>
cd server
```

### 2. Cài đặt dependencies

```bash
npm install
```

### 3. Tạo file `.env`

Tạo file `.env` trong thư mục `server/` với nội dung:

```env
PORT=5000
NODE_ENV=development
SERVER_URL=http://localhost:5000

DATABASE_URL="postgresql://user:password@localhost:5432/social_app?schema=public"

JWT_SECRET=your-jwt-secret
JWT_REFRESH_SECRET=your-jwt-refresh-secret

SESSION_SECRET=your-session-secret
CLIENT_URL=http://localhost:3000

REDIS_URL=redis://localhost:6379

CLOUDINARY_CLOUD_NAME=your-cloud
CLOUDINARY_API_KEY=your-api-key
CLOUDINARY_API_SECRET=your-api-secret

RESEND_API_KEY=your-resend-api-key
EMAIL_FROM=onboarding@resend.dev

TWILIO_ACCOUNT_SID=your-sid
TWILIO_AUTH_TOKEN=your-token
TWILIO_PHONE_NUMBER=your-phone

FACEBOOK_APP_ID=your-id
FACEBOOK_APP_SECRET=your-secret
FACEBOOK_CALLBACK_URL=/api/auth/facebook/callback
```

### 4. Setup database

```bash
npx prisma generate
npx prisma migrate deploy
# optional seed
npx prisma db seed
```

## 🏃 Running the Server

### Development

```bash
npm start
```

Hoặc với nodemon (auto-reload):

```bash
npx nodemon index.js
```

### Production

```bash
NODE_ENV=production npm start
```

## 📁 Project Structure

```
server/
├── config/             
│   ├── cloudinary.js       
│   ├── passport.js         
│   └── socket.js           
├── controllers/        
│   ├── authController.js
│   └── user/
├── middlewares/        
│   ├── authenticate.js
│   ├── authorize.js
│   ├── rateLimiters.js
│   ├── resolveUser.js
│   └── upload.js
├── routes/            
│   ├── auth.routes.js
│   ├── user.routes.js
│   └── user/
├── services/          
│   ├── redis/
│   └── ...
├── socket/            
│   ├── events/
│   └── handlers/
├── utils/             
│   ├── cache.js
│   ├── mailer.js
│   ├── prisma.js
│   ├── sms.js
│   └── token.js
├── prisma/
│   ├── schema.prisma
│   └── migrations/
└── index.js           
```

## 🔌 API Endpoints

### Auth — `/api/auth`

- `POST /api/auth/send-otp` - Gửi OTP
- `POST /api/auth/verify-otp-register` - Xác thực OTP và đăng ký
- `POST /api/auth/login` - Đăng nhập
- `POST /api/auth/refresh-token` - Làm mới access token
- `POST /api/auth/logout` - Đăng xuất
- `POST /api/auth/change-password` - Đổi mật khẩu
- `POST /api/auth/forgot-password` - Quên mật khẩu
- `POST /api/auth/reset-password` - Đặt lại mật khẩu
- `GET /api/auth/facebook` - Facebook OAuth login
- `GET /api/auth/facebook/callback` - Facebook OAuth callback
- `GET /api/auth/session-auth` - Lấy auth data từ session

### User — `/api/user` (yêu cầu JWT Auth)

- `/api/user/posts/*` - Quản lý posts
- `/api/user/comments/*` - Quản lý comments
- `/api/user/reactions/*` - Quản lý reactions
- `/api/user/reposts/*` - Quản lý reposts
- `/api/user/follows/*` - Quản lý follow
- `/api/user/profile/*` - Quản lý profile
- `/api/user/chat/*` - Chat features
- `/api/user/notifications/*` - Notifications
- `/api/user/search/*` - Search features
- `/api/user/upload/*` - File upload

## 🔐 Authentication Flow

1. User đăng ký/login → server trả Access Token + Refresh Token
2. Client gửi request với header: `Authorization: Bearer <access_token>`
3. Khi access token hết hạn → client gọi `/api/auth/refresh-token`
4. Facebook OAuth dùng Passport.js + session, sau đó convert sang JWT

## 🗄️ Database & Prisma

### Prisma Commands

```bash
# Xem database schema
npx prisma studio

# Tạo migration mới
npx prisma migrate dev --name migration_name

# Apply migrations (production)
npx prisma migrate deploy

# Reset database (development only)
npx prisma migrate reset
```

## 🔌 Socket.io Events

Server hỗ trợ real-time communication qua Socket.io:

- **Chat**: Gửi & nhận tin nhắn, typing indicators
- **Notifications**: Realtime events
- **Follow**: Cập nhật trạng thái theo dõi ngay lập tức

## 🚀 Deployment

### Production Checklist

- [ ] Set `NODE_ENV=production`
- [ ] Set JWT & Session secret mạnh
- [ ] Set `CLIENT_URL` đúng domain
- [ ] Setup PostgreSQL + Redis
- [ ] Chạy `npx prisma migrate deploy`
- [ ] Cấu hình HTTPS + reverse proxy (Nginx)
- [ ] Set trust proxy (cần cho Cookie + OAuth)

### Deploy lên Render / Railway / Heroku

1. Connect repository
2. Set environment variables
3. Set build command: `npm install && npx prisma generate`
4. Set start command: `npm start`
5. Deploy!

## 🤝 Contributing

1. Fork repo
2. Tạo branch mới
3. Commit thay đổi
4. Tạo Pull Request

## 📄 License

ISC
