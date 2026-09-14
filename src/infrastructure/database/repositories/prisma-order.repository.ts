import { IOrderRepository } from "../../../domain/repositories/order-repository.interface.js";
import { Order, OrderItem, OrderStatus } from "../../../domain/entities/order.js";
import { Product } from "../../../domain/entities/product.js";
import { prisma } from "../prisma-client.js";
import { Prisma } from "../../../generated/prisma/client.js";

export class PrismaOrderRepository implements IOrderRepository {
  constructor(private readonly db = prisma) {}

  private mapOrderSummary(o: {
    id: string;
    orderNumber: string;
    status: string;
    subtotal: number;
    shippingCost: number;
    total: number;
    paymentMethod: string | null;
    shippingAddress: string | null;
    shippingCity: string | null;
    shippingState: string | null;
    shippingZip: string | null;
    shippingNotes?: string | null;
    userId: string;
    createdAt: Date;
    updatedAt: Date;
    items: Array<{
      id: string;
      quantity: number;
      unitPrice: number;
      total: number;
      orderId: string;
      productId: string;
      isBackorder?: boolean;
      backorderQuantity?: number;
    }>;
    user: { firstName: string; lastName: string };
  }): Order {
    return new Order(
      o.id,
      o.orderNumber,
      o.status as OrderStatus,
      o.subtotal,
      o.shippingCost,
      o.total,
      o.paymentMethod,
      o.shippingAddress,
      o.shippingCity,
      o.shippingState,
      o.shippingZip,
      o.shippingNotes ?? null,
      o.userId,
      o.createdAt,
      o.updatedAt,
      o.items.map((item) => new OrderItem(item.id, item.quantity, item.unitPrice, item.total, item.orderId, item.productId, undefined, item.isBackorder, item.backorderQuantity)),
      { firstName: o.user.firstName, lastName: o.user.lastName }
    );
  }

  async findAll(filters?: { userId?: string; admin?: boolean }): Promise<Order[]> {
    const userId = filters?.userId;
    const isAdmin = filters?.admin === true;

    const where = isAdmin ? {} : { userId };

    const orders = await this.db.order.findMany({
      where,
      include: {
        user: { select: { firstName: true, lastName: true } },
        items: true
      },
      orderBy: { createdAt: "desc" }
    });

    return orders.map((o) => this.mapOrderSummary(o));
  }

  async findByIdOrNumber(idOrNumber: string): Promise<Order | null> {
    const o = await this.db.order.findFirst({
      where: {
        OR: [
          { id: idOrNumber },
          { orderNumber: idOrNumber }
        ]
      },
      include: {
        user: { select: { firstName: true, lastName: true, email: true } },
        items: {
          include: {
            product: { include: { category: true } }
          }
        }
      }
    });

    if (!o) return null;

    return new Order(
      o.id,
      o.orderNumber,
      o.status as "PENDIENTE" | "PROCESANDO" | "ENVIADO" | "ENTREGADO" | "CANCELADO",
      o.subtotal,
      o.shippingCost,
      o.total,
      o.paymentMethod,
      o.shippingAddress,
      o.shippingCity,
      o.shippingState,
      o.shippingZip,
      o.shippingNotes,
      o.userId,
      o.createdAt,
      o.updatedAt,
      o.items.map((item) => new OrderItem(
        item.id,
        item.quantity,
        item.unitPrice,
        item.total,
        item.orderId,
        item.productId,
        new Product(
          item.product.id,
          item.product.name,
          item.product.description,
          item.product.price,
          item.product.originalPrice,
          item.product.image,
          item.product.rating,
          item.product.reviewCount,
          item.product.inStock,
          item.product.stockQuantity,
          item.product.unit,
          item.product.categoryId,
          item.product.createdAt,
          item.product.updatedAt,
          undefined,
          item.product.category.name,
          item.product.category.slug
        ),
        item.isBackorder,
        item.backorderQuantity
      )),
      { firstName: o.user.firstName, lastName: o.user.lastName, email: o.user.email }
    );
  }

  async create(data: Omit<Order, "id" | "createdAt" | "updatedAt" | "items" | "orderNumber" | "user"> & { items: Omit<OrderItem, "id" | "orderId" | "product">[] }): Promise<Order> {
    // Ejecutar transaccionalmente el checkout completo
    const createdOrder = await this.db.$transaction(async (tx: Prisma.TransactionClient) => {
      // A. Load cart to get excludeCartId
      const cart = await tx.cart.findUnique({ where: { userId: data.userId } });
      const excludeCartId = cart?.id || "";

      // B. Load products and active reservations by other users
      const productIds = data.items.map(item => item.productId);
      if (productIds.length > 0) {
        const placeholders = productIds.map((_, i) => `$${i + 1}`).join(", ");
        await tx.$executeRawUnsafe(
          `SELECT id FROM "Product" WHERE id IN (${placeholders}) FOR UPDATE`,
          ...productIds
        );
      }

      // Generar número de orden dentro de la transacción y después del bloqueo para evitar colisiones concurrentes
      const year = new Date().getFullYear();
      const count = await tx.order.count({
        where: {
          createdAt: {
            gte: new Date(`${year}-01-01`)
          }
        }
      });
      const orderNumber = `ORD-${year}-${String(count + 1).padStart(3, "0")}`;
      const productsList = await tx.product.findMany({
        where: { id: { in: productIds } }
      });
      const prodMap = new Map(productsList.map(p => [p.id, p]));

      const timeLimit = new Date(Date.now() - 15 * 60 * 1000);
      const reservations = await tx.cartItem.findMany({
        where: {
          productId: { in: productIds },
          cartId: excludeCartId ? { not: excludeCartId } : undefined,
          updatedAt: { gte: timeLimit }
        },
        select: {
          productId: true,
          quantity: true
        }
      });

      const reservedQtyMap: Record<string, number> = {};
      for (const resItem of reservations) {
        reservedQtyMap[resItem.productId] = (reservedQtyMap[resItem.productId] || 0) + resItem.quantity;
      }

      // C. Process each item to calculate backorder state
      const processedItems = data.items.map((item) => {
        const prod = prodMap.get(item.productId);
        const physicalStock = prod ? prod.stockQuantity : 0;
        const reservedQty = reservedQtyMap[item.productId] || 0;
        const availableStock = Math.max(0, physicalStock - reservedQty);
        
        const isBackorder = item.quantity > availableStock;
        const backorderQuantity = isBackorder ? item.quantity - availableStock : 0;

        return {
          productId: item.productId,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          total: item.total,
          isBackorder,
          backorderQuantity
        };
      });

      // D. Crear Orden
      const order = await tx.order.create({
        data: {
          orderNumber,
          userId: data.userId,
          subtotal: data.subtotal,
          shippingCost: data.shippingCost,
          total: data.total,
          paymentMethod: data.paymentMethod,
          shippingAddress: data.shippingAddress,
          shippingCity: data.shippingCity,
          shippingState: data.shippingState,
          shippingZip: data.shippingZip,
          shippingNotes: data.shippingNotes,
          items: {
            create: processedItems.map((item) => ({
              productId: item.productId,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              total: item.total,
              isBackorder: item.isBackorder,
              backorderQuantity: item.backorderQuantity
            }))
          }
        },
        include: {
          items: true,
          user: { select: { firstName: true, lastName: true } }
        }
      });

      // E. Decrementar stock e inStock de productos (allowing to go negative)
      for (const item of processedItems) {
        const prod = prodMap.get(item.productId);
        if (prod) {
          const newQty = prod.stockQuantity - item.quantity;
          await tx.product.update({
            where: { id: item.productId },
            data: {
              stockQuantity: newQty,
              inStock: newQty > 0
            }
          });
        }
      }

      // F. Vaciar carrito del usuario
      if (cart) {
        await tx.cartItem.deleteMany({ where: { cartId: cart.id } });
      }

      return order;
    });

    return this.mapOrderSummary(createdOrder);
  }

  async updateStatus(id: string, status: "PENDIENTE" | "PROCESANDO" | "ENVIADO" | "ENTREGADO" | "CANCELADO"): Promise<Order> {
    const o = await this.db.order.update({
      where: { id },
      data: { status },
      include: {
        user: { select: { firstName: true, lastName: true } },
        items: true
      }
    });

    return this.mapOrderSummary(o);
  }

  async countByYear(year: number): Promise<number> {
    return await this.db.order.count({
      where: {
        createdAt: {
          gte: new Date(`${year}-01-01`),
          lt: new Date(`${year + 1}-01-01`)
        }
      }
    });
  }
}
