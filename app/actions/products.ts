'use server';

import { db } from '@/lib/db';
import { products, orders } from '@/lib/db/schema';
import { eq, desc, and, gte, lte, count, sql, ilike, or } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';

export async function getProducts() {
    try {
        return await db.select().from(products).orderBy(products.name);
    } catch (error) {
        console.error('Failed to get products:', error);
        return [];
    }
}

export async function getPaginatedProducts(page: number = 1, limit: number = 20, query?: string) {
    try {
        const offset = (page - 1) * limit;

        let conditions = undefined;
        if (query) {
            const searchPattern = `%${query}%`;
            conditions = or(
                ilike(products.name, searchPattern),
                ilike(products.category, searchPattern)
            );
        }

        const data = await db.select()
            .from(products)
            .where(conditions)
            .orderBy(desc(products.createdAt))
            .limit(limit)
            .offset(offset);

        const [countResult] = await db.select({ count: count() })
            .from(products)
            .where(conditions);

        const [activeResult] = await db.select({ count: count() })
            .from(products)
            .where(eq(products.active, true));

        const totalCount = countResult?.count || 0;
        const activeCount = activeResult?.count || 0;
        const totalPages = Math.ceil(totalCount / limit);

        return {
            products: data,
            totalCount,
            activeCount,
            totalPages,
            currentPage: page
        };
    } catch (error) {
        console.error('Failed to get paginated products:', error);
        return {
            products: [],
            totalCount: 0,
            activeCount: 0,
            totalPages: 0,
            currentPage: 1
        };
    }
}

export async function addProduct(data: Omit<typeof products.$inferInsert, 'id'> & { id?: string }) {
    try {
        const id = data.id || Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
        await db.insert(products).values({ ...data, id });
        await exportProductsToSheets();
        revalidatePath('/dashboard');
        revalidatePath('/');
        return { success: true };
    } catch (error: any) {
        console.error('Failed to add product:', error);
        return { success: false, error: error.message || 'Не вдалося додати товар' };
    }
}

export async function updateProduct(id: string, data: Partial<typeof products.$inferInsert>) {
    try {
        await db.update(products).set(data).where(eq(products.id, id));
        await exportProductsToSheets();
        revalidatePath('/dashboard');
        revalidatePath('/');
        return { success: true };
    } catch (error: any) {
        console.error('Failed to update product:', error);
        return { success: false, error: error.message || 'Не вдалося оновити товар' };
    }
}

export async function toggleProductStatus(id: string, active: boolean) {
    try {
        await db.update(products).set({ active }).where(eq(products.id, id));
        await exportProductsToSheets();
        revalidatePath('/dashboard');
        revalidatePath('/');
        return { success: true };
    } catch (error: any) {
        console.error('Failed to toggle product status:', error);
        return { success: false, error: error.message || 'Не вдалося змінити статус' };
    }
}
import { fetchGoogleSheetAPI, replaceSheetContent } from '@/lib/google-sheets';

export async function syncProducts() {
    try {
        const sheetId = process.env.GOOGLE_SHEET_ID;
        const sheetName = process.env.GOOGLE_SHEET_NAME || 'Sheet1';

        if (!sheetId) return { success: false, error: 'ID Google Таблиці не встановлено (GOOGLE_SHEET_ID)' };

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
                unit: rowData['unit'] || 'кг',
                unitPerCardboard: parsePrice(rowData['unit_per_cardboard'] || '0'),
                netWeight: parseWeight(rowData['net_weight'] || '0'),
                pricePerUnit: parsePrice(rowData['price_per_unit'] || rowData['price_per_kg'] || '0'),
                pricePerCardboard: parsePrice(rowData['price_per_cardboard'] || '0'),
                currency: rowData['currency'] || 'EUR',
                image: rowData['image'] || '',
                agregationResult: rowData['agregation_result'] || '',
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
    } catch (error: any) {
        console.error('Sync failed:', error);
        return { success: false, error: error.message || 'Sync failed' };
    }
}

export async function deleteProduct(id: string) {
    try {
        await db.delete(products).where(eq(products.id, id));
        await exportProductsToSheets();
        revalidatePath('/dashboard');
        revalidatePath('/');
        return { success: true };
    } catch (error: any) {
        console.error('Failed to delete product:', error);
        return { success: false, error: error.message || 'Не вдалося видалити товар' };
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


export async function getPaginatedOrders(page: number = 1, limit: number = 20, startDate?: Date, endDate?: Date) {
    try {
        const offset = (page - 1) * limit;

        // Build base conditions
        let conditions = undefined;
        if (startDate && endDate) {
            const endOfDay = new Date(endDate);
            endOfDay.setHours(23, 59, 59, 999);
            conditions = and(
                gte(orders.orderDate, startDate),
                lte(orders.orderDate, endOfDay)
            );
        }

        // Get Data
        const data = await db.select()
            .from(orders)
            .where(conditions)
            .orderBy(desc(orders.orderDate))
            .limit(limit)
            .offset(offset);

        // Get Total Count
        const [countResult] = await db.select({ count: count() })
            .from(orders)
            .where(conditions);

        const totalCount = countResult?.count || 0;
        const totalPages = Math.ceil(totalCount / limit);

        return {
            orders: data,
            totalCount,
            totalPages,
            currentPage: page
        };
    } catch (error) {
        console.error('Failed to get paginated orders:', error);
        return {
            orders: [],
            totalCount: 0,
            totalPages: 0,
            currentPage: 1
        };
    }
}



export async function getOrderStats() {
    try {
        const now = new Date();
        const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

        const [totalResult] = await db.select({ count: count() }).from(orders);
        const [dayResult] = await db.select({ count: count() }).from(orders).where(gte(orders.orderDate, oneDayAgo));
        const [weekResult] = await db.select({ count: count() }).from(orders).where(gte(orders.orderDate, oneWeekAgo));
        const [monthResult] = await db.select({ count: count() }).from(orders).where(gte(orders.orderDate, oneMonthAgo));

        return {
            total: totalResult?.count || 0,
            day: dayResult?.count || 0,
            week: weekResult?.count || 0,
            month: monthResult?.count || 0
        };
    } catch (error) {
        console.error('Failed to get order stats:', error);
        return { total: 0, day: 0, week: 0, month: 0 };
    }
}

export async function exportProductsToSheets() {
    try {
        const sheetId = process.env.GOOGLE_SHEET_ID;
        const sheetName = process.env.GOOGLE_SHEET_NAME || 'Sheet1';

        if (!sheetId) throw new Error('GOOGLE_SHEET_ID not set');

        const allProducts = await db.select().from(products).orderBy(products.createdAt);

        const headers = [
            'id', 'name', 'category', 'unit', 'unit_per_cardboard',
            'net_weight', 'price_per_unit', 'price_per_cardboard',
            'currency', 'image', 'agregation_result', 'active'
        ];

        const rows = allProducts.map(p => [
            p.id,
            p.name,
            p.category,
            p.unit,
            p.unitPerCardboard?.toString() || '0',
            p.netWeight?.toString() || '0',
            p.pricePerUnit?.toString() || '0',
            p.pricePerCardboard?.toString() || '0',
            p.currency,
            p.image || '',
            p.agregationResult || '',
            p.active ? 'true' : 'false'
        ]);

        await replaceSheetContent(sheetId, `${sheetName}!A1`, [headers, ...rows]);

        return { success: true };
    } catch (error: any) {
        console.error('Export failed:', error);
        throw new Error(`Помилка синхронізації з Google Sheets: ${error.message}`);
    }
}

export async function getSheetName() {
    return process.env.GOOGLE_SHEET_NAME || 'Sheet1';
}

export async function updateOrderStatus(orderId: string, status: string) {
    try {
        // @ts-ignore - uuid type mismatch in some versions of drizzle
        await db.update(orders).set({ status }).where(eq(orders.id, orderId));
        revalidatePath('/dashboard/orders');
        return { success: true };
    } catch (error) {
        console.error('Failed to update order status:', error);
        return { success: false, error: 'Не вдалося оновити статус замовлення' };
    }
}

export async function deleteOrder(orderId: string) {
    try {
        // @ts-ignore
        await db.delete(orders).where(eq(orders.id, orderId));
        revalidatePath('/dashboard/orders');
        return { success: true };
    } catch (error) {
        console.error('Failed to delete order:', error);
        return { success: false, error: 'Не вдалося видалити замовлення' };
    }
}
