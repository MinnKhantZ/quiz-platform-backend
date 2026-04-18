# Quiz Platform Backend

The Express.js/Node.js backend for the Quiz Platform, powered by Prisma ORM and Socket.io.

## Features

- **Real-time Engine**: Powered by Socket.io for synchronous quiz sessions and leaderboard updates.
- **Data Modeling**: Comprehensive entity relations for Quizzes, Questions, Answers, Results, and Users.
- **Identity & Security**: Role-based access (Teacher/Student) with JWT-based authentication.
- **REST API**: Full-featured API for question management and quiz analytics.
- **File Handling**: Support for image uploads in questions with Multer.
- **Type-safe Logic**: Comprehensive data validation using Zod.

## Prerequisites

- **Node.js**: v18.0.0 or higher
- **PostgreSQL**: Required for storage
- **npm**: v9.0.0 or higher

## Environment Variables

Create a `.env` file in the `quiz-platform-backend` directory:

```env
DATABASE_URL="postgresql://user:password@localhost:5432/quiz_db"
JWT_SECRET="your_jwt_secret_here"
JWT_EXPIRES_IN="7d"
PORT=3000
CORS_ORIGIN="http://localhost:5173"
UPLOAD_DIR="uploads"
```

## Installation & Setup

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Database
Ensure PostgreSQL is running, then apply migrations or push current schema:

```bash
# Push database schema directly (for development)
npm run db:push

# Or, run migrations (for production)
npm run db:migrate
```

### 3. Start the Server
```bash
# Run in development mode (with nodemon)
npm run dev

# Run in production mode
npm start
```

## Available Scripts

- `npm run dev`: Starts the server in development mode.
- `npm run start`: Starts the production server.
- `npm run db:migrate`: Generates and applies Prisma migrations.
- `npm run db:push`: Pushes schema changes directly to the database.
- `npm run db:seed`: Populates the database with initial data (requires `prisma/seed.js`).
- `npm run db:studio`: Opens Prisma Studio to visualize your data.
- `npm test`: Runs all Vitest unit and integration tests.

## API Documentation

- **Auth**: `/api/auth` (Register, Login, Me)
- **Quizzes**: `/api/quizzes` (CRUD, List)
- **Questions**: `/api/quizzes/:quizId/questions` (CRUD)
- **Attempts**: `/api/quizzes/:quizId/attempts` (Taking/Submitting)
- **Leaderboard**: `/api/quizzes/:quizId/leaderboard` (Live/Historical)
- **Uploads**: `/api/upload` (Image upload)

## Tech Stack

- **Framework**: Express.js
- **ORM**: Prisma
- **Real-time**: Socket.io
- **Database**: PostgreSQL
- **Validation**: Zod
- **Testing**: Vitest
