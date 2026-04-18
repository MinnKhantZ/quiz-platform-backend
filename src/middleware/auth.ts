import { Request, Response, NextFunction } from "express";
import { verifyToken } from "../utils/jwt.js";
import { AppError } from "./errorHandler.js";
import prisma from "../config/db.js";
import { Role } from "@prisma/client";

export async function authenticate(req: Request, res: Response, next: NextFunction): Promise<void> {
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
    if (err instanceof AppError) return next(err);
    next(new AppError("Invalid or expired token", 401));
  }
}

export function requireRole(...roles: Role[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user || !roles.includes(req.user.role)) {
      return next(new AppError("Insufficient permissions", 403));
    }
    next();
  };
}
