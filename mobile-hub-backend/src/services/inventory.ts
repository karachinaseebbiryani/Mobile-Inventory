import mongoose, { type Model, type Types } from 'mongoose';
import { Product, type ProductRecord } from '../models/Product';

export interface ProductListOptions {
  search?: string;
  category?: string;
  page: number;
  limit: number;
  includeArchived: boolean;
}

export type NewProduct = Pick<
  ProductRecord,
  'sku' | 'name' | 'description' | 'brand' | 'model' | 'category' |
  'barcode' | 'costPriceMinor' | 'sellingPriceMinor' | 'currency' | 'reorderLevel'
>;

export type ProductUpdate = Partial<Omit<NewProduct, 'sku' | 'currency'>>;

const escapeRegex = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export const createProductFilter = (
  tenantId: Types.ObjectId,
  options: Pick<ProductListOptions, 'search' | 'category' | 'includeArchived'>
): mongoose.FilterQuery<ProductRecord> => {
  const filter: mongoose.FilterQuery<ProductRecord> = { tenantId };
  if (!options.includeArchived) filter.status = 'active';
  if (options.category) filter.category = options.category;
  if (options.search) {
    const literalSearch = new RegExp(escapeRegex(options.search), 'i');
    filter.$or = [
      { sku: literalSearch },
      { name: literalSearch },
      { brand: literalSearch },
      { model: literalSearch },
      { barcode: literalSearch }
    ];
  }
  return filter;
};

export class InventoryService {
  constructor(private readonly products: Model<ProductRecord> = Product) {}

  async list(tenantId: Types.ObjectId, options: ProductListOptions) {
    const filter = createProductFilter(tenantId, options);
    const [items, total] = await Promise.all([
      this.products.find(filter)
        .sort({ name: 1, _id: 1 })
        .skip((options.page - 1) * options.limit)
        .limit(options.limit)
        .lean(),
      this.products.countDocuments(filter)
    ]);
    return { items, total, page: options.page, limit: options.limit };
  }

  async create(
    tenantId: Types.ObjectId,
    actorId: Types.ObjectId,
    product: NewProduct
  ) {
    const [created] = await this.products.create([{
      ...product,
      tenantId,
      createdBy: actorId,
      updatedBy: actorId
    }]);
    return created;
  }

  async get(tenantId: Types.ObjectId, productId: string) {
    if (!mongoose.isValidObjectId(productId)) return null;
    return this.products.findOne({ _id: productId, tenantId }).lean();
  }

  async update(
    tenantId: Types.ObjectId,
    actorId: Types.ObjectId,
    productId: string,
    patch: ProductUpdate
  ) {
    if (!mongoose.isValidObjectId(productId)) return null;
    return this.products.findOneAndUpdate(
      { _id: productId, tenantId, status: 'active' },
      { $set: { ...patch, updatedBy: actorId } },
      { new: true, runValidators: true }
    ).lean();
  }

  async archive(tenantId: Types.ObjectId, actorId: Types.ObjectId, productId: string) {
    if (!mongoose.isValidObjectId(productId)) return null;
    return this.products.findOneAndUpdate(
      { _id: productId, tenantId, status: 'active' },
      { $set: { status: 'archived', updatedBy: actorId } },
      { new: true, runValidators: true }
    ).lean();
  }
}
