import bcrypt from "bcrypt";
import prisma from "../config/db.js";
import { generateToken } from "../utils/jwt.js";
import { AppError } from "../middleware/errorHandler.js";

const SALT_ROUNDS = 12;

export async function register({ email, password, name, role }) {
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    throw new AppError("Email already registered", 409);
  }

  const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);

  const user = await prisma.user.create({
    data: { email, password: hashedPassword, name, role },
    select: { id: true, email: true, name: true, role: true },
  });

  const token = generateToken({ id: user.id, role: user.role });

  return { user, token };
}

export async function login({ email, password }) {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    throw new AppError("Invalid email or password", 401);
  }

  const valid = await bcrypt.compare(password, user.password);
  if (!valid) {
    throw new AppError("Invalid email or password", 401);
  }

  const token = generateToken({ id: user.id, role: user.role });

  return {
    user: { id: user.id, email: user.email, name: user.name, role: user.role },
    token,
  };
}

export async function getMe(userId) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, name: true, role: true, createdAt: true },
  });
  if (!user) throw new AppError("User not found", 404);
  return user;
}
