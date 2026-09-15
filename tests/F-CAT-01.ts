// F-CAT-01 · Listar y filtrar el catálogo
// Unidad: ListProductsUseCase.execute() + PrismaProductRepository.findAll()  (GET /api/v1/products)

import { test, is, eq, expect, vi } from "./harness.js";
import { fakeCarritos, filaProductoPrisma, carrito, spy } from "./helpers.js";
import { PrismaProductRepository } from "../src/infrastructure/database/repositories/prisma-product.repository.js";
import { ListProductsUseCase } from "../src/application/use-cases/catalog.use-cases.js";

/** Repo Prisma real conectado a un cliente `db` falso; devuelve también el spy de findMany. */
function montar() {
  const findMany = vi.fn();
  const productos = new PrismaProductRepository({ product: { findMany } } as any);
  const carritos = fakeCarritos();
  const caso = new ListProductsUseCase(productos as any, carritos as any);
  const where = () => findMany.mock.calls[0][0].where;
  return { findMany, carritos, caso, where };
}

test("CP-F-CAT-01-01", "Filtra por categoría, término de búsqueda y etiqueta simultáneamente", async () => {
  // Arrange
  const { findMany, carritos, caso, where } = montar();
  findMany.mockResolvedValue([]);

  // Act
  const salida = await caso.execute({ categorySlug: "cementos", query: "gris", tag: "oferta" }, undefined);

  // Assert
  eq(where().category, { slug: "cementos" });
  eq(where().OR, [
    { name: { contains: "gris", mode: "insensitive" } },
    { description: { contains: "gris", mode: "insensitive" } },
  ]);
  eq(where().tags, { some: { name: "oferta" } });
  eq(salida, []);
  expect(carritos.getReservedQuantities).not.toHaveBeenCalled();
  expect(carritos.findByUserId).not.toHaveBeenCalled();
});

test("CP-F-CAT-01-02", "Filtra por texto y etiqueta sin categoría", async () => {
  // Arrange
  const { findMany, carritos, caso, where } = montar();
  findMany.mockResolvedValue([]);

  // Act
  const salida = await caso.execute({ query: "estuco", tag: "oferta" });

  // Assert
  is(where().category, undefined);
  is(where().OR.length, 2);
  eq(where().tags, { some: { name: "oferta" } });
  eq(salida, []);
  expect(carritos.getReservedQuantities).not.toHaveBeenCalled();
});

test("CP-F-CAT-01-03", "Filtra únicamente por etiqueta", async () => {
  // Arrange
  const { findMany, caso, where } = montar();
  findMany.mockResolvedValue([]);

  // Act
  const salida = await caso.execute({ tag: "inexistente" });

  // Assert
  is(where().category, undefined);
  is(where().OR, undefined);
  eq(where().tags, { some: { name: "inexistente" } });
  eq(salida, []);
});

test("CP-F-CAT-01-04", "Lista catálogo sin filtros aplicados", async () => {
  // Arrange
  const { findMany, carritos, caso, where } = montar();
  findMany.mockResolvedValue([]);

  // Act
  const salida = await caso.execute();

  // Assert
  eq(where(), {});
  eq(salida, []);
  expect(carritos.getReservedQuantities).not.toHaveBeenCalled();
});

test("CP-F-CAT-01-05", "Excluye reservas del propio carrito para usuario autenticado", async () => {
  // Arrange
  const { findMany, carritos, caso } = montar();
  findMany.mockResolvedValue([
    filaProductoPrisma({ id: "prd_001", stockQuantity: 10 }),
    filaProductoPrisma({ id: "prd_002", stockQuantity: 5 }),
  ]);
  carritos.findByUserId.mockResolvedValue(carrito({ id: "cart_001" }));
  carritos.getReservedQuantities.mockResolvedValue({ prd_001: 3, prd_002: 5 });

  // Act
  const salida = await caso.execute(undefined, "usr_001");

  // Assert
  expect(carritos.findByUserId).toHaveBeenCalledWith("usr_001");
  expect(carritos.getReservedQuantities).toHaveBeenCalledWith("cart_001", ["prd_001", "prd_002"]);
  is(salida.length, 2);
  is(salida[0].stockQuantity, 7);
  is(salida[0].inStock, true);
  is(salida[1].stockQuantity, 0);
  is(salida[1].inStock, false);
});

test("CP-F-CAT-01-06", "Descuenta todas las reservas activas para visitante anónimo", async () => {
  // Arrange
  const { findMany, carritos, caso } = montar();
  findMany.mockResolvedValue([filaProductoPrisma({ id: "prd_001", stockQuantity: 10 })]);
  carritos.getReservedQuantities.mockResolvedValue({ prd_001: 4 });

  // Act
  const salida = await caso.execute();

  // Assert
  expect(carritos.findByUserId).not.toHaveBeenCalled();
  expect(carritos.getReservedQuantities).toHaveBeenCalledWith("", ["prd_001"]);
  is(salida[0].stockQuantity, 6);
  is(salida[0].inStock, true);
});

test("CP-F-CAT-01-05b", "Evita stock negativo cuando las reservas superan el inventario físico", async () => {
  // Arrange
  const { findMany, carritos, caso } = montar();
  findMany.mockResolvedValue([filaProductoPrisma({ id: "prd_001", stockQuantity: 2 })]);
  carritos.getReservedQuantities.mockResolvedValue({ prd_001: 5 });

  // Act
  const salida = await caso.execute();

  // Assert
  is(salida[0].stockQuantity, 0);
  is(salida[0].inStock, false);
});

test("CP-F-CAT-01-06c", "Trata filtros con cadenas vacías como filtros ausentes", async () => {
  // Arrange
  const { findMany, caso, where } = montar();
  findMany.mockResolvedValue([]);

  // Act
  await caso.execute({ categorySlug: "", query: "", tag: "" });

  // Assert
  eq(where(), {});
});
