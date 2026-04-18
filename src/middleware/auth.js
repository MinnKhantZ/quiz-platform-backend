import { verifyToken } from "../utils/jwt.js";
import { AppError } from "./errorHandler.js";
import prisma from "../config/db.js";

export async function authenticate(req, res, next) {
  try {
    const header = req.headers.authorization;
    if (!header || !header.startsWith("Bearer ")) {
      throw new AppError("Authentication required", 401);
    }

    const token = header.split(" ")[1];
    const decoded = verifyToken(token);

    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
      select: { id: true, email: true, name: true, role: true },
    });

    if (!user) {
      throw new AppError("User not found", 401);
    }

    req.user = user;
    next();
  } catch (err) {
    if (err.isOperational) return next(err);
    next(new AppError("Invalid or expired token", 401));
  }
}

export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return next(new AppError("Insufficient permissions", 403));
    }
    next();
  };
}
