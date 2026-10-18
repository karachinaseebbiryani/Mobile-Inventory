import mongoose, { type Connection, type Model, type Types } from 'mongoose';
import { Product, productSchema, type ProductRecord } from '../models/Product';
import { Sale, saleSchema, type SaleRecord } from '../models/Sale';

export interface TenantDataModels {
  Product: Model<ProductRecord>;
  Sale: Model<SaleRecord>;
}

const indexInitialization = new WeakMap<Connection, Promise<void>>();

export const tenantDatabaseName = (tenantId: Types.ObjectId | string): string =>
  `shop_${String(tenantId).toLowerCase()}`;

export const getTenantDataModels = (
  tenantId: Types.ObjectId,
  databaseName?: string | null
): TenantDataModels => {
  if (!databaseName) return { Product, Sale };
  const expectedDatabaseName = tenantDatabaseName(tenantId);
  if (databaseName !== expectedDatabaseName) {
    throw new Error('Shop database name does not match its tenant ID.');
  }

  const connection = mongoose.connection.useDb(databaseName, { useCache: true });
  const tenantProduct = connection.models.SaasProduct as Model<ProductRecord> | undefined;
  const tenantSale = connection.models.SaasSale as Model<SaleRecord> | undefined;
  return {
    Product: tenantProduct || connection.model<ProductRecord>('SaasProduct', productSchema),
    Sale: tenantSale || connection.model<SaleRecord>('SaasSale', saleSchema)
  };
};

export const initializeTenantDataModels = async (
  tenantId: Types.ObjectId,
  databaseName?: string | null
): Promise<TenantDataModels> => {
  const models = getTenantDataModels(tenantId, databaseName);
  if (!databaseName) return models;
  const connection = models.Product.db;
  let initialized = indexInitialization.get(connection);
  if (!initialized) {
    initialized = Promise.all([
      models.Product.createIndexes(),
      models.Sale.createIndexes()
    ]).then(() => undefined);
    indexInitialization.set(connection, initialized);
    initialized.catch(() => indexInitialization.delete(connection));
  }
  await initialized;
  return models;
};
