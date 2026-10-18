import mongoose, { type Types } from 'mongoose';
import { Product } from '../models/Product';
import { Sale } from '../models/Sale';
import { getTenantDataModels, type TenantDataModels } from '../db/tenantDatabase';
import { HttpError } from '../utils/http';

export interface NewSaleInput {
  items: Array<{ productId: string; quantity: number }>;
  paymentMethod: 'cash' | 'card' | 'other';
  customerName: string;
}

export const createSale = async (
  tenantId: Types.ObjectId,
  cashierId: Types.ObjectId,
  input: NewSaleInput,
  tenantModels: TenantDataModels = getTenantDataModels(tenantId)
) => {
  const { Product, Sale } = tenantModels;
  if (input.items.length === 0) {
    throw new HttpError(400, 'Add at least one product to the sale.', 'EMPTY_SALE');
  }
  const productIds = input.items.map(item => item.productId);
  if (new Set(productIds).size !== productIds.length || productIds.some(id => !mongoose.isValidObjectId(id))) {
    throw new HttpError(400, 'Sale products must be unique valid product IDs.', 'INVALID_SALE_PRODUCTS');
  }

  const session = await Product.db.startSession();
  let createdSale: Record<string, unknown> | null = null;
  try {
    await session.withTransaction(async () => {
      const products = await Product.find({
        _id: { $in: productIds },
        tenantId,
        status: 'active'
      }).session(session);
      if (products.length !== input.items.length) {
        throw new HttpError(400, 'One or more products are unavailable in this shop.', 'SALE_PRODUCT_UNAVAILABLE');
      }
      const byId = new Map(products.map(product => [String(product._id), product]));
      const lines = input.items.map(item => {
        const product = byId.get(item.productId);
        if (!product) throw new HttpError(400, 'Sale product is unavailable.', 'SALE_PRODUCT_UNAVAILABLE');
        if (product.showOnPos === false) {
          throw new HttpError(400, `${product.name} is not enabled for point of sale.`, 'PRODUCT_NOT_FOR_POS');
        }
        if (!Number.isSafeInteger(product.quantityOnHand) || product.quantityOnHand < item.quantity) {
          throw new HttpError(409, `${product.name} does not have enough stock.`, 'INSUFFICIENT_STOCK');
        }
        return {
          product,
          line: {
            productId: product._id,
            sku: product.sku,
            name: product.name,
            quantity: item.quantity,
            unitPriceMinor: product.sellingPriceMinor,
            lineTotalMinor: product.sellingPriceMinor * item.quantity
          }
        };
      });
      const currencies = new Set(lines.map(({ product }) => product.currency));
      if (currencies.size !== 1) {
        throw new HttpError(400, 'A sale cannot contain products priced in different currencies.', 'MIXED_SALE_CURRENCY');
      }
      const subtotalMinor = lines.reduce((total, { line }) => total + line.lineTotalMinor, 0);
      if (!Number.isSafeInteger(subtotalMinor)) {
        throw new HttpError(400, 'Sale total is outside the supported range.', 'SALE_TOTAL_OUT_OF_RANGE');
      }

      for (const { product, line } of lines) {
        const result = await Product.updateOne({
          _id: product._id,
          tenantId,
          status: 'active',
          quantityOnHand: { $gte: line.quantity }
        }, {
          $inc: { quantityOnHand: -line.quantity },
          $set: { updatedBy: cashierId }
        }, { session });
        if (result.modifiedCount !== 1) {
          throw new HttpError(409, `${product.name} stock changed. Refresh and try again.`, 'INSUFFICIENT_STOCK');
        }
      }

      const [sale] = await Sale.create([{
        tenantId,
        cashierId,
        items: lines.map(({ line }) => line),
        currency: lines[0]!.product.currency,
        subtotalMinor,
        totalMinor: subtotalMinor,
        paymentMethod: input.paymentMethod,
        customerName: input.customerName
      }], { session });
      if (!sale) throw new Error('Sale creation failed.');
      createdSale = sale.toJSON() as Record<string, unknown>;
    });
  } finally {
    await session.endSession();
  }
  if (!createdSale) throw new Error('Sale transaction completed without a sale record.');
  return createdSale;
};

export const listSales = async (
  tenantId: Types.ObjectId,
  page: number,
  limit: number,
  tenantModels: TenantDataModels = getTenantDataModels(tenantId)
) => {
  const { Sale } = tenantModels;
  const [items, total] = await Promise.all([
    Sale.find({ tenantId })
      .sort({ createdAt: -1, _id: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    Sale.countDocuments({ tenantId })
  ]);
  return { items, total, page, limit };
};
