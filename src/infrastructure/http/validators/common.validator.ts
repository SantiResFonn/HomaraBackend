// ============================================
// Homara — Common HTTP Validators (TS)
// ============================================

import { z } from "zod";

export const CUID_REGEX = /^c[^\s-]{8,}$/i;

export const cuidValidator = (message = "El ID proporcionado debe ser un formato CUID válido.") =>
  z.string().regex(CUID_REGEX, { message });

/**
 * Esquema para validar parámetros de ruta con un 'id' en formato CUID.
 */
export const cuidParamSchema = z.object({
  id: cuidValidator(),
});

/**
 * Esquema para validar parámetros de ruta con un 'itemId' en formato CUID (específico de ítems de carrito).
 */
export const itemIdParamSchema = z.object({
  itemId: cuidValidator("El ID de ítem proporcionado debe ser un formato CUID válido."),
});

/**
 * Esquema para filtrar listados de proyectos.
 */
export const listProjectsQuerySchema = z.object({
  userId: cuidValidator("El ID de usuario de consulta debe ser un formato CUID válido.").optional(),
});

/**
 * Esquema para filtrar listados de pedidos.
 */
export const listOrdersQuerySchema = z.object({
  userId: cuidValidator("El ID de usuario de consulta debe ser un formato CUID válido.").optional(),
  admin: z
    .enum(["true", "false"], { message: "El parámetro admin debe ser 'true' o 'false'" })
    .transform((val) => val === "true")
    .optional(),
});
