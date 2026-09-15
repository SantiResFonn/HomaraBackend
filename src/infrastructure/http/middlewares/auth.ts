import { Request, Response, NextFunction } from "express";
import { verifyToken } from "../../../shared/utils/authHelper.js";
import { PrismaUserRepository } from "../../database/repositories/prisma-user.repository.js";
import { IUserRepository } from "../../../domain/repositories/user-repository.interface.js";
import { AppError } from "../../../shared/errors/AppError.js";
import jwt from "jsonwebtoken";

const { TokenExpiredError, JsonWebTokenError } = jwt;

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email: string;
        role: string;
        firstName?: string;
        lastName?: string;
      };
    }
  }
}

const userRepository: IUserRepository = new PrismaUserRepository();

// Costura de pruebas: permite inyectar un repositorio falso sin tocar la base de datos.
function toRequestUser(user: {
  id: string;
  email: string;
  role?: string;
  firstName?: string | null;
  lastName?: string | null;
}) {
  return {
    id: user.id,
    email: user.email,
    role: user.role!,
    firstName: user.firstName ?? undefined,
    lastName: user.lastName ?? undefined,
  };
}

function extractToken(authHeader: string | undefined): string {
  if (!authHeader?.startsWith("Bearer ")) {
    throw new AppError("Token no provisto.", 401);
  }
  return authHeader.split(" ")[1];
}

function forwardAuthError(error: unknown, next: NextFunction) {
  if (error instanceof AppError || error instanceof TokenExpiredError || error instanceof JsonWebTokenError) {
    return next(error);
  }
  next(new AppError("Error durante la autenticación.", 500));
}

async function authenticateUser(req: Request, token: string) {
  const decoded = verifyToken(token);
  const user = await userRepository.findById(decoded.id);

  if (!user) {
    throw new AppError("Usuario no encontrado o dado de baja.", 401);
  }

  req.user = toRequestUser(user);
}

export async function requireAuth(_req: Request, _res: Response, next: NextFunction) {
  try {
    const token = extractToken(_req.headers.authorization);
    await authenticateUser(_req, token);
    next();
  } catch (error) {
    forwardAuthError(error, next);
  }
}

export async function requireAdmin(req: Request, _res: Response, next: NextFunction) {
  try {
    const token = extractToken(req.headers.authorization);
    await authenticateUser(req, token);

    if (req.user?.role !== "ADMIN") {
      throw new AppError("Acceso denegado. Se requieren permisos de administrador.", 403);
    }

    next();
  } catch (error) {
    forwardAuthError(error, next);
  }
}

export async function optionalAuth(req: Request, _res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.split(" ")[1];
    try {
      const decoded = verifyToken(token);
      const user = await userRepository.findById(decoded.id);
      if (user) {
        req.user = toRequestUser(user);
      }
    } catch (error) {
      if (!(error instanceof TokenExpiredError) && !(error instanceof JsonWebTokenError)) {
        console.debug("optionalAuth: non-JWT error ignored", error);
      }
    }
  }
  next();
}
