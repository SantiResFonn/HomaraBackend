// F-ADM-02 · Gestión de productos
// Unidad: CreateProductUseCase.execute() y UpdateProductUseCase.execute()  (POST y PUT /api/v1/products)

import { vi, beforeEach } from "vitest";
import { test, is, eq, ok, subset, grab, expect } from "./harness.js";
import { fakeProductos, producto, datosProducto, contextoExpress, errorDeNext, usuario } from "./helpers.js";
import { mockUsuarios, reiniciarRepositorios } from "./mocks/repositorios.js";
import jwt from "jsonwebtoken";
import { requireAdmin } from "../src/infrastructure/http/middlewares/auth.js";
import { CreateProductUseCase, UpdateProductUseCase } from "../src/application/use-cases/catalog.use-cases.js";
import { createProductSchema, updateProductSchema } from "../src/infrastructure/http/validators/catalog.validator.js";
import { AppError } from "../src/shared/errors/AppError.js";

const SECRETO = process.env.JWT_SECRET || "homara_jwt_secret_key_2026_secure";
const tokenDe = (payload: object) => jwt.sign(payload, SECRETO, { expiresIn: "7d" });

function montar() {
  const repo = fakeProductos();
  const crear = new CreateProductUseCase(repo as any);
  const actualizar = new UpdateProductUseCase(repo as any);
  return { repo, crear, actualizar };
}

// `requireAdmin` re-consulta el usuario en la base: se mockea el repositorio
// que el middleware construye al importarse.
vi.mock("../src/infrastructure/database/repositories/prisma-user.repository.js", async () => {
  const { mockUsuarios } = await import("./mocks/repositorios.js");
  return { PrismaUserRepository: vi.fn(() => mockUsuarios) };
});

beforeEach(reiniciarRepositorios);

test("CP-F-ADM-02-01", "Rechaza con 403 a usuarios con rol CUSTOMER antes de modificar productos", async () => {
  // Arrange
  const { repo } = montar();
  mockUsuarios.findById.mockResolvedValue(usuario({ role: "CUSTOMER" }));
  const { req, res, next } = contextoExpress(
    `Bearer ${tokenDe({ id: "usr_001", email: "ana@homara.com", role: "ADMIN" })}`,
  );

  // Act
  await requireAdmin(req, res, next);

  // Assert
  const error = errorDeNext(next);
  ok(error instanceof AppError);
  is(error.statusCode, 403);
  is(error.message, "Acceso denegado. Se requieren permisos de administrador.");
  expect(repo.create).not.toHaveBeenCalled();
  expect(repo.update).not.toHaveBeenCalled();
});

test("CP-F-ADM-02-02", "Rechaza campos inválidos (precio negativo, stock negativo, nombre vacío) en validación", () => {
  // Arrange
  const { repo } = montar();

  // Act
  const precioNegativo = createProductSchema.safeParse(datosProducto({ price: -1 }));
  const stockNegativo = createProductSchema.safeParse(datosProducto({ stockQuantity: -5 }));
  const sinNombre = createProductSchema.safeParse(datosProducto({ name: "" }));
  const parcheConPrecioNegativo = updateProductSchema.safeParse({ price: -1 });

  // Assert
  is(precioNegativo.success, false);
  if (!precioNegativo.success) is(precioNegativo.error.issues[0].message, "El precio no puede ser negativo.");
  is(stockNegativo.success, false);
  if (!stockNegativo.success) is(stockNegativo.error.issues[0].message, "El stock no puede ser negativo.");
  is(sinNombre.success, false);
  if (!sinNombre.success) is(sinNombre.error.issues[0].message, "El nombre es obligatorio y no puede estar vacío.");
  is(parcheConPrecioNegativo.success, false);
  expect(repo.create).not.toHaveBeenCalled();
  expect(repo.update).not.toHaveBeenCalled();
});

test("CP-F-ADM-02-03", "Retorna 404 al intentar actualizar un producto que no existe", async () => {
  // Arrange
  const { repo, actualizar } = montar();
  repo.findById.mockResolvedValue(null);

  // Act
  const error = await grab(actualizar.execute("prd_borrado", { price: 45000 }));

  // Assert
  ok(error instanceof AppError);
  is(error.message, "Producto no encontrado");
  expect(repo.findById).toHaveBeenCalledWith("prd_borrado");
  expect(repo.update).not.toHaveBeenCalled();
});

// Defecto abierto #12 (ver la tabla en tests/README.md): se espera que falle.
test.fails("CP-F-ADM-02-04", "Crea producto nuevo con valores derivados y valida precio mayor a 0", async () => {
  // Arrange
  const { repo, crear } = montar();
  repo.create.mockImplementation(async (p: any) => producto({ ...p, id: "prd_nuevo" }));
  const sinExistencias = datosProducto({ stockQuantity: 0 });

  // Act — se captura lo guardado antes de rearmar el doble para el 2º escenario.
  const salida = await crear.execute(datosProducto() as any);
  const guardado = repo.create.mock.calls[0][0];

  repo.create.mockReset();
  repo.create.mockImplementation(async (p: any) => producto({ ...p, id: "prd_nuevo" }));
  const validacionSinExistencias = createProductSchema.safeParse(sinExistencias);
  await crear.execute(sinExistencias as any);
  const guardadoSinExistencias = repo.create.mock.calls[0][0];

  const precioCero = createProductSchema.safeParse(datosProducto({ price: 0 }));

  // Assert
  is(guardado.inStock, true);
  is(guardado.image, "/products/placeholder.jpg");
  is(guardado.rating, 0);
  is(guardado.reviewCount, 0);
  is(guardado.originalPrice, null);
  eq(guardado.tags, []);
  is(salida.id, "prd_nuevo");
  is(salida.name, "Cemento Gris 50 kg");
  is(validacionSinExistencias.success, true);
  is(guardadoSinExistencias.stockQuantity, 0);
  is(guardadoSinExistencias.inStock, false);
  // DEFECTO: el esquema del servidor acepta precio 0 cuando debería exigir precio > 0 (RF32)
  is(precioCero.success, false);
});

// Defecto abierto #13 (ver la tabla en tests/README.md): se espera que falle.
test.fails("CP-F-ADM-02-05", "Aplica parche parcial en actualización y actualiza inStock si stockQuantity llega a 0", async () => {
  // Arrange
  const { repo, actualizar } = montar();
  repo.findById.mockResolvedValue(producto());
  repo.update.mockImplementation(async (id: string, d: any) => producto({ id, ...d }));

  // Act — se captura el parche antes de rearmar el doble para el 2º escenario.
  const salida = await actualizar.execute("prd_001", { price: 45000, stockQuantity: 30 });
  const parche = repo.update.mock.calls[0][1];

  repo.update.mockReset();
  repo.update.mockImplementation(async (id: string, d: any) => producto({ id, ...d }));
  await actualizar.execute("prd_001", { stockQuantity: 0 });
  const parcheSinExistencias = repo.update.mock.calls[0][1];

  // Assert
  is(parche.price, 45000);
  is(parche.stockQuantity, 30);
  ok(!("name" in parche));
  ok(!("description" in parche));
  ok(!("categoryId" in parche));
  is(salida.price, 45000);
  is(salida.name, "Piso Ceramico Beige 60x60");
  // DEFECTO: reducir existencias a 0 en PUT debería marcar inStock = false
  subset(parcheSinExistencias, { stockQuantity: 0, inStock: false });
});
