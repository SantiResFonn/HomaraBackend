// F-CHK-03 · Confirmar el pedido
// Unidad: CreateOrderUseCase.execute()  (POST /api/v1/orders)

import { test, is, eq, ok, matches, subset, grab, expect } from "./harness.js";
import { fakeCarritos, fakeProductos, fakePedidos } from "./helpers.js";
import { CreateOrderUseCase } from "../src/application/use-cases/order.use-cases.js";
import { AppError } from "../src/shared/errors/AppError.js";

const ID_USUARIO = "usr_001";
const ID_A = "clx0000000000000000000001";
const ID_B = "clx0000000000000000000002";

const itemCarrito = (o: Record<string, any> = {}) => {
  const { price = 38900, stockQuantity = 100, productId = ID_A, ...resto } = o;
  return {
    id: "ci_001",
    quantity: 1,
    cartId: "cart_001",
    productId,
    product: { id: productId, name: "Piso Ceramico Beige 60x60", price, stockQuantity },
    ...resto,
  };
};

const carritoCon = (items: any[]) => ({ id: "cart_001", userId: ID_USUARIO, items });

const datosEnvio = {
  paymentMethod: "tarjeta",
  shippingAddress: "Calle 1 #2-3",
  shippingCity: "Bogotá",
  shippingState: "Cundinamarca",
  shippingZip: "110111",
  shippingNotes: "Dejar en portería",
};

function montar() {
  const pedidos = fakePedidos();
  const carritos = fakeCarritos();
  const productos = fakeProductos();
  pedidos.create.mockImplementation(async (o: any) => ({
    ...o,
    id: "ord_001",
    orderNumber: "ORD-2026-001",
    createdAt: new Date("2026-08-25"),
  }));
  const caso = new CreateOrderUseCase(pedidos as any, carritos as any, productos as any);
  return { pedidos, carritos, productos, caso };
}

test("CP-F-CHK-03-01", "Rechaza creación de orden cuando el carrito está vacío", async () => {
  // Arrange
  const { pedidos, carritos, productos, caso } = montar();
  carritos.findByUserId.mockResolvedValue(carritoCon([]));

  // Act — 2º escenario: el carrito ni siquiera trae la colección de líneas.
  const sinLineas = await grab(caso.execute(ID_USUARIO, datosEnvio));

  carritos.findByUserId.mockResolvedValue({ id: "cart_001", userId: ID_USUARIO, items: undefined });
  const sinColeccion = await grab(caso.execute(ID_USUARIO, datosEnvio));

  // Assert
  ok(sinLineas instanceof AppError);
  is(sinLineas.message, "El carrito está vacío");
  is(sinColeccion.message, "El carrito está vacío");
  expect(pedidos.create).not.toHaveBeenCalled();
  expect(productos.updateStock).not.toHaveBeenCalled();
});

test("CP-F-CHK-03-02", "Genera pedido con envío gratuito e ítems congelados cuando subtotal supera 500000", async () => {
  // Arrange
  const { pedidos, productos, carritos, caso } = montar();
  carritos.findByUserId.mockResolvedValue(
    carritoCon([
      itemCarrito({ id: "ci_a", quantity: 2, price: 200000, stockQuantity: 1 }),
      itemCarrito({ id: "ci_b", productId: ID_B, quantity: 1, price: 100001, stockQuantity: 50 }),
    ]),
  );
  const pedido = await caso.execute(ID_USUARIO, datosEnvio);

  // Act
  const enviado = pedidos.create.mock.calls[0][0];

  // Assert
  is(enviado.subtotal, 500001);
  is(enviado.shippingCost, 0);
  is(enviado.total, 500001);
  eq(enviado.items, [
    { productId: ID_A, quantity: 2, unitPrice: 200000, total: 400000 },
    { productId: ID_B, quantity: 1, unitPrice: 100001, total: 100001 },
  ]);
  is(enviado.status, "PENDIENTE");
  is(enviado.userId, ID_USUARIO);
  subset(enviado, {
    paymentMethod: "tarjeta",
    shippingAddress: "Calle 1 #2-3",
    shippingCity: "Bogotá",
    shippingState: "Cundinamarca",
    shippingZip: "110111",
    shippingNotes: "Dejar en portería",
  });
  matches(pedido.orderNumber, /^ORD-\d{4}-\d{3}$/);
  expect(productos.findById).not.toHaveBeenCalled();
});

test("CP-F-CHK-03-03", "Evalúa umbral de envío gratuito con subtotal de 500000 exactos", async () => {
  // Arrange
  const { pedidos, carritos, caso } = montar();
  carritos.findByUserId.mockResolvedValue(carritoCon([itemCarrito({ quantity: 4, price: 125000 })]));

  // Act — 2º escenario: subtotal por encima del umbral (500.001).
  const pedido = await caso.execute(ID_USUARIO, datosEnvio);
  const enviado = pedidos.create.mock.calls[0][0];

  carritos.findByUserId.mockResolvedValue(carritoCon([itemCarrito({ quantity: 1, price: 500001 })]));
  await caso.execute(ID_USUARIO, datosEnvio);
  const enviadoPorEncima = pedidos.create.mock.calls[1][0];

  // Assert
  is(enviado.subtotal, 500000);
  eq(enviado.items, [{ productId: ID_A, quantity: 4, unitPrice: 125000, total: 500000 }]);
  is(pedido.orderNumber, "ORD-2026-001");
  is(enviadoPorEncima.shippingCost, 0);
  // DEFECTO: con 500.000 exactos el envío no es gratuito según HU19 (RF16 vs HU19)
  is(enviado.shippingCost, 0);
  is(enviado.total, 500000);
  is(pedido.total, 500000);
});
