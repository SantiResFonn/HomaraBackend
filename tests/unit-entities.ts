import { test, is } from "./harness.js";
import { Category } from "../src/domain/entities/category.js";
import { Order, OrderItem } from "../src/domain/entities/order.js";
import { Project, ProjectMaterial } from "../src/domain/entities/project.js";
import { Review } from "../src/domain/entities/review.js";
import { User } from "../src/domain/entities/user.js";
import { getStockStatus } from "../src/infrastructure/http/controllers/admin.controller.js";

test("UNIT-ENT-01", "Instancia Category, Review y User correctamente", () => {
  // Arrange
  const ahora = new Date();

  // Act
  const cat = new Category("cat1", "Pisos", "pisos", "Pisos ceramicos", "icon");
  const rev = new Review("rev1", 5, "Excelente", ahora, "u1", "p1", "Juan", "Perez");
  const user = new User("u1", "test@homara.co", "hash", "Carlos", "Gomez", "3001234567", "Dir 1", "Medellin", "Antioquia", "05001", "CUSTOMER");

  // Assert
  is(cat.id, "cat1");
  is(cat.name, "Pisos");
  is(rev.rating, 5);
  is(rev.userFirstName, "Juan");
  is(user.email, "test@homara.co");
  is(user.city, "Medellin");
});

test("UNIT-ENT-02", "Instancia Order, OrderItem, Project y ProjectMaterial", () => {
  // Arrange
  const ahora = new Date();

  // Act
  const item = new OrderItem("item1", 2, 50000, 100000, "ord1", "prod1", undefined, false, 0);
  const order = new Order("ord1", "ORD-2026-001", "PENDIENTE", 100000, 25000, 125000, "CARD", "Dir", "Bogota", "Cundinamarca", "110111", null, "u1", ahora, ahora, [item]);
  const mat = new ProjectMaterial("m1", "Pegante", "2 bultos", "nota", "🧱", 57000, "proj1", "prod1");
  const project = new Project("proj1", "Sala", "PISO", "EN_PROGRESO", 5, 4, null, 20, "ceramica", "60x60", "thumb", 500000, "u1", ahora, ahora, [mat]);

  // Assert
  is(item.total, 100000);
  is(item.quantity, 2);
  is(order.orderNumber, "ORD-2026-001");
  is(order.items?.length, 1);
  is(mat.name, "Pegante");
  is(project.name, "Sala");
  is(project.materials?.length, 1);
});

test("UNIT-ENT-03", "Evalúa función helper getStockStatus para diferentes rangos de inventario", () => {
  // Arrange
  const rangos: Array<[number, string]> = [
    [-1, "stock_negativo"],
    [0, "sin_stock"],
    [15, "stock_bajo"],
    [49, "stock_bajo"],
    [50, "normal"],
    [100, "normal"],
  ];

  // Act
  const obtenidos = rangos.map(([inventario]) => getStockStatus(inventario));

  // Assert
  rangos.forEach(([inventario, esperado], i) => is(obtenidos[i], esperado, `inventario ${inventario}`));
});
