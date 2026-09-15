// F-ADM-03 · Inventario y stock
// Unidad: AdminController.getInventoryReport()  (GET /api/v1/admin/inventory)

import { test, is, eq, subset, expect } from "./harness.js";
import { fakePrismaAdmin, contextoExpress, filaProductoPrisma } from "./helpers.js";
import { AdminController, setPrismaClientForTests } from "../src/infrastructure/http/controllers/admin.controller.js";

async function reporteCon(productos: any[]) {
  const p = fakePrismaAdmin();
  p.product.findMany.mockResolvedValue(productos);
  setPrismaClientForTests(p);
  const { req, res, next } = contextoExpress();
  await AdminController.getInventoryReport(req, res, next);
  return { cuerpo: res.body as any, next };
}

test("CP-F-ADM-03-01", "Clasifica productos con existencias menores a cero como stock_negativo", async () => {
  // Arrange
  const filas = [filaProductoPrisma({ id: "prd_neg", stockQuantity: -5, price: 1000, inStock: false })];

  // Act
  const { cuerpo, next } = await reporteCon(filas);

  // Assert
  expect(next).not.toHaveBeenCalled();
  is(cuerpo.success, true);
  is(cuerpo.data.products[0].stockStatus, "stock_negativo");
  is(cuerpo.data.products[0].stockValue, -5000);
  is(cuerpo.data.products[0].category, "Pisos y Ceramicas");
  subset(cuerpo.data.stats, {
    totalProducts: 1,
    lowStockCount: 0,
    outOfStockCount: 0,
    negativeStockCount: 1,
  });
  // DEFECTO: totalUnits debería sumar solo existencias positivas (no restar stock negativo)
  is(cuerpo.data.stats.totalUnits, 0);
});

test("CP-F-ADM-03-02", "Clasifica productos con existencias en 0 como sin_stock", async () => {
  // Arrange
  const filas = [
    filaProductoPrisma({ id: "prd_cero", stockQuantity: 0, price: 38900, inStock: false }),
  ];

  // Act
  const { cuerpo } = await reporteCon(filas);

  // Assert
  is(cuerpo.data.products[0].stockStatus, "sin_stock");
  is(cuerpo.data.products[0].stockValue, 0);
  is(cuerpo.data.stats.outOfStockCount, 1);
  is(cuerpo.data.stats.lowStockCount, 0);
  is(cuerpo.data.stats.negativeStockCount, 0);
  is(cuerpo.data.stats.totalUnits, 0);
});

test("CP-F-ADM-03-03", "Marca 49 unidades como límite superior de alerta stock_bajo", async () => {
  // Arrange
  const filas = [
    filaProductoPrisma({ id: "prd_49", stockQuantity: 49, price: 2000, inStock: true }),
  ];

  // Act
  const { cuerpo } = await reporteCon(filas);

  // Assert
  is(cuerpo.data.products[0].stockStatus, "stock_bajo");
  is(cuerpo.data.products[0].stockValue, 98000);
  is(cuerpo.data.products[0].stockQuantity, 49);
  is(cuerpo.data.stats.lowStockCount, 1);
  is(cuerpo.data.stats.outOfStockCount, 0);
  is(cuerpo.data.stats.negativeStockCount, 0);
  is(cuerpo.data.stats.totalUnits, 49);
});

test("CP-F-ADM-03-04", "Marca 50 unidades como límite inferior de inventario normal", async () => {
  // Arrange
  const filas = [
    filaProductoPrisma({ id: "prd_50", stockQuantity: 50, price: 2000, inStock: true }),
  ];

  // Act
  const { cuerpo } = await reporteCon(filas);

  // Assert
  is(cuerpo.data.products[0].stockStatus, "normal");
  is(cuerpo.data.products[0].stockValue, 100000);
  eq(cuerpo.data.stats, {
    totalProducts: 1,
    totalUnits: 50,
    lowStockCount: 0,
    outOfStockCount: 0,
    negativeStockCount: 0,
  });
});

test("CP-F-ADM-03-05", "Procesa múltiples productos combinando estados en el reporte", async () => {
  // Arrange
  const filas = [
    filaProductoPrisma({ id: "prd_neg", name: "Arena", stockQuantity: -3, price: 5000, inStock: false }),
    filaProductoPrisma({ id: "prd_cero", name: "Grava", stockQuantity: 0, price: 4000, inStock: false }),
  ];

  // Act
  const { cuerpo } = await reporteCon(filas);

  // Assert
  eq(cuerpo.data.products.map((p: any) => p.id), ["prd_neg", "prd_cero"]);
  is(cuerpo.data.products[0].stockStatus, "stock_negativo");
  is(cuerpo.data.products[1].stockStatus, "sin_stock");
  is(cuerpo.data.products[0].stockValue, -15000);
  is(cuerpo.data.products[1].stockValue, 0);
  subset(cuerpo.data.stats, {
    totalProducts: 2,
    lowStockCount: 0,
    outOfStockCount: 1,
    negativeStockCount: 1,
  });
  // DEFECTO: totalUnits no debería restar existencias negativas
  is(cuerpo.data.stats.totalUnits, 0);
});
