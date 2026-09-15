// ============================================================================
// Dobles de prueba (mocks de Vitest) + fábricas de datos.
//
// Los repositorios falsos son objetos planos de `vi.fn()`: mocks reales, así
// que en los casos se programan con `.mockResolvedValue()` / `.mockImplementation()`
// y se comprueban con `expect(x).toHaveBeenCalledWith(...)`.
// ============================================================================

import { vi } from "vitest";
import type { Mock } from "vitest";

// --- Repositorios falsos (objetos de mocks) ------------------------------

export const fakeUsuarios = () => ({
  findById: vi.fn(),
  findByEmail: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
});

export const fakeProyectos = () => ({
  findAllByUserId: vi.fn(),
  findById: vi.fn(),
  create: vi.fn(async (p: any) => proyecto(p)),
  update: vi.fn(async (id: string, d: any) => proyecto({ id, ...d })),
  delete: vi.fn(),
});

export const fakeProductos = () => ({
  findAll: vi.fn(),
  findById: vi.fn(),
  create: vi.fn(),
  updateStock: vi.fn(),
  findStorefrontRecommended: vi.fn(),
  findStorefrontOffers: vi.fn(),
  findStorefrontBestSellers: vi.fn(),
  updateProductRating: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
});

export const fakeCarritos = () => ({
  findByUserId: vi.fn(),
  addItem: vi.fn(),
  updateItemQuantity: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
  findItemOwner: vi.fn(),
  getReservedQuantities: vi.fn(),
});

export const fakeResenas = () => ({
  create: vi.fn(),
  findByUserAndProduct: vi.fn(),
  findByProductId: vi.fn(),
  getAverageRatingAndCount: vi.fn(),
});

export const fakePedidos = () => ({
  findAll: vi.fn(),
  findByIdOrNumber: vi.fn(),
  create: vi.fn(),
  updateStatus: vi.fn(),
  countByYear: vi.fn(),
});

export const fakePrismaAdmin = () => ({
  order: { findMany: vi.fn(), count: vi.fn() },
  orderItem: { findMany: vi.fn() },
  product: { count: vi.fn(), findMany: vi.fn() },
  user: { count: vi.fn() },
});

// --- Entidades y fábricas de datos ---------------------------------------

export function usuario(over: Record<string, any> = {}) {
  return {
    id: "usr_001",
    email: "ana@homara.com",
    password: "$2b$10$hashDeEjemplo",
    firstName: "Ana",
    lastName: "Rojas",
    phone: "3001234567",
    address: "Calle 1 #2-3",
    city: "Bogotá",
    state: "Cundinamarca",
    zipCode: "110111",
    role: "CUSTOMER",
    createdAt: new Date("2026-01-01"),
    updatedAt: new Date("2026-01-01"),
    ...over,
  };
}

export function datosRegistro(over: Record<string, any> = {}) {
  return {
    email: "ana@homara.com",
    password: "ClaveSegura8",
    firstName: "Ana",
    lastName: "Rojas",
    ...over,
  };
}

export function producto(over: Record<string, any> = {}) {
  return {
    id: "prd_001",
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
    category: "Pisos y Ceramicas",
    categorySlug: "pisos-ceramicas",
    createdAt: new Date("2026-01-01"),
    updatedAt: new Date("2026-01-01"),
    tags: [],
    ...over,
  };
}

export function filaProductoPrisma(over: Record<string, any> = {}) {
  return {
    id: "prd_001",
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
    ...over,
  };
}

export function proyecto(over: Record<string, any> = {}) {
  return {
    id: "proy_001",
    name: "Cocina",
    type: "PISO",
    status: "EN_PROGRESO",
    length: null,
    width: null,
    height: null,
    area: 20,
    materialType: "ceramica",
    tileFormat: "60x60",
    thumbnail: "🏠",
    estimatedCost: 0,
    userId: "usr_001",
    createdAt: new Date("2026-01-01"),
    updatedAt: new Date("2026-01-01"),
    materials: [],
    wastePercent: 10,
    layingPattern: "directo",
    deductDoors: 0,
    deductWindows: 0,
    customSubtractions: 0,
    includeAdhesive: true,
    includeGrout: true,
    includeSpacers: true,
    includeTools: true,
    selectedProductId: null,
    ...over,
  };
}

export function datosProyecto(over: Record<string, any> = {}) {
  return {
    name: "Cocina",
    type: "PISO",
    area: 20,
    materialType: "ceramica",
    tileFormat: "60x60",
    userId: "usr_001",
    ...over,
  };
}

export function materialManual(over: Record<string, any> = {}) {
  return {
    name: "Ceramica traida por el cliente",
    quantity: "22 m²",
    icon: "🏗️",
    price: 100000,
    ...over,
  };
}

export function carrito(over: Record<string, any> = {}) {
  return { id: "cart_001", userId: "usr_001", items: [], ...over };
}

export function resena(over: Record<string, any> = {}) {
  return {
    id: "rev_001",
    rating: 5,
    comment: "Excelente producto.",
    createdAt: new Date("2026-02-01"),
    userId: "usr_001",
    productId: "prd_001",
    ...over,
  };
}

export function datosResena(over: Record<string, any> = {}) {
  return { rating: 5, comment: "Excelente producto.", ...over };
}

export function datosProducto(over: Record<string, any> = {}) {
  return {
    name: "Cemento Gris 50 kg",
    description: "Cemento de uso estructural",
    price: 32000,
    stockQuantity: 120,
    unit: "bulto",
    categoryId: "cat_002",
    ...over,
  };
}

export function ordenEntregada(over: Record<string, any> = {}) {
  return { total: 100000, createdAt: new Date(2026, 0, 15), ...over };
}

export function itemVendido(total: number, categoria = "Pisos y Ceramicas") {
  return { total, product: { category: { name: categoria } } };
}

/** Programa las 3 llamadas secuenciales a `order.findMany` del tablero admin. */
export function programarOrdenes(
  p: ReturnType<typeof fakePrismaAdmin>,
  o: { actual?: any[]; anterior?: any[]; anio?: any[] } = {},
) {
  p.order.findMany
    .mockResolvedValueOnce(o.actual ?? [])
    .mockResolvedValueOnce(o.anterior ?? [])
    .mockResolvedValueOnce(o.anio ?? []);
}

// --- Utilidades HTTP y Express -----------------------------------------

export function contextoExpress(authHeader?: string) {
  const req: any = { headers: authHeader ? { authorization: authHeader } : {} };
  const res: any = {
    statusCode: 200,
    body: undefined,
    status(c: number) {
      this.statusCode = c;
      return this;
    },
    json(b: unknown) {
      this.body = b;
      return this;
    },
  };
  const next = vi.fn();
  return { req, res, next };
}

/** El error pasado a `next(err)` en el primer llamado. */
export function errorDeNext(next: Mock) {
  return next.mock.calls[0]?.[0];
}

/** Ejecuta `fn` con el reloj del sistema fijado en `iso` (timers falsos de Vitest). */
export async function conRelojFijo<T>(iso: string, fn: () => T | Promise<T>): Promise<T> {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(iso));
  try {
    return await fn();
  } finally {
    vi.useRealTimers();
  }
}
