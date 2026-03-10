import { eq } from 'drizzle-orm';

import { db } from '@/lib/db';
import { productMetadata } from '@/lib/db/schema';

export type ProductMetadataRow = typeof productMetadata.$inferSelect;

type ProductMetadataUpsertData = {
  image?: string;
  agregationResult?: string;
  position?: number;
};

export async function getProductMetadataRows() {
  return await db.select().from(productMetadata);
}

export async function getProductMetadataById(id: string) {
  const rows = await db.select().from(productMetadata).where(eq(productMetadata.id, id));
  return rows[0] || null;
}

export async function upsertProductMetadata(id: string, data: ProductMetadataUpsertData) {
  const updatedAt = new Date();

  await db.insert(productMetadata)
    .values({
      id,
      ...data,
      updatedAt,
    })
    .onConflictDoUpdate({
      target: productMetadata.id,
      set: {
        ...data,
        updatedAt,
      },
    });

  return { usedLegacySchema: false };
}
