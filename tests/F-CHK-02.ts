// F-CHK-02 · Ver y modificar el carrito
// Unidad: GetCartUseCase.execute()  (GET /api/v1/cart)

import { test, is, eq, subset, expect, vi } from "./harness.js";
import { conRelojFijo } from "./helpers.js";
import { GetCartUseCase } from "../src/application/use-cases/cart.use-cases.js";
import { PrismaCartRepository } from "../src/infrastructure/database/repositories/prisma-cart.repository.js";

const ID_USUARIO = "usr_001";
const ID_A = "clx0000000000000000000001";
const ID_B = "clx0000000000000000000002";

const filaProducto = (o: Record<string, any> = {}) => ({
  id: ID_A,
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

const filaLinea = (o: Record<string, any> = {}) => {
  const p = o.product ?? filaProducto();
  return {
    id: "ci_001",
    quantity: 1,
    cartId: "cart_001",
    productId: p.id,
    createdAt: new Date("2026-01-01"),
    updatedAt: new Date("2026-01-01"),
    ...o,
    product: p,
  };
};

const filaCarrito = (items: any[] = [], o: Record<string, any> = {}) => ({
  id: "cart_001",
  userId: ID_USUARIO,
  createdAt: new Date("2026-01-01"),
  updatedAt: new Date("2026-01-01"),
  items,
  ...o,
});

function montar() {
  const db = {
    cart: { findUnique: vi.fn(), create: vi.fn() },
    cartItem: {
      findMany: vi.fn().mockResolvedValue([]),
      findUnique: vi.fn(),
      update: vi.fn(),
      create: vi.fn(),
      delete: vi.fn(),
      deleteMany: vi.fn(),
    },
  };
  const caso = new GetCartUseCase(new PrismaCartRepository(db as any));
  return { db, caso };
}

test("CP-F-CHK-02-01", "Crea un carrito vacío cuando el usuario no tenía uno previo", async () => {
  // Arrange
  const { db, caso } = montar();
  db.cart.findUnique.mockResolvedValue(null);
  db.cart.create.mockResolvedValue(filaCarrito([], { id: "cart_nuevo" }));

  // Act
  const salida = await caso.execute(ID_USUARIO);

  // Assert
  is(db.cart.create.mock.calls.length, 1);
  eq(db.cart.create.mock.calls[0][0].data, { userId: ID_USUARIO });
  is(salida.id, "cart_nuevo");
  expect(db.cartItem.findMany).not.toHaveBeenCalled();
  eq(salida.items, []);
  is(salida.itemCount, 0);
  is(salida.subtotal, 0);
  is(salida.shipping, 25000);
  is(salida.total, 25000);
});

test("CP-F-CHK-02-02", "Retorna estructura de carrito existente sin productos", async () => {
  // Arrange
  const { db, caso } = montar();
  db.cart.findUnique.mockResolvedValue(filaCarrito([]));

  // Act
  const salida = await caso.execute(ID_USUARIO);

  // Assert
  expect(db.cart.create).not.toHaveBeenCalled();
  eq(db.cart.findUnique.mock.calls[0][0].where, { userId: ID_USUARIO });
  expect(db.cartItem.findMany).not.toHaveBeenCalled();
  subset(salida as any, { subtotal: 0, shipping: 25000, total: 25000, itemCount: 0 });
});

test("CP-F-CHK-02-03", "Calcula backorder y aplica envío gratuito cuando subtotal supera 500000", async () => {
  // Arrange
  const { db, caso } = montar();
  db.cart.findUnique.mockResolvedValue(
    filaCarrito([filaLinea({ quantity: 3, product: filaProducto({ price: 200000, stockQuantity: 10 }) })]),
  );
  db.cartItem.findMany.mockResolvedValue([{ productId: ID_A, quantity: 8 }]);

  // Act
  const salida = await conRelojFijo("2026-08-25T12:00:00.000Z", () => caso.execute(ID_USUARIO));

  // Assert
  const filtro = db.cartItem.findMany.mock.calls[0][0].where;
  eq(filtro.productId, { in: [ID_A] });
  eq(filtro.cartId, { not: "cart_001" });
  eq(filtro.updatedAt.gte, new Date("2026-08-25T11:45:00.000Z"));
  is(salida.items[0].availableStock, 2);
  is(salida.items[0].isBackorder, true);
  is(salida.items[0].backorderQuantity, 1);
  is(salida.subtotal, 600000);
  is(salida.shipping, 0);
  is(salida.total, 600000);
  is(salida.itemCount, 1);
});

test("CP-F-CHK-02-04", "Muestra disponibilidad total sin backorder con stock suficiente", async () => {
  // Arrange
  const { db, caso } = montar();
  db.cart.findUnique.mockResolvedValue(
    filaCarrito([filaLinea({ quantity: 1, product: filaProducto({ price: 500001, stockQuantity: 10 }) })]),
  );
  db.cartItem.findMany.mockResolvedValue([]);

  // Act
  const salida = await caso.execute(ID_USUARIO);

  // Assert
  is(salida.items[0].availableStock, 10);
  is(salida.items[0].isBackorder, false);
  is(salida.items[0].backorderQuantity, 0);
  is(salida.subtotal, 500001);
  is(salida.shipping, 0);
  is(salida.total, 500001);
  is(db.cartItem.findMany.mock.calls.length, 1);
});

test("CP-F-CHK-02-05", "Itera múltiples líneas combinando disponibles y pedidos pendientes", async () => {
  // Arrange
  const { db, caso } = montar();
  db.cart.findUnique.mockResolvedValue(
    filaCarrito([
      filaLinea({ id: "ci_a", quantity: 5, product: filaProducto({ price: 100000, stockQuantity: 4 }) }),
      filaLinea({ id: "ci_b", quantity: 2, product: filaProducto({ id: ID_B, price: 150000, stockQuantity: 50 }) }),
    ]),
  );
  db.cartItem.findMany.mockResolvedValue([{ productId: ID_A, quantity: 2 }]);

  // Act
  const salida = await caso.execute(ID_USUARIO);

  // Assert
  eq(db.cartItem.findMany.mock.calls[0][0].where.productId, { in: [ID_A, ID_B] });
  is(salida.items[0].availableStock, 2);
  is(salida.items[0].isBackorder, true);
  is(salida.items[0].backorderQuantity, 3);
  is(salida.items[1].availableStock, 50);
  is(salida.items[1].isBackorder, false);
  is(salida.items[1].backorderQuantity, 0);
  is(salida.subtotal, 800000);
  is(salida.shipping, 0);
  is(salida.total, 800000);
  is(salida.itemCount, 2);
});

test("CP-F-CHK-02-06", "Cobra tarifa de envío con subtotal inferior al umbral y evalúa umbral de 500000", async () => {
  // Arrange
  const { db, caso } = montar();
  db.cart.findUnique.mockResolvedValue(filaCarrito([]));

  // Act — 2º escenario: carrito con subtotal de 500.000 exactos.
  const vacio = await caso.execute(ID_USUARIO);

  db.cart.findUnique.mockResolvedValue(
    filaCarrito([filaLinea({ quantity: 2, product: filaProducto({ price: 250000, stockQuantity: 10 }) })]),
  );
  db.cartItem.findMany.mockResolvedValue([]);
  const limite = await caso.execute(ID_USUARIO);

  // Assert
  is(vacio.subtotal, 0);
  is(vacio.shipping, 25000);
  is(vacio.total, 25000);
  is(limite.subtotal, 500000);
  // DEFECTO: con 500.000 exactos el envío no es gratuito según HU19 (RF16 vs HU19)
  is(limite.shipping, 0);
  is(limite.total, 500000);
});
