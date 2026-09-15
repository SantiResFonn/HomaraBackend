import { ICartRepository } from "../../../domain/repositories/cart-repository.interface.js";
import { Cart, CartItem } from "../../../domain/entities/cart.js";
import { Product } from "../../../domain/entities/product.js";
import { prisma } from "../prisma-client.js";

export class PrismaCartRepository implements ICartRepository {
  constructor(private readonly db = prisma) {}

  async findByUserId(userId: string): Promise<Cart> {
    let cart = await this.db.cart.findUnique({
      where: { userId },
      include: {
        items: {
          include: {
            product: {
              include: { category: true, tags: true }
            }
          }
        }
      }
    });

    cart ??= await this.db.cart.create({
      data: { userId },
      include: {
        items: {
          include: {
            product: {
              include: { category: true, tags: true }
            }
          }
        }
      }
    });

    return new Cart(
      cart.id,
      cart.userId,
      cart.createdAt,
      cart.updatedAt,
      cart.items.map((item) => this.mapToCartItem(item))
    );
  }

  async addItem(cartId: string, productId: string, quantity: number): Promise<CartItem> {
    const existing = await this.db.cartItem.findUnique({
      where: {
        cartId_productId: { cartId, productId }
      }
    });

    let item;
    if (existing) {
      item = await this.db.cartItem.update({
        where: { id: existing.id },
        data: { quantity: existing.quantity + quantity },
        include: { product: true }
      });
    } else {
      item = await this.db.cartItem.create({
        data: { cartId, productId, quantity },
        include: { product: true }
      });
    }

    return this.mapToCartItem(item);
  }

  async updateItemQuantity(itemId: string, quantity: number): Promise<CartItem> {
    const item = await this.db.cartItem.update({
      where: { id: itemId },
      data: { quantity },
      include: { product: true }
    });

    return this.mapToCartItem(item);
  }

  private mapToCartItem(item: any): CartItem {
    const tags = Array.isArray(item.product.tags)
      ? item.product.tags.map((t: any) => (typeof t === "string" ? t : t.name))
      : undefined;

    return new CartItem(
      item.id,
      item.quantity,
      item.cartId,
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
        tags
      ),
      item.createdAt,
      item.updatedAt
    );
  }

  async removeItem(itemId: string): Promise<void> {
    await this.db.cartItem.delete({ where: { id: itemId } });
  }

  async clear(cartId: string): Promise<void> {
    await this.db.cartItem.deleteMany({ where: { cartId } });
  }

  async findItemOwner(itemId: string): Promise<string | null> {
    const item = await this.db.cartItem.findUnique({
      where: { id: itemId },
      include: { cart: true }
    });
    return item?.cart.userId ?? null;
  }

  async getReservedQuantities(excludeCartId: string, productIds: string[]): Promise<Record<string, number>> {
    const timeLimit = new Date(Date.now() - 15 * 60 * 1000);
    const items = await this.db.cartItem.findMany({
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

    const result: Record<string, number> = {};
    for (const id of productIds) {
      result[id] = 0;
    }
    for (const item of items) {
      result[item.productId] = (result[item.productId] || 0) + item.quantity;
    }
    return result;
  }
}
