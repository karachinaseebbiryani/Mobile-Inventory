import 'dotenv/config';
import mongoose, { type Model, type Types } from 'mongoose';
import { loadEnv } from '../src/config/env';
import { initializeTenantDataModels, tenantDatabaseName } from '../src/db/tenantDatabase';
import { Product, type ProductRecord } from '../src/models/Product';
import { Sale, type SaleRecord } from '../src/models/Sale';
import { Tenant } from '../src/models/Tenant';

const apply = process.argv.includes('--apply');

const copyTenantCollection = async <T extends { tenantId: Types.ObjectId }>(
  label: string,
  source: Model<T>,
  destination: Model<T>,
  tenantId: Types.ObjectId
): Promise<number> => {
  const sourceCount = await source.countDocuments({ tenantId });
  if (!apply) return sourceCount;
  const operations: mongoose.AnyBulkWriteOperation[] = [];
  for await (const document of source.find({ tenantId }).lean().cursor()) {
    operations.push({
      updateOne: {
        filter: { _id: document._id, tenantId },
        update: { $setOnInsert: document },
        upsert: true
      }
    });
    if (operations.length === 500) {
      await destination.bulkWrite(operations, { ordered: true });
      operations.length = 0;
    }
  }
  if (operations.length) await destination.bulkWrite(operations, { ordered: true });

  const destinationCount = await destination.countDocuments({ tenantId });
  if (destinationCount !== sourceCount) {
    throw new Error(`${label} verification failed for tenant ${tenantId}: ${sourceCount} source, ${destinationCount} destination.`);
  }
  return sourceCount;
};

const run = async (): Promise<void> => {
  const env = loadEnv();
  await mongoose.connect(env.PLATFORM_MONGO_URI, { autoIndex: false });
  try {
    const tenants = Tenant.find({ 'storage.mode': 'managed' })
      .select('_id name slug storage.databaseName')
      .lean()
      .cursor();
    let migrated = 0;
    for await (const tenant of tenants) {
      const targetDatabase = tenantDatabaseName(tenant._id);
      if (tenant.storage?.databaseName) {
        if (tenant.storage.databaseName !== targetDatabase) {
          throw new Error(`Unexpected managed database name for shop ${tenant.slug}.`);
        }
        continue;
      }
      if (!apply) {
        const [productCount, saleCount] = await Promise.all([
          Product.countDocuments({ tenantId: tenant._id }),
          Sale.countDocuments({ tenantId: tenant._id })
        ]);
        console.log(`${tenant.slug}: ${productCount} products, ${saleCount} sales -> ${targetDatabase}`);
        continue;
      }

      const models = await initializeTenantDataModels(tenant._id, targetDatabase);
      const [productCount, saleCount] = await Promise.all([
        copyTenantCollection<ProductRecord>('Products', Product, models.Product, tenant._id),
        copyTenantCollection<SaleRecord>('Sales', Sale, models.Sale, tenant._id)
      ]);

      const result = await Tenant.updateOne(
        { _id: tenant._id, 'storage.mode': 'managed', 'storage.databaseName': null },
        { $set: { 'storage.databaseName': targetDatabase } }
      );
      if (result.modifiedCount !== 1) {
        throw new Error(`Could not activate migrated database for shop ${tenant.slug}; data remains copied for safe retry.`);
      }
      console.log(`Migrated ${tenant.slug}: ${productCount} products, ${saleCount} sales -> ${targetDatabase}`);
      migrated += 1;
    }
    console.log(apply
      ? `Migration complete. Activated ${migrated} shop databases.`
      : 'Dry run only. Re-run with --apply to copy and activate these shop databases.');
  } finally {
    await mongoose.disconnect();
  }
};

void run().catch(error => {
  console.error('Tenant database migration failed:', error instanceof Error ? error.message : 'UnknownError');
  process.exitCode = 1;
});
