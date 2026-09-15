import { Request, Response, NextFunction } from "express";
import { PrismaUserRepository } from "../../database/repositories/prisma-user.repository.js";
import { RegisterUserUseCase, LoginUserUseCase, GetUserProfileUseCase } from "../../../application/use-cases/auth.use-cases.js";
import { prisma } from "../../database/prisma-client.js";
import { AppError } from "../../../shared/errors/AppError.js";
import { hashPassword } from "../../../shared/utils/authHelper.js";

import { IUserRepository } from "../../../domain/repositories/user-repository.interface.js";

const userRepository: IUserRepository = new PrismaUserRepository();
const registerUserUseCase = new RegisterUserUseCase(userRepository);
const loginUserUseCase = new LoginUserUseCase(userRepository);
const getUserProfileUseCase = new GetUserProfileUseCase(userRepository);
const db: any = prisma;
function formatUserProfile(user: any, projectCount: number, orderCount: number) {
  return {
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    phone: user.phone,
    address: user.address,
    city: user.city,
    state: user.state,
    zipCode: user.zipCode,
    role: user.role,
    projectCount,
    orderCount,
    createdAt: user.createdAt
  };
}

const DEMO_USER_ID = "demo-user-001";

export class AuthController {
  private static async getUserWithMetrics(userId: string) {
    const user = await getUserProfileUseCase.execute(userId);
    const [projectCount, orderCount] = await Promise.all([
      db.project.count({ where: { userId } }),
      db.order.count({ where: { userId } })
    ]);

    return formatUserProfile(user, projectCount, orderCount);
  }

  static async register(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await registerUserUseCase.execute(req.body);
      res.status(201).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  static async login(req: Request, res: Response, next: NextFunction) {
    try {
      const { email, password } = req.body;
      const result = await loginUserUseCase.execute(email, password);
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  static async getMe(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.id;
      const data = await AuthController.getUserWithMetrics(userId);
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  static async getById(req: Request, res: Response, next: NextFunction) {
    try {
      let userId = req.params.id as string;
      if (userId === "me") {
        userId = req.user ? req.user.id : DEMO_USER_ID;
      }

      const data = await AuthController.getUserWithMetrics(userId);
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  static async update(req: Request, res: Response, next: NextFunction) {
    try {
      let userId = req.params.id as string;
      if (userId === "me") {
        userId = req.user!.id;
      }

      if (userId !== req.user!.id && req.user!.role !== "ADMIN") {
        throw new AppError("No tienes permiso para modificar este perfil.", 403);
      }

      // Whitelist de campos permitidos — previene privilege escalation
      const { email, firstName, lastName, phone, address, city, state, zipCode, password } = req.body;
      const updateData: Record<string, unknown> = { email, firstName, lastName, phone, address, city, state, zipCode };

      // Si se envía contraseña, hashearla antes de guardar
      if (password) {
        updateData.password = await hashPassword(password);
      }

      const updated = await userRepository.update(userId, updateData);
      res.json({ success: true, data: updated });
    } catch (error) {
      next(error);
    }
  }
}
