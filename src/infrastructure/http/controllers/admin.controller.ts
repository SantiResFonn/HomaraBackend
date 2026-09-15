import { Request, Response, NextFunction } from "express";
import { prisma as defaultPrisma } from "../../database/prisma-client.js";

// Costura de pruebas: permite sustituir el cliente Prisma por un doble en memoria.
const db: typeof defaultPrisma = defaultPrisma;
export function getStockStatus(stockQuantity: number): "stock_negativo" | "sin_stock" | "stock_bajo" | "normal" {
  if (stockQuantity < 0) return "stock_negativo";
  if (stockQuantity === 0) return "sin_stock";
  if (stockQuantity < 50) return "stock_bajo";
  return "normal";
}

export class AdminController {
  static async getMetrics(req: Request, res: Response, next: NextFunction) {
    try {
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);

      // Ventas del mes actual
      const currentMonthOrders = await db.order.findMany({
        where: {
          createdAt: { gte: startOfMonth },
          status: "ENTREGADO",
        },
        select: { total: true },
      });
      const currentMonthSales = currentMonthOrders.reduce((sum: number, o) => sum + o.total, 0);

      // Ventas del mes anterior
      const lastMonthOrders = await db.order.findMany({
        where: {
          createdAt: { gte: startOfLastMonth, lt: startOfMonth },
          status: "ENTREGADO",
        },
        select: { total: true },
      });
      const lastMonthSales = lastMonthOrders.reduce((sum: number, o) => sum + o.total, 0);

      // Pedidos activos (pendiente + procesando + enviado)
      const activeOrders = await db.order.count({
        where: {
          status: { in: ["PENDIENTE", "PROCESANDO", "ENVIADO"] },
        },
      });

      // Total de productos
      const totalProducts = await db.product.count();

      // Clientes nuevos este mes
      const newCustomers = await db.user.count({
        where: {
          createdAt: { gte: startOfMonth },
          role: "CUSTOMER",
        },
      });

      // Calcular cambio porcentual de ventas
      const salesChange = lastMonthSales > 0
        ? ((currentMonthSales - lastMonthSales) / lastMonthSales) * 100
        : 0;

      const formatCOP = (value: number) =>
        new Intl.NumberFormat("es-CO", {
          style: "currency",
          currency: "COP",
          minimumFractionDigits: 0,
        }).format(value);

      // Chart Data: Ventas por Mes
      const currentYear = now.getFullYear();
      const currentYearOrders = await db.order.findMany({
        where: {
          createdAt: { gte: new Date(currentYear, 0, 1) },
          status: "ENTREGADO",
        },
        select: { createdAt: true, total: true },
      });
      
      const monthlySales = new Array(12).fill(0);
      currentYearOrders.forEach((o) => {
        monthlySales[o.createdAt.getMonth()] += o.total;
      });
      const salesByMonth = monthlySales;

      // Chart Data: Categorías más vendidas
      const orderItems = await db.orderItem.findMany({
        where: {
          order: { status: "ENTREGADO" }
        },
        include: {
          product: {
            include: { category: true }
          }
        }
      });
      const categorySales: Record<string, number> = {};
      let totalCategorySales = 0;
      orderItems.forEach((item) => {
        const catName = item.product.category.name;
        if (!categorySales[catName]) categorySales[catName] = 0;
        categorySales[catName] += item.total;
        totalCategorySales += item.total;
      });
      const topCategories = Object.keys(categorySales).map(name => {
        return {
          name,
          pct: totalCategorySales > 0 ? Math.round((categorySales[name] / totalCategorySales) * 100) : 0
        };
      }).sort((a,b) => b.pct - a.pct).slice(0, 5);

      res.json({
        success: true,
        data: [
          {
            label: "Ventas del Mes",
            value: formatCOP(currentMonthSales),
            change: Math.round(salesChange * 10) / 10,
            icon: "💰",
          },
          {
            label: "Pedidos Activos",
            value: String(activeOrders),
            change: 0,
            icon: "📦",
          },
          {
            label: "Productos",
            value: String(totalProducts),
            change: 0,
            icon: "🏷️",
          },
          {
            label: "Clientes Nuevos",
            value: String(newCustomers),
            change: 0,
            icon: "👥",
          },
        ],
        charts: {
          salesByMonth,
          topCategories
        }
      });
    } catch (error) {
      next(error);
    }
  }

  static async getInventoryReport(req: Request, res: Response, next: NextFunction) {
    try {
      const products = await db.product.findMany({
        include: { category: true },
        orderBy: { stockQuantity: "asc" },
      });

      const lowStock = products.filter((p) => p.stockQuantity > 0 && p.stockQuantity < 50);
      const outOfStock = products.filter((p) => p.stockQuantity === 0);
      const negativeStock = products.filter((p) => p.stockQuantity < 0);
      const totalUnits = products.reduce((sum: number, p) => sum + p.stockQuantity, 0);

      res.json({
        success: true,
        data: {
          stats: {
            totalProducts: products.length,
            totalUnits,
            lowStockCount: lowStock.length,
            outOfStockCount: outOfStock.length,
            negativeStockCount: negativeStock.length,
          },
          products: products.map((p) => ({
            id: p.id,
            name: p.name,
            category: p.category.name,
            stockQuantity: p.stockQuantity,
            unit: p.unit,
            price: p.price,
            stockValue: p.price * p.stockQuantity,
            inStock: p.inStock,
            stockStatus: getStockStatus(p.stockQuantity),
          })),
        },
      });
    } catch (error) {
      next(error);
    }
  }
}
