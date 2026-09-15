// F-CAT-02 · Ver el detalle de un producto
// Unidad: GetProductDetailUseCase.execute()  (GET /api/v1/products/:id)

import { test, is, ok, grab, expect } from "./harness.js";
import { fakeProductos, fakeCarritos, producto, carrito } from "./helpers.js";
import { GetProductDetailUseCase } from "../src/application/use-cases/catalog.use-cases.js";
import { AppError } from "../src/shared/errors/AppError.js";

function montar() {
  const productos = fakeProductos();
  const carritos = fakeCarritos();
  const caso = new GetProductDetailUseCase(productos as any, carritos as any);
  return { productos, carritos, caso };
}

test("CP-F-CAT-02-01", "Retorna 404 si el producto no existe", async () => {
  // Arrange
  const { productos, carritos, caso } = montar();
  productos.findById.mockResolvedValue(null);

  // Act
  const error = await grab(caso.execute("prd_inexistente"));

  // Assert
  ok(error instanceof AppError);
  is(error.statusCode, 404);
  is(error.message, "Producto no encontrado");
  expect(carritos.findByUserId).not.toHaveBeenCalled();
  expect(carritos.getReservedQuantities).not.toHaveBeenCalled();
});

test("CP-F-CAT-02-02", "Excluye la reserva propia del usuario autenticado al calcular stock disponible", async () => {
  // Arrange
  const { productos, carritos, caso } = montar();
  productos.findById.mockResolvedValue(producto({ id: "prd_001", stockQuantity: 10 }));
  carritos.findByUserId.mockResolvedValue(carrito({ id: "cart_001" }));
  carritos.getReservedQuantities.mockResolvedValue({ prd_001: 4 });

  // Act
  const ficha = await caso.execute("prd_001", "usr_001");

  // Assert
  expect(carritos.findByUserId).toHaveBeenCalledWith("usr_001");
  expect(carritos.getReservedQuantities).toHaveBeenCalledWith("cart_001", ["prd_001"]);
  is(ficha.stockQuantity, 6);
  is(ficha.inStock, true);
  is(ficha.price, 38900);
  is(ficha.originalPrice, null);
  is(ficha.unit, "m²");
  is(ficha.category, "Pisos y Ceramicas");
});

test("CP-F-CAT-02-03", "Descuenta todas las reservas activas para usuario anónimo", async () => {
  // Arrange
  const { productos, carritos, caso } = montar();
  productos.findById.mockResolvedValue(producto({ id: "prd_001", stockQuantity: 10 }));
  carritos.getReservedQuantities.mockResolvedValue({ prd_001: 4 });

  // Act
  const ficha = await caso.execute("prd_001");

  // Assert
  expect(carritos.findByUserId).not.toHaveBeenCalled();
  expect(carritos.getReservedQuantities).toHaveBeenCalledWith("", ["prd_001"]);
  is(ficha.stockQuantity, 6);
  is(ficha.inStock, true);
});

test("CP-F-CAT-02-03b", "Marca producto como agotado si las reservas consumen todo el stock", async () => {
  // Arrange
  const { productos, carritos, caso } = montar();
  productos.findById.mockResolvedValue(producto({ id: "prd_001", stockQuantity: 3, inStock: true }));
  carritos.getReservedQuantities.mockResolvedValue({ prd_001: 9 });

  // Act
  const ficha = await caso.execute("prd_001");

  // Assert
  is(ficha.stockQuantity, 0);
  is(ficha.inStock, false);
});

test("CP-F-CAT-02-03c", "Mantiene stock físico intacto cuando no hay reservas activas", async () => {
  // Arrange
  const { productos, carritos, caso } = montar();
  productos.findById.mockResolvedValue(producto({ id: "prd_001", stockQuantity: 7 }));
  carritos.getReservedQuantities.mockResolvedValue({});

  // Act
  const ficha = await caso.execute("prd_001");

  // Assert
  is(ficha.stockQuantity, 7);
  is(ficha.inStock, true);
});
