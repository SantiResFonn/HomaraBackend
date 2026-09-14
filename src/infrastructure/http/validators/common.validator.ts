// ============================================
// Homara — Common HTTP Validators (TS)
// ============================================

import { z } from "zod";

/**
 * Esquema para validar parámetros de ruta con un 'id' en formato CUID.
 */
export const cuidParamSchema = z.object({
  id: z.cuid({ message: "El ID proporcionado debe ser un formato CUID válido." }),
});

/**
 * Esquema para validar parámetros de ruta con un 'itemId' en formato CUID (específico de ítems de carrito).
 */
export const itemIdParamSchema = z.object({
  itemId: z.cuid({ message: "El ID de ítem proporcionado debe ser un formato CUID válido." }),
});

/**
 * Esquema para filtrar listados de proyectos.
 */
export const listProjectsQuerySchema = z.object({
  userId: z.cuid({ message: "El ID de usuario de consulta debe ser un formato CUID válido." }).optional(),
});

/**
 * Esquema para filtrar listados de pedidos.
 */
export const listOrdersQuerySchema = z.object({
  userId: z.cuid({ message: "El ID de usuario de consulta debe ser un formato CUID válido." }).optional(),
  admin: z
    .enum(["true", "false"], { message: "El parámetro admin debe ser 'true' o 'false'" })
    .transform((val) => val === "true")
    .optional(),
});
