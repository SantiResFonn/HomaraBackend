import { test, is, ok, vi } from "./harness.js";
import { PrismaCategoryRepository } from "../src/infrastructure/database/repositories/prisma-category.repository.js";
import { PrismaUserRepository } from "../src/infrastructure/database/repositories/prisma-user.repository.js";
import { PrismaReviewRepository } from "../src/infrastructure/database/repositories/prisma-review.repository.js";
import { PrismaProjectRepository } from "../src/infrastructure/database/repositories/prisma-project.repository.js";
import { PrismaOrderRepository } from "../src/infrastructure/database/repositories/prisma-order.repository.js";
import { PrismaProductRepository } from "../src/infrastructure/database/repositories/prisma-product.repository.js";
import { PrismaCartRepository } from "../src/infrastructure/database/repositories/prisma-cart.repository.js";

// ============================================================================
// PrismaCategoryRepository Tests
// ============================================================================

test("UNIT-REPO-CAT-01", "PrismaCategoryRepository.findAll mapea categorias", async () => {
  // Arrange
  const db = {
    category: {
      findMany: vi.fn(async () => [
        {
          id: "cat-1",
          name: "Pisos",
          slug: "pisos",
          description: "Pisos y ceramicas",
          icon: "pisos.jpg",
          createdAt: new Date("2026-01-01"),
          updatedAt: new Date("2026-01-01")
        }
      ])
    }
  };
  const repo = new PrismaCategoryRepository(db as any);

  // Act
  const result = await repo.findAll();

  // Assert
  is(result.length, 1);
  is(result[0].id, "cat-1");
  is(result[0].name, "Pisos");
  is(result[0].icon, "pisos.jpg");
});

test("UNIT-REPO-CAT-02", "PrismaCategoryRepository findBySlug y create retornan entidad o null", async () => {
  // Arrange
  const catRow = {
    id: "cat-1",
    name: "Pisos",
    slug: "pisos",
    description: "Pisos",
    icon: "pisos.jpg",
    createdAt: new Date(),
    updatedAt: new Date()
  };

  const db = {
    category: {
      findUnique: vi.fn(async (args: any) => {
        if (args.where.slug === "pisos") return catRow;
        return null;
      }),
      create: vi.fn(async (args: any) => ({
        ...catRow,
        ...args.data,
        id: "cat-new"
      }))
    }
  };

  const repo = new PrismaCategoryRepository(db as any);

  // Act
  const bySlug = await repo.findBySlug("pisos");

  const none = await repo.findBySlug("none");

  const created = await repo.create({
    name: "Pinturas",
    slug: "pinturas",
    description: "Pinturas para interior",
    icon: "paint.png"
  });

  // Assert
  ok(bySlug !== null);
  is(bySlug?.id, "cat-1");
  is(none, null);
  is(created.id, "cat-new");
  is(created.slug, "pinturas");
});

// ============================================================================
// PrismaUserRepository Tests
// ============================================================================

test("UNIT-REPO-USR-01", "PrismaUserRepository CRUD y mapeo a User entity", async () => {
  // Arrange
  const userRow = {
    id: "usr-1",
    email: "test@homara.co",
    password: "hashed_password",
    firstName: "Laura",
    lastName: "Gomez",
    phone: "3001234567",
    address: "Cra 10 #20",
    city: "Medellín",
    state: "Antioquia",
    zipCode: "050001",
    role: "CUSTOMER",
    createdAt: new Date("2026-01-01"),
    updatedAt: new Date("2026-01-01")
  };

  const db = {
    user: {
      findUnique: vi.fn(async (args: any) => {
        if (args.where.id === "usr-1" || args.where.email === "test@homara.co") return userRow;
        return null;
      }),
      create: vi.fn(async (args: any) => ({
        ...userRow,
        ...args.data,
        id: "usr-new"
      })),
      update: vi.fn(async (args: any) => ({
        ...userRow,
        ...args.data,
        id: args.where.id
      }))
    }
  };

  const repo = new PrismaUserRepository(db as any);

  // Act
  const byId = await repo.findById("usr-1");

  const byEmail = await repo.findByEmail("test@homara.co");

  const byIdNone = await repo.findById("non-existent");

  const created = await repo.create({
    email: "created@homara.co",
    password: "pass",
    firstName: "Nuevo",
    lastName: "Usuario"
  });

  const updated = await repo.update("usr-1", { firstName: "Laura Modificada" });

  // Assert
  ok(byId !== null);
  is(byId?.firstName, "Laura");
  ok(byEmail !== null);
  is(byEmail?.id, "usr-1");
  is(byIdNone, null);
  is(created.id, "usr-new");
  is(created.firstName, "Nuevo");
  is(updated.firstName, "Laura Modificada");
});

// ============================================================================
// PrismaReviewRepository Tests
// ============================================================================

test("UNIT-REPO-REV-01", "PrismaReviewRepository create, find y calculo de promedio", async () => {
  // Arrange
  const reviewRow = {
    id: "rev-1",
    rating: 5,
    comment: "Excelente calidad",
    userId: "usr-1",
    productId: "prd-1",
    createdAt: new Date("2026-01-01"),
    updatedAt: new Date("2026-01-01"),
    user: { firstName: "Laura", lastName: "Gomez" }
  };

  const db = {
    review: {
      create: vi.fn(async (args: any) => ({ ...reviewRow, ...args.data, id: "rev-new" })),
      findUnique: vi.fn(async () => reviewRow),
      findMany: vi.fn(async () => [reviewRow]),
      aggregate: vi.fn(async () => ({
        _avg: { rating: 4.8 },
        _count: { rating: 12 }
      }))
    }
  };

  const repo = new PrismaReviewRepository(db as any);

  // Act
  const created = await repo.create({
    rating: 5,
    comment: "Genial",
    userId: "usr-1",
    productId: "prd-1"
  });

  const byUserAndProd = await repo.findByUserAndProduct("usr-1", "prd-1");

  const list = await repo.findByProductId("prd-1");

  const stats = await repo.getAverageRatingAndCount("prd-1");

  // Caso sin reseñas (promedio null -> 0)
  db.review.aggregate = vi.fn(async () => ({
    _avg: { rating: null },
    _count: { rating: 0 }
  }));
  const emptyStats = await repo.getAverageRatingAndCount("prd-no-revs");

  // Assert
  is(created.id, "rev-new");
  is(created.userFirstName, "Laura");
  ok(byUserAndProd !== null);
  is(byUserAndProd?.rating, 5);
  is(list.length, 1);
  is(stats.avg, 4.8);
  is(stats.count, 12);
  is(emptyStats.avg, 0);
  is(emptyStats.count, 0);
});

// ============================================================================
// PrismaProjectRepository Tests
// ============================================================================

test("UNIT-REPO-PROY-01", "PrismaProjectRepository CRUD con mapeo de materiales", async () => {
  // Arrange
  const projectRow = {
    id: "proy-1",
    name: "Remodelacion Baño",
    type: "PISO",
    status: "EN_PROGRESO",
    length: null,
    width: null,
    height: null,
    area: 12,
    materialType: "ceramica",
    tileFormat: "60x60",
    thumbnail: "icon.png",
    estimatedCost: 250000,
    userId: "usr-1",
    createdAt: new Date("2026-01-01"),
    updatedAt: new Date("2026-01-01"),
    wastePercent: 10,
    layingPattern: "directo",
    deductDoors: 0,
    deductWindows: 0,
    customSubtractions: 0,
    includeAdhesive: true,
    includeGrout: true,
    includeSpacers: true,
    includeTools: true,
    selectedProductId: "prd-1",
    materials: [
      {
        id: "mat-1",
        name: "Piso Ceramico",
        quantity: "14 m²",
        unit: "m²",
        estimatedCost: 200000,
        isSelected: true,
        productId: "prd-1",
        projectId: "proy-1"
      }
    ]
  };

  const db = {
    project: {
      findMany: vi.fn(async () => [projectRow]),
      findUnique: vi.fn(async (args: any) => args.where.id === "proy-1" ? projectRow : null),
      create: vi.fn(async (args: any) => ({
        ...projectRow,
        ...args.data,
        id: "proy-created",
        materials: []
      })),
      update: vi.fn(async (args: any) => ({
        ...projectRow,
        ...args.data,
        id: args.where.id,
        materials: []
      })),
      delete: vi.fn(async () => projectRow)
    }
  };

  const repo = new PrismaProjectRepository(db as any);

  // Act
  const list = await repo.findAllByUserId("usr-1");

  const byId = await repo.findById("proy-1");

  const byIdNone = await repo.findById("non-existent");

  const created = await repo.create({
    name: "Nuevo Proy",
    type: "PISO",
    area: 15,
    materialType: "ceramica",
    tileFormat: "60x60",
    userId: "usr-1",
    status: "EN_PROGRESO",
    estimatedCost: 100000
  });

  const updated = await repo.update("proy-1", { name: "Baño Renovado" });

  await repo.delete("proy-1");

  // Assert
  is(list.length, 1);
  is(list[0].id, "proy-1");
  is(list[0].materials?.length, 1);
  ok(byId !== null);
  is(byId?.name, "Remodelacion Baño");
  is(byIdNone, null);
  is(created.id, "proy-created");
  is(updated.name, "Baño Renovado");
  is(db.project.delete.mock.calls.length, 1);
});

test("UNIT-REPO-PROY-02", "PrismaProjectRepository create y update con lista de materiales", async () => {
  // Arrange
  const projectRowWithMats = {
    id: "proy-mats",
    name: "Proy Materiales",
    type: "PISO",
    status: "PLANIFICADO",
    length: 5,
    width: 4,
    height: null,
    area: 20,
    materialType: "ceramica",
    tileFormat: "60x60",
    thumbnail: null,
    estimatedCost: 150000,
    wastePercent: 10,
    layingPattern: "RECTO",
    deductDoors: true,
    deductWindows: false,
    customSubtractions: null,
    includeAdhesive: true,
    includeGrout: true,
    includeSpacers: true,
    includeTools: false,
    selectedProductId: "prd-1",
    userId: "usr-1",
    createdAt: new Date(),
    updatedAt: new Date(),
    materials: [
      {
        id: "mat-1",
        name: "Pegante Gris",
        quantity: "3 bolsas",
        note: "adhesivo",
        icon: "📦",
        price: 35000,
        productId: "prd-1",
        projectId: "proy-mats"
      }
    ]
  };

  const db = {
    project: {
      create: vi.fn(async (args: any) => ({
        ...projectRowWithMats,
        id: "proy-created-mats",
        materials: args.data.materials?.create || []
      })),
      update: vi.fn(async (args: any) => ({
        ...projectRowWithMats,
        materials: args.data.materials?.create || []
      }))
    },
    projectMaterial: {
      deleteMany: vi.fn(async () => ({}))
    }
  };

  const repo = new PrismaProjectRepository(db as any);

  // Act
  // Crear con materiales
  const created = await repo.create({
    name: "Proy Materiales",
    type: "PISO",
    area: 20,
    materialType: "ceramica",
    tileFormat: "60x60",
    userId: "usr-1",
    status: "PLANIFICADO",
    estimatedCost: 150000,
    materials: [
      { name: "Pegante Gris", quantity: "3 bolsas", note: "adhesivo", icon: "📦", price: 35000, productId: "prd-1" }
    ]
  });

  // Actualizar con nuevos materiales
  const updated = await repo.update("proy-mats", {
    materials: [
      { name: "Boquilla Blanca", quantity: "1 bolsa", note: "juntas", icon: "✨", price: 15000, productId: "prd-2" }
    ]
  });

  // Assert
  is(created.id, "proy-created-mats");
  is(created.materials?.length, 1);
  is(created.materials?.[0].name, "Pegante Gris");
  is(db.projectMaterial.deleteMany.mock.calls.length, 1);
  is(updated.materials?.length, 1);
  is(updated.materials?.[0].name, "Boquilla Blanca");
});

// ============================================================================
// PrismaOrderRepository Tests
// ============================================================================

test("UNIT-REPO-ORD-01", "PrismaOrderRepository findAll, findByIdOrNumber, updateStatus y countByYear", async () => {
  // Arrange
  const orderRow = {
    id: "ord-1",
    orderNumber: "ORD-2026-001",
    status: "PENDIENTE",
    subtotal: 100000,
    shippingCost: 25000,
    total: 125000,
    paymentMethod: "TARJETA",
    shippingAddress: "Calle 100 #20",
    shippingCity: "Bogotá",
    shippingState: "Cundinamarca",
    shippingZip: "110111",
    shippingNotes: null,
    userId: "usr-1",
    createdAt: new Date("2026-01-15"),
    updatedAt: new Date("2026-01-15"),
    items: [
      {
        id: "oi-1",
        quantity: 2,
        unitPrice: 50000,
        total: 100000,
        orderId: "ord-1",
        productId: "prd-1",
        isBackorder: false,
        backorderQuantity: 0,
        product: {
          id: "prd-1",
          name: "Piso",
          description: "Desc",
          price: 50000,
          originalPrice: null,
          image: "img.jpg",
          rating: 4.5,
          reviewCount: 5,
          inStock: true,
          stockQuantity: 20,
          unit: "m²",
          categoryId: "cat-1",
          createdAt: new Date(),
          updatedAt: new Date(),
          category: { name: "Pisos", slug: "pisos" }
        }
      }
    ],
    user: { firstName: "Laura", lastName: "Gomez", email: "laura@homara.co" }
  };

  const db = {
    order: {
      findMany: vi.fn(async () => [orderRow]),
      findFirst: vi.fn(async (args: any) => {
        if (args.where.OR.some((c: any) => c.id === "ord-1" || c.orderNumber === "ORD-2026-001")) {
          return orderRow;
        }
        return null;
      }),
      update: vi.fn(async (args: any) => ({
        ...orderRow,
        status: args.data.status
      })),
      count: vi.fn(async () => 8)
    }
  };

  const repo = new PrismaOrderRepository(db as any);

  // Act
  const orders = await repo.findAll({ userId: "usr-1", admin: false });

  const byId = await repo.findByIdOrNumber("ord-1");

  const byNum = await repo.findByIdOrNumber("ORD-2026-001");

  const none = await repo.findByIdOrNumber("ORD-none");

  const updated = await repo.updateStatus("ord-1", "ENVIADO");

  const count = await repo.countByYear(2026);

  // Assert
  is(orders.length, 1);
  is(orders[0].orderNumber, "ORD-2026-001");
  is(orders[0].total, 125000);
  ok(byId !== null);
  is(byId?.orderNumber, "ORD-2026-001");
  is(byId?.items?.[0].product?.name, "Piso");
  ok(byNum !== null);
  is(none, null);
  is(updated.status, "ENVIADO");
  is(count, 8);
});

test("UNIT-REPO-ORD-02", "PrismaOrderRepository create checkout transaccional y backorder", async () => {
  // Arrange
  const txMock = {
    cart: { findUnique: vi.fn(async () => ({ id: "cart-1" })) },
    $executeRawUnsafe: vi.fn(async () => 1),
    order: {
      count: vi.fn(async () => 5),
      create: vi.fn(async () => ({
        id: "ord-new",
        orderNumber: "ORD-2026-006",
        status: "PENDIENTE",
        subtotal: 50000,
        shippingCost: 25000,
        total: 75000,
        paymentMethod: "TARJETA",
        shippingAddress: "Calle 1",
        shippingCity: "Bogota",
        shippingState: "Cundinamarca",
        shippingZip: "110111",
        shippingNotes: null,
        userId: "usr-1",
        createdAt: new Date(),
        updatedAt: new Date(),
        items: [{ id: "oi-new", quantity: 1, unitPrice: 50000, total: 50000, orderId: "ord-new", productId: "prd-1", isBackorder: false, backorderQuantity: 0 }],
        user: { firstName: "Ana", lastName: "Rojas" }
      }))
    },
    product: {
      findMany: vi.fn(async () => [{ id: "prd-1", stockQuantity: 10 }]),
      update: vi.fn(async () => ({}))
    },
    cartItem: {
      findMany: vi.fn(async () => []),
      deleteMany: vi.fn(async () => ({}))
    }
  };
  const db = {
    $transaction: vi.fn(async (cb: any) => cb(txMock))
  };
  const repo = new PrismaOrderRepository(db as any);

  // Act
  const created = await repo.create({
    userId: "usr-1",
    subtotal: 50000,
    shippingCost: 25000,
    total: 75000,
    paymentMethod: "TARJETA",
    shippingAddress: "Calle 1",
    shippingCity: "Bogota",
    shippingState: "Cundinamarca",
    shippingZip: "110111",
    shippingNotes: null,
    status: "PENDIENTE",
    items: [{ productId: "prd-1", quantity: 1, unitPrice: 50000, total: 50000 }]
  });

  // Assert
  is(created.id, "ord-new");
  is(created.orderNumber, "ORD-2026-006");
  is(txMock.cartItem.deleteMany.mock.calls.length, 1);
  is(txMock.product.update.mock.calls.length, 1);
});
// ============================================================================
// PrismaProductRepository Tests
// ============================================================================

test("UNIT-REPO-PRD-01", "PrismaProductRepository findAll, findById, create y updateStock", async () => {
  // Arrange
  const prodRow = {
    id: "prd-1",
    name: "Porcelanato Gris 60x60",
    description: "Para interiores",
    price: 55000,
    originalPrice: 65000,
    image: "p.jpg",
    rating: 4.8,
    reviewCount: 20,
    inStock: true,
    stockQuantity: 15,
    unit: "m²",
    categoryId: "cat-1",
    createdAt: new Date("2026-01-01"),
    updatedAt: new Date("2026-01-01"),
    tags: [{ name: "nuevo" }],
    category: { name: "Pisos", slug: "pisos" }
  };

  const db = {
    product: {
      findMany: vi.fn(async () => [prodRow]),
      findUnique: vi.fn(async (args: any) => args.where.id === "prd-1" ? prodRow : null),
      create: vi.fn(async (args: any) => ({
        ...prodRow,
        ...args.data,
        id: "prd-new",
        tags: [{ name: "oferta" }]
      })),
      update: vi.fn(async (args: any) => ({
        ...prodRow,
        stockQuantity: args.data.stockQuantity,
        inStock: args.data.inStock
      }))
    }
  };

  const repo = new PrismaProductRepository(db as any);

  // Act
  // findAll con filtros
  const list = await repo.findAll({ categorySlug: "pisos", query: "porcelanato", tag: "nuevo" });

  // findById
  const found = await repo.findById("prd-1");

  const notFound = await repo.findById("prd-none");

  // create
  const created = await repo.create({
    name: "Nuevo Prod",
    description: "Desc",
    price: 30000,
    originalPrice: null,
    image: "img.png",
    rating: 0,
    reviewCount: 0,
    inStock: true,
    stockQuantity: 50,
    unit: "unidad",
    categoryId: "cat-1",
    tags: ["oferta"]
  });

  // updateStock
  await repo.updateStock("prd-1", 5);

  // updateStock no-op si no existe
  await repo.updateStock("prd-none", 5);

  // Assert
  is(list.length, 1);
  is(list[0].id, "prd-1");
  is(list[0].tags?.[0], "nuevo");
  is(list[0].category, "Pisos");
  ok(found !== null);
  is(found?.name, "Porcelanato Gris 60x60");
  is(notFound, null);
  is(created.id, "prd-new");
  is(db.product.update.mock.calls.length, 1);
});

test("UNIT-REPO-PRD-02", "PrismaProductRepository storefronts, update y delete", async () => {
  // Arrange
  const prodRow = {
    id: "prd-1",
    name: "Porcelanato Gris",
    description: "Desc",
    price: 50000,
    originalPrice: 60000,
    image: "p.jpg",
    rating: 4.8,
    reviewCount: 15,
    inStock: true,
    stockQuantity: 10,
    unit: "m²",
    categoryId: "cat-1",
    createdAt: new Date(),
    updatedAt: new Date(),
    tags: [{ name: "nuevo" }],
    category: { name: "Pisos", slug: "pisos" }
  };

  const txMock = {
    productTag: {
      deleteMany: vi.fn(async () => ({})),
      createMany: vi.fn(async () => ({}))
    },
    product: {
      update: vi.fn(async () => prodRow),
      delete: vi.fn(async () => prodRow)
    },
    cartItem: {
      deleteMany: vi.fn(async () => ({}))
    },
    projectMaterial: {
      updateMany: vi.fn(async () => ({}))
    }
  };

  const db = {
    product: {
      findMany: vi.fn(async () => [prodRow]),
      update: vi.fn(async () => prodRow)
    },
    orderItem: {
      groupBy: vi.fn(async () => [{ productId: "prd-1", _sum: { quantity: 10 } }])
    },
    $transaction: vi.fn(async (callback: any) => callback(txMock))
  };

  const repo = new PrismaProductRepository(db as any);

  // Act
  // findStorefrontRecommended
  const recs = await repo.findStorefrontRecommended();

  // findStorefrontOffers
  const offers = await repo.findStorefrontOffers();

  // findStorefrontBestSellers
  const best = await repo.findStorefrontBestSellers();

  // updateProductRating
  await repo.updateProductRating("prd-1", 4.9, 16);

  // update con tags
  const updated = await repo.update("prd-1", {
    name: "Porcelanato Actualizado",
    stockQuantity: 20,
    tags: ["destacado"]
  });

  // delete
  await repo.delete("prd-1");

  // Assert
  is(recs.length, 1);
  is(offers.length, 1);
  is(best.length, 2);
  is(db.product.update.mock.calls.length, 1);
  is(updated.id, "prd-1");
  is(txMock.product.delete.mock.calls.length, 1);
});

// ============================================================================
// PrismaCartRepository Tests
// ============================================================================

test("UNIT-REPO-CART-01", "PrismaCartRepository findByUserId crea carrito si no existe o mapea existentes", async () => {
  // Arrange
  const prodRow = {
    id: "prd-1",
    name: "Piso Ceramico",
    description: "Desc",
    price: 40000,
    originalPrice: null,
    image: "p.jpg",
    rating: 4.5,
    reviewCount: 2,
    inStock: true,
    stockQuantity: 50,
    unit: "m²",
    categoryId: "cat-1",
    createdAt: new Date(),
    updatedAt: new Date(),
    tags: [{ name: "oferta" }],
    category: { id: "cat-1", name: "Pisos" }
  };

  const cartRow = {
    id: "cart-1",
    userId: "usr-1",
    createdAt: new Date(),
    updatedAt: new Date(),
    items: [
      {
        id: "ci-1",
        quantity: 2,
        cartId: "cart-1",
        productId: "prd-1",
        createdAt: new Date(),
        updatedAt: new Date(),
        product: prodRow
      }
    ]
  };

  const db = {
    cart: {
      findUnique: vi.fn(async (args: any) => args.where.userId === "usr-1" ? cartRow : null),
      create: vi.fn(async (args: any) => ({
        id: "cart-nuevo",
        userId: args.data.userId,
        createdAt: new Date(),
        updatedAt: new Date(),
        items: []
      }))
    }
  };

  const repo = new PrismaCartRepository(db as any);

  // Act
  // Carrito existente
  const existingCart = await repo.findByUserId("usr-1");

  // Carrito inexistente (lo crea)
  const newCart = await repo.findByUserId("usr-nuevo");

  // Assert
  is(existingCart.id, "cart-1");
  is(existingCart.items.length, 1);
  is(existingCart.items[0].product.tags[0], "oferta");
  is(newCart.id, "cart-nuevo");
  is(newCart.items.length, 0);
  is(db.cart.create.mock.calls.length, 1);
});

test("UNIT-REPO-CART-02", "PrismaCartRepository addItem, update, remove, clear, findItemOwner y getReservedQuantities", async () => {
  // Arrange
  const prodRow = {
    id: "prd-1",
    name: "Piso",
    description: "Desc",
    price: 30000,
    originalPrice: null,
    image: "p.jpg",
    rating: 5,
    reviewCount: 1,
    inStock: true,
    stockQuantity: 10,
    unit: "m²",
    categoryId: "cat-1",
    createdAt: new Date(),
    updatedAt: new Date()
  };

  const db = {
    cartItem: {
      findUnique: vi.fn(async (args: any) => {
        if (args.where?.id === "ci-existente") {
          return { id: "ci-existente", cartId: "cart-1", productId: "prd-1", quantity: 2, cart: { userId: "usr-1" } };
        }
        if (args.where?.cartId_productId?.productId === "prd-1") {
          return { id: "ci-existente", cartId: "cart-1", productId: "prd-1", quantity: 2 };
        }
        return null;
      }),
      update: vi.fn(async (args: any) => ({
        id: args.where.id,
        quantity: args.data.quantity,
        cartId: "cart-1",
        productId: "prd-1",
        product: prodRow,
        createdAt: new Date(),
        updatedAt: new Date()
      })),
      create: vi.fn(async (args: any) => ({
        id: "ci-nuevo",
        cartId: args.data.cartId,
        productId: args.data.productId,
        quantity: args.data.quantity,
        product: prodRow,
        createdAt: new Date(),
        updatedAt: new Date()
      })),
      delete: vi.fn(async () => ({})),
      deleteMany: vi.fn(async () => ({ count: 2 })),
      findMany: vi.fn(async () => [
        { productId: "prd-1", quantity: 3 },
        { productId: "prd-1", quantity: 2 }
      ])
    }
  };

  const repo = new PrismaCartRepository(db as any);

  // Act
  // addItem acumulando en item existente
  const itemAcumulado = await repo.addItem("cart-1", "prd-1", 3);

  // addItem creando nueva línea
  const itemNuevo = await repo.addItem("cart-1", "prd-2", 4);

  // updateItemQuantity
  const itemActualizado = await repo.updateItemQuantity("ci-existente", 6);

  // removeItem
  await repo.removeItem("ci-existente");

  // clear
  await repo.clear("cart-1");

  // findItemOwner cuando existe
  const owner = await repo.findItemOwner("ci-existente");

  // findItemOwner cuando no existe
  const noOwner = await repo.findItemOwner("ci-inexistente");

  // getReservedQuantities
  const reservas = await repo.getReservedQuantities("cart-1", ["prd-1"]);

  // Assert
  is(itemAcumulado.quantity, 5);
  is(itemNuevo.id, "ci-nuevo");
  is(itemNuevo.quantity, 4);
  is(itemActualizado.quantity, 6);
  is(db.cartItem.delete.mock.calls.length, 1);
  is(db.cartItem.deleteMany.mock.calls.length, 1);
  is(owner, "usr-1");
  is(noOwner, null);
  is(reservas["prd-1"], 5);
});
