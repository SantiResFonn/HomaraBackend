// F-ADM-01 · Tablero de indicadores
// Unidad: AdminController.getMetrics()  (GET /api/v1/admin/metrics)

import { test, is, eq, expect } from "./harness.js";
import {
  fakePrismaAdmin,
  contextoExpress,
  ordenEntregada,
  itemVendido,
  programarOrdenes,
} from "./helpers.js";
import { AdminController, setPrismaClientForTests } from "../src/infrastructure/http/controllers/admin.controller.js";

const ANIO = new Date().getFullYear();

/** Cliente Prisma falso con contadores por defecto, ya instalado en el controlador. */
function montar() {
  const p = fakePrismaAdmin();
  p.order.count.mockResolvedValue(7);
  p.product.count.mockResolvedValue(42);
  p.user.count.mockResolvedValue(5);
  p.orderItem.findMany.mockResolvedValue([]);
  setPrismaClientForTests(p);
  return p;
}

test("CP-F-ADM-01-01", "Calcula variación de ventas respecto al mes anterior y categorías principales", async () => {
  // Arrange
  const p = montar();
  programarOrdenes(p, {
    actual: [ordenEntregada({ total: 150000 })],
    anterior: [ordenEntregada({ total: 100000 })],
    anio: [ordenEntregada({ total: 150000, createdAt: new Date(ANIO, 7, 10) })],
  });
  p.orderItem.findMany.mockResolvedValue([itemVendido(150000, "Pisos y Ceramicas")]);
  const { req, res, next } = contextoExpress();

  // Act
  await AdminController.getMetrics(req, res, next);

  // Assert
  const cuerpo = res.body;
  expect(next).not.toHaveBeenCalled();
  is(cuerpo.success, true);
  is(cuerpo.data[0].label, "Ventas del Mes");
  is(cuerpo.data[0].change, 50);
  is(cuerpo.data[0].value.replace(/\D/g, ""), "150000");
  is(cuerpo.data[1].value, "7");
  is(cuerpo.data[2].value, "42");
  is(cuerpo.data[3].value, "5");
  is(cuerpo.charts.salesByMonth.length, 12);
  is(cuerpo.charts.salesByMonth[7], 150000);
  eq(cuerpo.charts.topCategories, [{ name: "Pisos y Ceramicas", pct: 100 }]);
});

test("CP-F-ADM-01-02", "Evita división por cero y retorna variación 0 cuando no hay ventas el mes anterior", async () => {
  // Arrange
  const p = montar();
  programarOrdenes(p, {
    actual: [ordenEntregada({ total: 250000 })],
    anterior: [],
    anio: [ordenEntregada({ total: 250000, createdAt: new Date(ANIO, 7, 3) })],
  });
  p.orderItem.findMany.mockResolvedValue([itemVendido(250000, "Cementos")]);
  const { req, res, next } = contextoExpress();

  // Act
  await AdminController.getMetrics(req, res, next);

  // Assert
  const cuerpo = res.body;
  is(cuerpo.data[0].change, 0);
  is(Number.isNaN(cuerpo.data[0].change), false);
  is(Number.isFinite(cuerpo.data[0].change), true);
  is(String(cuerpo.data[0].change).includes("Infinity"), false);
  is(cuerpo.data[0].value.replace(/\D/g, ""), "250000");
  eq(cuerpo.charts.topCategories, [{ name: "Cementos", pct: 100 }]);
});

test("CP-F-ADM-01-03", "Agrupa ventas del año por mes correspondiente", async () => {
  // Arrange
  const p = montar();
  programarOrdenes(p, {
    actual: [ordenEntregada({ total: 80000 })],
    anterior: [ordenEntregada({ total: 40000 })],
    anio: [
      ordenEntregada({ total: 300000, createdAt: new Date(ANIO, 0, 5) }),
      ordenEntregada({ total: 120000, createdAt: new Date(ANIO, 7, 20) }),
    ],
  });
  p.orderItem.findMany.mockResolvedValue([itemVendido(420000, "Pinturas")]);
  const { req, res, next } = contextoExpress();

  // Act
  await AdminController.getMetrics(req, res, next);

  // Assert
  const cuerpo = res.body;
  is(cuerpo.data[0].change, 100);
  is(cuerpo.charts.salesByMonth[0], 300000);
  is(cuerpo.charts.salesByMonth[7], 120000);
  is(cuerpo.charts.salesByMonth.filter((v: number) => v === 0).length, 10);
  is(cuerpo.charts.salesByMonth.reduce((a: number, b: number) => a + b, 0), 420000);
});

test("CP-F-ADM-01-04", "Acumula montos repetidos de la misma categoría", async () => {
  // Arrange
  const p = montar();
  programarOrdenes(p, {
    actual: [ordenEntregada({ total: 200000 })],
    anterior: [ordenEntregada({ total: 200000 })],
    anio: [ordenEntregada({ total: 200000, createdAt: new Date(ANIO, 7, 1) })],
  });
  p.orderItem.findMany.mockResolvedValue([
    itemVendido(120000, "Pisos y Ceramicas"),
    itemVendido(80000, "Pisos y Ceramicas"),
  ]);
  const { req, res, next } = contextoExpress();

  // Act
  await AdminController.getMetrics(req, res, next);

  // Assert
  const cuerpo = res.body;
  is(cuerpo.data[0].change, 0);
  is(cuerpo.charts.topCategories.length, 1);
  eq(cuerpo.charts.topCategories[0], { name: "Pisos y Ceramicas", pct: 100 });
});

test("CP-F-ADM-01-05", "Ordena categorías y limita el reporte a las 5 principales", async () => {
  // Arrange
  const p = montar();
  programarOrdenes(p, {
    actual: [ordenEntregada({ total: 100 })],
    anterior: [ordenEntregada({ total: 50 })],
    anio: [ordenEntregada({ total: 100, createdAt: new Date(ANIO, 7, 8) })],
  });
  p.orderItem.findMany.mockResolvedValue([
    itemVendido(10, "Herrajes"),
    itemVendido(30, "Pisos y Ceramicas"),
    itemVendido(25, "Cementos"),
    itemVendido(20, "Pinturas"),
    itemVendido(3, "Herrajes"),
    itemVendido(7, "Griferias"),
    itemVendido(5, "Iluminacion"),
  ]);
  const { req, res, next } = contextoExpress();

  // Act
  await AdminController.getMetrics(req, res, next);

  // Assert
  const cuerpo = res.body;
  is(cuerpo.charts.topCategories.length, 5);
  eq(cuerpo.charts.topCategories, [
    { name: "Pisos y Ceramicas", pct: 30 },
    { name: "Cementos", pct: 25 },
    { name: "Pinturas", pct: 20 },
    { name: "Herrajes", pct: 13 },
    { name: "Griferias", pct: 7 },
  ]);
  is(cuerpo.charts.topCategories.map((c: any) => c.name).includes("Iluminacion"), false);
});

test("CP-F-ADM-01-06", "Asigna 0% a categorías cuando las ventas totales por categoría son 0", async () => {
  // Arrange
  const p = montar();
  programarOrdenes(p, {
    actual: [ordenEntregada({ total: 90000 })],
    anterior: [ordenEntregada({ total: 60000 })],
    anio: [ordenEntregada({ total: 90000, createdAt: new Date(ANIO, 7, 12) })],
  });
  p.orderItem.findMany.mockResolvedValue([
    itemVendido(0, "Pisos y Ceramicas"),
    itemVendido(0, "Pisos y Ceramicas"),
  ]);
  const { req, res, next } = contextoExpress();

  // Act
  await AdminController.getMetrics(req, res, next);

  // Assert
  const cuerpo = res.body;
  eq(cuerpo.charts.topCategories, [{ name: "Pisos y Ceramicas", pct: 0 }]);
  is(Number.isNaN(cuerpo.charts.topCategories[0].pct), false);
  is(cuerpo.data[0].change, 50);
});
