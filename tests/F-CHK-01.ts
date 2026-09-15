// F-CHK-01 · Agregar un producto al carrito
// Unidad: AddCartItemUseCase.execute()  (POST /api/v1/cart/items)

import { test, is, eq, ok, has, expect, vi } from "./harness.js";
import { contextoExpress, errorDeNext } from "./helpers.js";
import { AddCartItemUseCase } from "../src/application/use-cases/cart.use-cases.js";
import { PrismaCartRepository } from "../src/infrastructure/database/repositories/prisma-cart.repository.js";
import { addItemSchema } from "../src/infrastructure/http/validators/cart.validator.js";
import { requireAuth } from "../src/infrastructure/http/middlewares/auth.js";
import { AppError } from "../src/shared/errors/AppError.js";

const ID_PRODUCTO = "clx0000000000000000000001";
const ID_USUARIO = "usr_001";

const filaProducto = (o: Record<string, any> = {}) => ({
  id: ID_PRODUCTO,
  name: "Piso Ceramico Beige 60x60",
  description: "Piso ceramico para interiores",
  price: 38900,
  originalPrice: null,
  image: "piso.png",
  rating: 4.5,
  reviewCount: 10,
  inStock: true,
  stockQuantity: 100,
  unit: "m²",
  categoryId: "cat_001",
  createdAt: new Date("2026-01-01"),
  updatedAt: new Date("2026-01-01"),
  tags: [{ name: "nuevo" }],
  category: { name: "Pisos y Ceramicas", slug: "pisos-ceramicas" },
  ...o,
});

const filaCarrito = (o: Record<string, any> = {}) => ({
  id: "cart_001",
  userId: ID_USUARIO,
  createdAt: new Date("2026-01-01"),
  updatedAt: new Date("2026-01-01"),
  items: [],
  ...o,
});

const filaLinea = (o: Record<string, any> = {}) => ({
  id: "ci_001",
  quantity: 2,
  cartId: "cart_001",
  productId: ID_PRODUCTO,
  createdAt: new Date("2026-01-01"),
  updatedAt: new Date("2026-01-01"),
  ...o,
});

/** Cliente Prisma falso + repo real + caso de uso. */
function montar() {
  const db = {
    cart: { findUnique: vi.fn(), create: vi.fn() },
    cartItem: { findUnique: vi.fn(), update: vi.fn(), create: vi.fn(), findMany: vi.fn() },
  };
  const repo = new PrismaCartRepository(db as any);
  const caso = new AddCartItemUseCase(repo);
  return { db, caso };
}

test("CP-F-CHK-01-01", "Retorna 401 sin sesión autenticada antes de modificar el carrito", async () => {
  // Arrange
  const { db } = montar();
  const { req, res, next } = contextoExpress();

  // Act
  await requireAuth(req, res, next);

  // Assert
  const error = errorDeNext(next);
  ok(error instanceof AppError);
  is(error.statusCode, 401);
  is(req.user, undefined);
  expect(db.cart.findUnique).not.toHaveBeenCalled();
  expect(db.cartItem.create).not.toHaveBeenCalled();
});

test("CP-F-CHK-01-02", "Valida esquema para cantidades (1..9999, enteros) y formato cuid de ID", () => {
  // Arrange
  const { db } = montar();

  // Act
  const cero = addItemSchema.safeParse({ productId: ID_PRODUCTO, quantity: 0 });
  const sobreTope = addItemSchema.safeParse({ productId: ID_PRODUCTO, quantity: 10000 });
  const decimal = addItemSchema.safeParse({ productId: ID_PRODUCTO, quantity: 2.5 });
  const idMalo = addItemSchema.safeParse({ productId: "123", quantity: 1 });
  const minimo = addItemSchema.safeParse({ productId: ID_PRODUCTO, quantity: 1 });
  const maximo = addItemSchema.safeParse({ productId: ID_PRODUCTO, quantity: 9999 });
  const cantidadPorDefecto = addItemSchema.parse({ productId: ID_PRODUCTO }).quantity;

  // Assert
  is(cero.success, false);
  if (!cero.success) has(cero.error.issues[0].message, "al menos 1");
  is(sobreTope.success, false);
  is(decimal.success, false);
  if (!decimal.success) has(decimal.error.issues[0].message, "entero");
  is(idMalo.success, false);
  if (!idMalo.success) is(idMalo.error.issues[0].message, "ID de producto inválido");
  is(minimo.success, true);
  is(maximo.success, true);
  is(cantidadPorDefecto, 1);
  expect(db.cart.findUnique).not.toHaveBeenCalled();
});

test("CP-F-CHK-01-03", "Crea carrito si no existía y acumula cantidad si la línea ya existía", async () => {
  // Arrange
  const { db, caso } = montar();
  db.cart.findUnique.mockResolvedValue(null);
  db.cart.create.mockResolvedValue(filaCarrito({ id: "cart_nuevo" }));
  db.cartItem.findUnique.mockResolvedValue(filaLinea({ cartId: "cart_nuevo", quantity: 2 }));
  db.cartItem.update.mockResolvedValue(filaLinea({ cartId: "cart_nuevo", quantity: 5, product: filaProducto() }));

  // Act
  const item = await caso.execute(ID_USUARIO, ID_PRODUCTO, 3);

  // Assert
  is(db.cart.create.mock.calls.length, 1);
  eq(db.cart.create.mock.calls[0][0].data, { userId: ID_USUARIO });
  expect(db.cartItem.create).not.toHaveBeenCalled();
  is(db.cartItem.update.mock.calls.length, 1);
  eq(db.cartItem.update.mock.calls[0][0].data, { quantity: 5 });
  is(item.quantity, 5);
  is(item.productId, ID_PRODUCTO);
});

// Defecto abierto #9 (ver la tabla en tests/README.md): se espera que falle.
test.fails("CP-F-CHK-01-04", "Acumula cantidades de producto existente en el carrito respetando tope", async () => {
  // Arrange
  const { db, caso } = montar();
  db.cart.findUnique.mockResolvedValue(filaCarrito());
  db.cartItem.findUnique.mockResolvedValue(filaLinea({ quantity: 9997 }));
  db.cartItem.update.mockResolvedValue(filaLinea({ quantity: 9999, product: filaProducto() }));

  // Act — 2º escenario: la línea ya está en el tope y se intenta sumar 9999 más.
  const item = await caso.execute(ID_USUARIO, ID_PRODUCTO, 2);
  const busqueda = db.cartItem.findUnique.mock.calls[0][0];
  const actualizacion = db.cartItem.update.mock.calls[0][0];

  db.cartItem.findUnique.mockResolvedValue(filaLinea({ quantity: 9999 }));
  db.cartItem.update.mockResolvedValue(filaLinea({ quantity: 19998, product: filaProducto() }));
  const excedido = await caso.execute(ID_USUARIO, ID_PRODUCTO, 9999);

  // Assert
  expect(db.cart.create).not.toHaveBeenCalled();
  eq(busqueda.where, {
    cartId_productId: { cartId: "cart_001", productId: ID_PRODUCTO },
  });
  eq(actualizacion.data, { quantity: 9999 });
  is(item.quantity, 9999);
  // DEFECTO: la acumulación supera el máximo de 9999 sin validación adicional
  ok(excedido.quantity <= 9999, `quantity=${excedido.quantity} supera el tope de 9999`);
});

test("CP-F-CHK-01-05", "Agrega una nueva línea de producto cuando no estaba en el carrito", async () => {
  // Arrange
  const { db, caso } = montar();
  db.cart.findUnique.mockResolvedValue(filaCarrito());
  db.cartItem.findUnique.mockResolvedValue(null);
  db.cartItem.create.mockResolvedValue(filaLinea({ id: "ci_nuevo", quantity: 1, product: filaProducto() }));

  // Act
  const item = await caso.execute(ID_USUARIO, ID_PRODUCTO, 1);

  // Assert
  expect(db.cartItem.update).not.toHaveBeenCalled();
  is(db.cartItem.create.mock.calls.length, 1);
  eq(db.cartItem.create.mock.calls[0][0].data, {
    cartId: "cart_001",
    productId: ID_PRODUCTO,
    quantity: 1,
  });
  is(item.id, "ci_nuevo");
  is(item.quantity, 1);
  is(item.product?.id, ID_PRODUCTO);
});
