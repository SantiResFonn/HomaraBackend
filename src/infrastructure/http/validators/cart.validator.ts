import { z } from "zod";
import { cuidValidator } from "./common.validator.js";

export const addItemSchema = z.object({
  productId: cuidValidator("ID de producto inválido"),
  quantity: z.number().int("Cantidad debe ser un número entero").min(1, "Cantidad debe ser al menos 1").max(9999).default(1),
});

export const updateItemQuantitySchema = z.object({
  quantity: z.number().int("Cantidad debe ser un número entero").min(1, "Cantidad debe ser al menos 1").max(9999),
});
