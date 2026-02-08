'use server';

import { db } from '@/lib/db';
import { products, orders } from '@/lib/db/schema';
import { eq, desc, and, gte, lte } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';

export async function getProducts() {
    try {
        return await db.select().from(products).orderBy(products.name);
    } catch (error) {
        console.error('Failed to get products:', error);
        return [];
    }
}

export async function addProduct(data: Omit<typeof products.$inferInsert, 'id'> & { id?: string }) {
    try {
        const id = data.id || Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
        await db.insert(products).values({ ...data, id });
        revalidatePath('/dashboard');
        revalidatePath('/');
        return { success: true };
    } catch (error) {
        console.error('Failed to add product:', error);
        return { success: false, error: 'Failed to add product' };
    }
}

export async function updateProduct(id: string, data: Partial<typeof products.$inferInsert>) {
    try {
        await db.update(products).set(data).where(eq(products.id, id));
        revalidatePath('/dashboard');
        revalidatePath('/');
        return { success: true };
    } catch (error) {
        console.error('Failed to update product:', error);
        return { success: false, error: 'Failed to update product' };
    }
}

export async function toggleProductStatus(id: string, active: boolean) {
    try {
        await db.update(products).set({ active }).where(eq(products.id, id));
        revalidatePath('/dashboard');
        revalidatePath('/');
        return { success: true };
    } catch (error) {
        console.error('Failed to toggle product status:', error);
        return { success: false, error: 'Failed to update status' };
    }
}
import { fetchGoogleSheetAPI } from '@/lib/google-sheets';

export async function syncProducts() {
    try {
        const sheetId = process.env.GOOGLE_SHEET_ID;
        const sheetName = process.env.GOOGLE_SHEET_NAME || 'Sheet1';

        if (!sheetId) throw new Error('GOOGLE_SHEET_ID not set');

        const rows = await fetchGoogleSheetAPI(sheetId, sheetName);
        if (!rows || rows.length <= 1) return { success: true, count: 0 };

        const headers = rows[0].map(h => h.trim());
        const dataRows = rows.slice(1);

        const parsePrice = (val: string) => {
            if (!val) return 0;
            const cleaned = val.replace(/[€$£]/g, '').replace(',', '.').trim();
            return parseFloat(cleaned) || 0;
        };

        const parseWeight = (val: string) => {
            if (!val) return 0;
            const cleaned = val.replace(/[a-zA-Z]/g, '').replace(',', '.').trim();
            return parseFloat(cleaned) || 0;
        };

        let importedCount = 0;
        for (const row of dataRows) {
            const rowData: Record<string, string> = {};
            headers.forEach((header, index) => {
                rowData[header] = row[index] || '';
            });

            const id = rowData['id'] || Math.random().toString(36).substr(2, 9);

            const productData = {
                id,
                name: rowData['name'] || '',
                category: rowData['category'] || 'Інше',
                price: parsePrice(rowData['price_per_unit'] || rowData['price_per_kg'] || '0'),
                pricePerCardboard: parsePrice(rowData['price_per_cardboard'] || '0'),
                cardboardWeight: parseWeight(rowData['сardboard_weight'] || rowData['cardboard_weight'] || '0'),
                unit: rowData['unit'] || 'кг',
                currency: rowData['currency'] || 'EUR',
                image: rowData['image'] || '',
                active: (rowData['active'] || '').toLowerCase() === 'true',
            };

            await db.insert(products).values(productData).onConflictDoUpdate({
                target: products.id,
                set: productData,
            });
            importedCount++;
        }

        revalidatePath('/dashboard');
        revalidatePath('/');
        return { success: true, count: importedCount };
    } catch (error) {
        console.error('Sync failed:', error);
        return { success: false, error: 'Sync failed' };
    }
}

export async function deleteProduct(id: string) {
    try {
        await db.delete(products).where(eq(products.id, id));
        revalidatePath('/dashboard');
        revalidatePath('/');
        return { success: true };
    } catch (error) {
        console.error('Failed to delete product:', error);
        return { success: false, error: 'Failed to delete product' };
    }
}

export async function getOrders(startDate?: Date, endDate?: Date) {
    try {
        let query = db.select().from(orders);

        if (startDate && endDate) {
            // Ensure we cover the full range of the end day
            const endOfDay = new Date(endDate);
            endOfDay.setHours(23, 59, 59, 999);

            return await db.select()
                .from(orders)
                .where(and(
                    gte(orders.orderDate, startDate),
                    lte(orders.orderDate, endOfDay)
                ))
                .orderBy(desc(orders.orderDate));
        }

        return await db.select().from(orders).orderBy(desc(orders.orderDate));
    } catch (error) {
        console.error('Failed to get orders:', error);
        return [];
    }
}


