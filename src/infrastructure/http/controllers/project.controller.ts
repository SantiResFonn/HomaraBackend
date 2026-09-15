import { Request, Response, NextFunction } from "express";
import { PrismaProjectRepository } from "../../database/repositories/prisma-project.repository.js";
import { PrismaProductRepository } from "../../database/repositories/prisma-product.repository.js";
import { ListUserProjectsUseCase, GetProjectUseCase, CreateProjectUseCase, UpdateProjectUseCase, DeleteProjectUseCase } from "../../../application/use-cases/project.use-cases.js";

import { IProjectRepository } from "../../../domain/repositories/project-repository.interface.js";
import { IProductRepository } from "../../../domain/repositories/product-repository.interface.js";

const projectRepository: IProjectRepository = new PrismaProjectRepository();
const productRepository: IProductRepository = new PrismaProductRepository();

const listUserProjectsUseCase = new ListUserProjectsUseCase(projectRepository);
const getProjectUseCase = new GetProjectUseCase(projectRepository);
const createProjectUseCase = new CreateProjectUseCase(projectRepository, productRepository);
const updateProjectUseCase = new UpdateProjectUseCase(projectRepository, productRepository);
const deleteProjectUseCase = new DeleteProjectUseCase(projectRepository);

export class ProjectController {
  static async list(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.id || (req.query.userId as string);
      if (!userId) {
        return res.json({ success: true, data: [] });
      }
      const result = await listUserProjectsUseCase.execute(userId);
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  static async getDetail(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await getProjectUseCase.execute(req.params.id as string);
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  static async create(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.id;
      const result = await createProjectUseCase.execute({
        ...req.body,
        userId
      });
      res.status(201).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  static async update(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.id;
      const result = await updateProjectUseCase.execute(req.params.id as string, userId, req.body);
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  static async delete(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.id;
      await deleteProjectUseCase.execute(req.params.id as string, userId);
      res.json({ success: true, message: "Proyecto eliminado" });
    } catch (error) {
      next(error);
    }
  }
}
