import { z } from "zod";

export const registerSchema = z.object({
  email: z.email({ message: "Email inválido" }).min(5).max(255).transform((val) => val.toLowerCase().trim()),
  password: z.string().min(8, "La contraseña debe tener al menos 8 caracteres").max(128),
  firstName: z.string().min(1, "Nombre es requerido").max(100),
  lastName: z.string().min(1, "Apellido es requerido").max(100),
  phone: z.string().max(20).optional(),
  address: z.string().max(255).optional(),
  city: z.string().max(100).optional(),
  state: z.string().max(100).optional(),
  zipCode: z.string().max(20).optional(),
});

export const loginSchema = z.object({
  email: z.email({ message: "Email inválido" }).transform((val) => val.toLowerCase().trim()),
  password: z.string().min(1, "Contraseña es requerida").regex(/\S/, "Contraseña no puede ser solo espacios"),
});
