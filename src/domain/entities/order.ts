import { Product } from "./product.js";

export class OrderItem {
  constructor(
    public readonly id: string,
    public readonly quantity: number,
    public readonly unitPrice: number,
    public readonly total: number,
    public readonly orderId: string,
    public readonly productId: string,
    public readonly product?: Product,
    public readonly isBackorder?: boolean,
    public readonly backorderQuantity?: number
  ) {}
}

export type OrderStatus = "PENDIENTE" | "PROCESANDO" | "ENVIADO" | "ENTREGADO" | "CANCELADO";

export class Order {
  constructor(
    public readonly id: string,
    public readonly orderNumber: string,
    public readonly status: OrderStatus,
    public readonly subtotal: number,
    public readonly shippingCost: number,
    public readonly total: number,
    public readonly paymentMethod: string | null,
    public readonly shippingAddress: string | null,
    public readonly shippingCity: string | null,
    public readonly shippingState: string | null,
    public readonly shippingZip: string | null,
    public readonly shippingNotes: string | null,
    public readonly userId: string,
    public readonly createdAt?: Date,
    public readonly updatedAt?: Date,
    public readonly items?: OrderItem[],
    public readonly user?: { firstName: string; lastName: string; email?: string }
  ) {}
}
