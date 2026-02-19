'use server';

import { db } from '@/lib/db';
import { orders, productMetadata } from '@/lib/db/schema';
import { eq, desc, and, gte, lte, count, ilike, or } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { getFakturowniaProducts } from '@/lib/fakturownia';

import { headers } from 'next/headers';

async function verifyAuth() {
    const list = await headers();
    const authHeader = list.get('authorization');
    if (!authHeader) {
        throw new Error('Unauthorized');
    }

    const authValue = authHeader.split(' ')[1];
    const [user, pwd] = atob(authValue).split(':');

    if (user !== process.env.DASHBOARD_USER || pwd !== process.env.DASHBOARD_PASSWORD) {
        throw new Error('Unauthorized');
    }
}

export async function getProducts() {
    await verifyAuth();
    try {
        return await getFakturowniaProducts();
    } catch (error) {
        console.error('Failed to get products:', error);
        return [];
    }
}

export async function getPaginatedProducts(page: number = 1, limit: number = 20, query?: string) {
    await verifyAuth();
    try {
        const allProducts = await getFakturowniaProducts();

        let filtered = allProducts;
        if (query) {
            const lowerQuery = query.toLowerCase();
            filtered = allProducts.filter(p =>
                p.name.toLowerCase().includes(lowerQuery) ||
                p.category.toLowerCase().includes(lowerQuery)
            );
        }

        // Active products count (from filtered or all? usually all context)
        const activeCount = allProducts.filter(p => p.active).length;
        const totalCount = filtered.length;
        const totalPages = Math.ceil(totalCount / limit);

        const offset = (page - 1) * limit;
        const paginated = filtered.slice(offset, offset + limit);

        return {
            products: paginated,
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

export async function addProduct(data: any) {
    await verifyAuth();
    return { success: false, error: 'Додавання товарів вимкнено. Використовуйте Fakturownia.' };
}

export async function updateProduct(id: string, data: any) {
    await verifyAuth();
    return { success: false, error: 'Редагування товарів вимкнено. Використовуйте Fakturownia.' };
}

export async function toggleProductStatus(id: string, active: boolean) {
    await verifyAuth();
    return { success: false, error: 'Зміна статусу вимкнена. Використовуйте Fakturownia.' };
}
import { fetchGoogleSheetAPI, replaceSheetContent } from '@/lib/google-sheets';

export async function syncProducts() {
    await verifyAuth();
    return { success: false, error: 'Синхронізація вимкнена. Використовується Fakturownia API.' };
}

export async function deleteProduct(id: string) {
    await verifyAuth();
    return { success: false, error: 'Видалення товарів вимкнено. Використовуйте Fakturownia.' };
}

// getOrders
export async function getOrders(startDate?: Date, endDate?: Date) {
    await verifyAuth();
    try {
        let query = db.select().from(orders);

        if (startDate && endDate) {
            // Ensure we cover the full range of the end day
            const endOfDay = new Date(endDate);
            endOfDay.setUTCHours(23, 59, 59, 999);

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
    await verifyAuth();
    try {
        const offset = (page - 1) * limit;

        // Build base conditions
        let conditions = undefined;
        if (startDate && endDate) {
            const endOfDay = new Date(endDate);
            endOfDay.setUTCHours(23, 59, 59, 999);
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
    await verifyAuth();
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
    await verifyAuth();
    console.log('Export disabled due to Fakturownia integration');
    return { success: true };
}

export async function getSheetName() {
    return process.env.GOOGLE_SHEET_NAME || 'Sheet1';
}

export async function updateOrderStatus(orderId: string, status: string) {
    await verifyAuth();
    try {
        // @ts-ignore - uuid type mismatch in some versions of drizzle
        await db.update(orders).set({ status }).where(eq(orders.id, orderId));
        revalidatePath('/466ed1254c89ccf77b8dab3da30f8692/orders');
        return { success: true };
    } catch (error) {
        console.error('Failed to update order status:', error);
        return { success: false, error: 'Не вдалося оновити статус замовлення' };
    }
}

export async function deleteOrder(orderId: string) {
    await verifyAuth();
    try {
        // @ts-ignore
        await db.delete(orders).where(eq(orders.id, orderId));
        revalidatePath('/466ed1254c89ccf77b8dab3da30f8692/orders');
        return { success: true };
    } catch (error) {
        console.error('Failed to delete order:', error);
        return { success: false, error: 'Не вдалося видалити замовлення' };
    }
}



export async function exportAggregationToSheets(startDate: string, endDate: string) {
    await verifyAuth();
    try {
        const start = new Date(startDate);
        const end = new Date(endDate);
        end.setUTCHours(23, 59, 59, 999);

        // Fetch Orders
        const filteredOrders = await db.select()
            .from(orders)
            .where(and(
                gte(orders.orderDate, start),
                lte(orders.orderDate, end),
                eq(orders.status, 'completed')
            ));

        if (filteredOrders.length === 0) {
            return { success: false, error: 'Замовлень не знайдено за цей період' };
        }

        // Populate Headers from ALL existing products (Fakturownia)
        const allProducts = await getFakturowniaProducts();

        // Load local product metadata for fallback
        const metadata = await db.select().from(productMetadata);
        const metadataMap = new Map<string, typeof metadata[0]>();
        metadata.forEach(m => metadataMap.set(m.id, m));

        const productLookup = new Map();
        const headerKeys = new Set<string>();

        allProducts.forEach(p => {
            // Force weight aggregation
            const unitLabel = '(кг)';

            const key = `${p.name} [ID:${p.id}]`;
            // Store parse logic for later use if needed, but we rely on item mostly
            productLookup.set(p.id, p);
            productLookup.set(key, p);

            headerKeys.add(key);
        });

        // --- NEW LOGIC: Scan orders for products that might be missing from Fakturownia ---
        filteredOrders.forEach(order => {
            const items = Array.isArray(order.items) ? (order.items as any[]) : [];
            items.forEach(item => {
                const key = item.name;
                const productId = item.productId || 'unknown';
                const complexKey = `${key} [ID:${productId}]`;

                // Only proceed if this specific product (by ID) is not yet in headers
                if (key && !headerKeys.has(complexKey)) {
                    const meta = metadataMap.get(productId);

                    // We need to set the lookup for the COMPLEX key
                    productLookup.set(complexKey, {
                        id: productId,
                        name: key,
                        // Force weight
                        agregationResult: 'weight',
                        netWeight: Number(item.netWeight) || 0,
                        unitPerCardboard: Number(item.unitPerCardboard) || 0,
                        // Use position from metadata if available to keep sorting consistent
                        position: meta?.position ?? 0,
                        additionalInfo: item.additionalInfo
                    });

                    headerKeys.add(complexKey);
                }
            });
        });

        // Sort Headers
        const sortedKeys = Array.from(headerKeys).sort((a, b) => {
            const prodA = productLookup.get(a);
            const prodB = productLookup.get(b);
            const posA = prodA?.position || 0;
            const posB = prodB?.position || 0;

            if (posA !== posB) {
                return posB - posA; // Higher position first
            }
            return a.localeCompare(b, 'uk');
        });

        // Helper to get column letter (0-based index)
        const getColLetter = (n: number) => {
            let s = "";
            while (n >= 0) {
                s = String.fromCharCode(n % 26 + 65) + s;
                n = Math.floor(n / 26) - 1;
            }
            return s;
        };

        // Simplified Header Row
        const headerRow = ['Клієнт', 'Вага', ...sortedKeys.map(k => {
            const p = productLookup.get(k);
            const unit = p?.unit || 'kg';
            const isWeight = unit === 'kg' || unit === 'g' || unit === 'кг' || (p?.netWeight && p.netWeight > 0);
            return `${k} (${isWeight ? 'кг' : 'шт'})`;
        })];

        // Prepare Rows
        const dataRows: any[][] = [];

        for (let i = 0; i < filteredOrders.length; i++) {
            const order = filteredOrders[i];
            const items = Array.isArray(order.items) ? (order.items as any[]) : [];
            const orderWeights = new Map<string, number>();

            // Calculate product weights
            for (const item of items) {
                // Determine product
                // First try to find by ID to get the primary key from lookup
                let primaryKey = null;

                // We need to find which key in headerKeys corresponds to this product ID
                for (const k of sortedKeys) {
                    const p = productLookup.get(k);
                    if (p && String(p.id) === String(item.productId)) {
                        primaryKey = k;
                        break;
                    }
                }

                // Fallback: match by name
                if (!primaryKey && item.name) {
                    for (const k of sortedKeys) {
                        if (k.startsWith(item.name + ' [ID:')) {
                            primaryKey = k;
                            break;
                        }
                    }
                }

                if (primaryKey) {
                    const product = productLookup.get(primaryKey);
                    const qty = Number(item.quantity) || 0;
                    // STRENGTHENED UNIT CHECK LOGIC
                    const rawUnit = String(item.unit || product?.unit || '').trim().toLowerCase();
                    const isWeightUnit = rawUnit === 'kg' || rawUnit === 'g' || rawUnit === 'кг' || rawUnit === 'г';

                    let valueToAdd = 0;

                    if (isWeightUnit) {
                        // IT IS WEIGHT: use quantity directly
                        valueToAdd = qty;
                    } else {
                        // IT IS PIECES: use package count * weight per package
                        // Weight = Packages * WeightPerPackage
                        let pkgCount = item.packageCount;

                        if (!pkgCount) {
                            // Fallback 1: Try parse additionalInfo
                            const parsed = parseInt(item.additionalInfo);
                            if (!isNaN(parsed)) {
                                pkgCount = parsed;
                            } else {
                                // Fallback 2: Calculate from units per cardboard
                                const inPack = Number(item.unitPerCardboard || product?.unitPerCardboard || 1);
                                pkgCount = inPack > 0 ? (qty / inPack) : 0;
                            }
                        }

                        // Determine weight per package
                        const weightPerPack = Number(item.netWeight || product?.netWeight || 0);
                        valueToAdd = (pkgCount || 0) * weightPerPack;
                    }

                    const current = orderWeights.get(primaryKey) || 0;
                    orderWeights.set(primaryKey, current + valueToAdd);
                }
            }

            // Calculate row total weight
            let rowTotalWeight = 0;
            for (const item of items) {
                const qty = Number(item.quantity) || 0;

                // Find product for fallback
                let product = null;
                // Try to find by ID
                if (item.productId) product = productLookup.get(Number(item.productId));
                else {
                    // Startswith lookup (less reliable but fallback)
                    for (const k of sortedKeys) {
                        if (k.startsWith(item.name + ' [ID:')) {
                            product = productLookup.get(k);
                            break;
                        }
                    }
                }

                // STRENGTHENED UNIT CHECK LOGIC FOR TOTAL ROW
                const rawUnit = String(item.unit || product?.unit || '').trim().toLowerCase();
                const isWeightUnit = rawUnit === 'kg' || rawUnit === 'g' || rawUnit === 'кг' || rawUnit === 'г';

                let weight = 0;

                if (isWeightUnit) {
                    weight = qty;
                } else {
                    // Pieces -> Weight
                    let pkgCount = item.packageCount;
                    if (!pkgCount) {
                        const parsed = parseInt(item.additionalInfo);
                        if (!isNaN(parsed)) pkgCount = parsed;
                        else {
                            const inPack = Number(item.unitPerCardboard || product?.unitPerCardboard || 1);
                            pkgCount = inPack > 0 ? (qty / inPack) : 0;
                        }
                    }
                    const weightPerPack = Number(item.netWeight || product?.netWeight || 0);
                    weight = (pkgCount || 0) * weightPerPack;
                }

                rowTotalWeight += weight;
            }

            const row: any[] = [
                order.customerName || 'Unknown',
                rowTotalWeight
            ];

            for (const key of sortedKeys) {
                const val = orderWeights.get(key);
                row.push(val !== undefined ? val : 0);
            }

            dataRows.push(row);
        }

        // Add Logic for Totals (Formulas)
        const footerRow: any[] = ['TOTAL', 0]; // Index 1 is Weight Total

        // Products start at index 2
        for (let k = 0; k < sortedKeys.length; k++) {
            footerRow.push(0);
        }

        if (dataRows.length > 0) {
            // Row indices for formulas are 1-based.
            // Header is Row 1. Data starts Row 2.
            // End Data Row is 1 + dataRows.length.

            const startRow = 2;
            const endRow = 1 + dataRows.length;

            footerRow[1] = `=SUM(B${startRow}:B${endRow})`;

            // Formulas for Products (starting Column C - Index 2)
            sortedKeys.forEach((_, idx) => {
                const colLetter = getColLetter(2 + idx); // 0=A, 1=B, 2=C...
                footerRow[2 + idx] = `=SUM(${colLetter}${startRow}:${colLetter}${endRow})`;
            });
        }

        const values = [headerRow, ...dataRows, footerRow];

        // Export to Google Sheets
        const sheetId = process.env.GOOGLE_SHEET_ORDERS_ID;
        if (!sheetId) throw new Error('Google Sheet ID not configured');

        const { createSheet, replaceSheetContent, formatSheetCells } = await import('@/lib/google-sheets');

        const formatDate = (d: Date) => d.toLocaleDateString('uk-UA', { day: '2-digit', month: '2-digit', timeZone: 'Europe/Berlin' });
        const formatTime = (d: Date) => d.toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Berlin', hour12: false });
        const title = `Звіт ${formatDate(start)} - ${formatDate(end)} (${formatDate(new Date())} ${formatTime(new Date())})`;

        const sheetIdNum = await createSheet(sheetId, title);
        await replaceSheetContent(sheetId, `${title}!A1`, values);

        // Apply formatting
        if (sheetIdNum !== null) {
            const requests: any[] = [];

            // Format for weight column (column B, index 1)
            // It's always kg
            requests.push({
                repeatCell: {
                    range: {
                        sheetId: sheetIdNum,
                        startRowIndex: 1, // Skip header
                        startColumnIndex: 1,
                        endColumnIndex: 2
                    },
                    cell: {
                        userEnteredFormat: {
                            numberFormat: {
                                type: 'NUMBER',
                                pattern: '0.00 "kg"'
                            }
                        }
                    },
                    fields: 'userEnteredFormat.numberFormat'
                }
            });

            // Format for Product Columns (index 2 to 2+length)
            sortedKeys.forEach((key, idx) => {
                const colIndex = 2 + idx;

                const p = productLookup.get(key);
                const unit = p?.unit || 'kg';
                const isWeight = unit === 'kg' || unit === 'g' || unit === 'кг' || (p?.netWeight && p.netWeight > 0);

                const pattern = isWeight ? '0.00 "kg"' : '0 "шт"';

                requests.push({
                    repeatCell: {
                        range: {
                            sheetId: sheetIdNum,
                            startRowIndex: 1, // Skip header
                            startColumnIndex: colIndex,
                            endColumnIndex: colIndex + 1
                        },
                        cell: {
                            userEnteredFormat: {
                                numberFormat: {
                                    type: 'NUMBER',
                                    pattern: pattern
                                }
                            }
                        },
                        fields: 'userEnteredFormat.numberFormat'
                    }
                });
            });

            if (requests.length > 0) {
                // Add header bold formatting
                requests.push({
                    repeatCell: {
                        range: {
                            sheetId: sheetIdNum,
                            startRowIndex: 0,
                            endRowIndex: 1,
                            startColumnIndex: 0,
                            endColumnIndex: headerRow.length
                        },
                        cell: {
                            userEnteredFormat: {
                                textFormat: {
                                    bold: true
                                }
                            }
                        },
                        fields: 'userEnteredFormat.textFormat.bold'
                    }
                });

                // Add Weight Column (Column B, index 1) bold formatting for all rows (Header to Footer)
                const totalRows = dataRows.length + 2; // Header + Data + Footer
                requests.push({
                    repeatCell: {
                        range: {
                            sheetId: sheetIdNum,
                            startRowIndex: 1, // Skip header
                            endRowIndex: totalRows,
                            startColumnIndex: 1,
                            endColumnIndex: 2
                        },
                        cell: {
                            userEnteredFormat: {
                                textFormat: {
                                    bold: true,
                                    fontSize: 12
                                },
                                numberFormat: {
                                    type: 'NUMBER',
                                    pattern: '0.00 "kg"'
                                }
                            }
                        },
                        fields: 'userEnteredFormat.textFormat(bold,fontSize),userEnteredFormat.numberFormat'
                    }
                });

                // Add Zebra Striping (Alternating Grey Rows)
                // Data starts at Row index 1 (Header is 0)
                // We want to color every OTHER row. e.g. 1, 3, 5...
                for (let i = 0; i < dataRows.length; i++) {
                    if (i % 2 === 1) { // Color odd rows (0-based index relative to data array)
                        const rowIndex = 1 + i; // Convert to sheet row index (1-based because header is 0)
                        requests.push({
                            repeatCell: {
                                range: {
                                    sheetId: sheetIdNum,
                                    startRowIndex: rowIndex,
                                    endRowIndex: rowIndex + 1,
                                    startColumnIndex: 0,
                                    endColumnIndex: headerRow.length
                                },
                                cell: {
                                    userEnteredFormat: {
                                        backgroundColor: {
                                            red: 0.96,
                                            green: 0.96,
                                            blue: 0.96
                                        }
                                    }
                                },
                                fields: 'userEnteredFormat.backgroundColor'
                            }
                        });
                    }
                }

                // Add footer bold as well
                const lastRowIndex = 1 + dataRows.length;
                requests.push({
                    repeatCell: {
                        range: {
                            sheetId: sheetIdNum,
                            startRowIndex: lastRowIndex,
                            endRowIndex: lastRowIndex + 1,
                            startColumnIndex: 0,
                            endColumnIndex: headerRow.length
                        },
                        cell: {
                            userEnteredFormat: {
                                textFormat: {
                                    bold: true,
                                    fontSize: 12
                                }
                            }
                        },
                        fields: 'userEnteredFormat.textFormat(bold,fontSize)'
                    }
                });

                await formatSheetCells(sheetId, sheetIdNum, requests);
            }
        }

        const sheetUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/edit#gid=${sheetIdNum}`;

        return { success: true, sheetName: title, sheetUrl };
    } catch (error: any) {
        console.error('Export failed:', error);
        return { success: false, error: error.message };
    }
}

export async function updateProductMetadata(id: string, data: { image?: string; agregationResult?: string; position?: number }) {
    await verifyAuth();
    try {
        await db.insert(productMetadata)
            .values({
                id,
                ...data,
                updatedAt: new Date()
            })
            .onConflictDoUpdate({
                target: productMetadata.id,
                set: {
                    ...data,
                    updatedAt: new Date()
                }
            });

        revalidatePath('/');
        return { success: true };
    } catch (error) {
        console.error('Failed to update product metadata:', error);
        return { success: false, error: 'Failed to update metadata' };
    }
}

export async function getAggregationData(startDate: string, endDate: string) {
    await verifyAuth();
    try {
        const start = new Date(startDate);
        const end = new Date(endDate);
        end.setUTCHours(23, 59, 59, 999);

        // Fetch Orders
        const filteredOrders = await db.select()
            .from(orders)
            .where(and(
                gte(orders.orderDate, start),
                lte(orders.orderDate, end),
                eq(orders.status, 'completed')
            ));

        if (filteredOrders.length === 0) {
            return { success: false, error: 'Замовлень не знайдено за цей період' };
        }

        // Populate Headers from ALL existing products (Fakturownia)
        const allProducts = await getFakturowniaProducts();

        // Load local product metadata for fallback
        const metadata = await db.select().from(productMetadata);
        const metadataMap = new Map<string, typeof metadata[0]>();
        metadata.forEach(m => metadataMap.set(m.id, m));

        const productLookup = new Map();
        const headerKeys = new Set<string>();

        allProducts.forEach(p => {
            // Check metadata for aggregation result
            // Force weight aggregation
            const unitLabel = '(кг)';

            const key = `${p.name} [ID:${p.id}]`;
            // Store parse logic for later use if needed, but we rely on item mostly
            productLookup.set(p.id, p);
            productLookup.set(key, p);
            headerKeys.add(key);
        });

        // Scan orders for products that might be missing from Fakturownia
        filteredOrders.forEach(order => {
            const items = Array.isArray(order.items) ? (order.items as any[]) : [];
            items.forEach(item => {
                const key = item.name;
                const productId = item.productId || 'unknown';
                const complexKey = `${key} [ID:${productId}]`;

                if (key && !headerKeys.has(complexKey)) {
                    const meta = metadataMap.get(productId);

                    productLookup.set(complexKey, {
                        id: productId,
                        name: key,
                        agregationResult: 'weight', // Force weight
                        netWeight: Number(item.netWeight) || 0,
                        unitPerCardboard: Number(item.unitPerCardboard) || 0,
                        position: meta?.position ?? 0,
                        additionalInfo: item.additionalInfo
                    });

                    headerKeys.add(complexKey);
                }
            });
        });

        // Sort Headers by Position (descending - higher first) then Name
        const sortedKeys = Array.from(headerKeys).sort((a, b) => {
            const prodA = productLookup.get(a);
            const prodB = productLookup.get(b);
            const posA = prodA?.position || 0;
            const posB = prodB?.position || 0;

            if (posA !== posB) {
                return posB - posA; // Higher position first
            }
            return a.localeCompare(b, 'uk');
        });

        // Simplified Header Row: Customer Name, Total Weight, Products...
        // Simplified Header Row
        const headerRow = ['Клієнт', 'Вага', ...sortedKeys.map(k => {
            const p = productLookup.get(k);
            const unit = p?.unit || 'kg';
            const rawUnit = String(unit).trim().toLowerCase();
            const isService = ['godz', 'h', 'min', 'm', 'usł', 'srv', 'km'].includes(rawUnit);
            const isWeight = !isService && (rawUnit === 'kg' || rawUnit === 'g' || rawUnit === 'кг' || (p?.netWeight && p.netWeight > 0));
            return `${k} (${unit})`;
        })];

        // Prepare Header Metadata for Tooltips
        const headerMetadata = [null, null, ...sortedKeys.map(k => {
            const p = productLookup.get(k);
            return p ? {
                id: p.id,
                name: p.name,
                unit: p.unit,
                netWeight: p.netWeight,
                unitPerCardboard: p.unitPerCardboard,
                pricePerUnit: p.pricePerUnit,
                currency: p.currency, // Added
                agregationResult: p.agregationResult,
                additionalInfo: p.additionalInfo
            } : null;
        })];

        // Prepare Rows
        const dataRows: any[][] = [];
        const packageCountRows: any[][] = [];
        const clientEmails: { [rowIdx: number]: string } = {};


        for (let i = 0; i < filteredOrders.length; i++) {
            const order = filteredOrders[i];
            const items = Array.isArray(order.items) ? (order.items as any[]) : [];
            const orderWeights = new Map<string, number>();
            const orderPackageCounts = new Map<string, { count: number, packageType: string }>();

            for (const item of items) {
                // Determine product
                // First try to find by ID to get the primary key from lookup
                let primaryKey = null;

                // We need to find which key in headerKeys corresponds to this product ID
                for (const k of sortedKeys) {
                    const p = productLookup.get(k);
                    if (p && String(p.id) === String(item.productId)) {
                        primaryKey = k;
                        break;
                    }
                }

                // Fallback: try match by name if ID is unknown/missing
                if (!primaryKey && item.name) {
                    for (const k of sortedKeys) {
                        if (k.startsWith(item.name + ' [ID:')) {
                            primaryKey = k;
                            break;
                        }
                    }
                }

                if (primaryKey) {
                    const product = productLookup.get(primaryKey);
                    const qty = Number(item.quantity) || 0;

                    const rawUnit = String(item.unit || product?.unit || '').trim().toLowerCase();
                    const isItemWeightUnit = rawUnit === 'kg' || rawUnit === 'g' || rawUnit === 'кг' || rawUnit === 'г';
                    const hasNetWeight = (item.netWeight && Number(item.netWeight) > 0) || (product?.netWeight && Number(product.netWeight) > 0);

                    let valueToAdd = 0;
                    let pkgCountToAdd = 0;

                    // --- Value calculation (differs by unit type) ---
                    if (isItemWeightUnit) {
                        // Weight-based: quantity is already weight
                        valueToAdd = qty;
                    } else if (hasNetWeight) {
                        // Piece-based with known weight: calculate total weight
                        // Need pkg count first for weight calculation
                        let pkgForWeight = Number(item.packageCount) || 0;
                        if (pkgForWeight <= 0) {
                            const parsed = parseInt(item.additionalInfo);
                            if (!isNaN(parsed) && parsed > 0) pkgForWeight = parsed;
                            else {
                                const inPack = Number(item.unitPerCardboard || product?.unitPerCardboard || 1);
                                pkgForWeight = inPack > 0 ? (qty / inPack) : 0;
                            }
                        }
                        const weightPerPack = Number(item.netWeight || product?.netWeight || 0);
                        valueToAdd = (pkgForWeight || 0) * weightPerPack;
                    } else {
                        // Piece-based without weight: just use quantity
                        valueToAdd = qty;
                    }

                    // --- Package count (UNIVERSAL for all unit types) ---
                    // Priority 1: Explicit packageCount from order (set at checkout)
                    // Check if packageCount is defined (even if 0), not just truthy
                    if (item.packageCount !== null && item.packageCount !== undefined) {
                        pkgCountToAdd = Number(item.packageCount);
                    } else {
                        // Priority 2: Parse from additionalInfo (e.g. "3 wor" → 3, "2 kart" → 2)
                        const parsed = parseInt(item.additionalInfo);
                        if (!isNaN(parsed) && parsed > 0) {
                            pkgCountToAdd = parsed;
                        } else {
                            // Priority 3: Mathematical fallback
                            if (isItemWeightUnit) {
                                // For weight: packages = total weight / weight per package
                                const weightPerPack = Number(item.netWeight || product?.netWeight || 0);
                                pkgCountToAdd = weightPerPack > 0 ? (qty / weightPerPack) : (qty > 0 ? 1 : 0);
                            } else {
                                // For pieces: packages = total pieces / pieces per package
                                const inPack = Number(item.unitPerCardboard || product?.unitPerCardboard || 1);
                                pkgCountToAdd = inPack > 0 ? (qty / inPack) : (qty > 0 ? 1 : 0);
                            }
                        }
                    }

                    const current = orderWeights.get(primaryKey) || 0;
                    orderWeights.set(primaryKey, current + valueToAdd);

                    const currentPkg = orderPackageCounts.get(primaryKey) || { count: 0, packageType: 'kart' };
                    // If multiple items, we might overwrite type, but usually it's consistent.
                    // Prefer existing type if not 'kart', or new type if provided.
                    const existingType = currentPkg.packageType;
                    const newType = item.packageType || 'kart';
                    // Simple logic: if newType is not 'kart', use it. Else stick with existing unless it's also 'kart'.
                    // Actually, if we have a real type 'wor', we want to keep it.
                    const finalType = (newType !== 'kart') ? newType : existingType;

                    orderPackageCounts.set(primaryKey, {
                        count: currentPkg.count + pkgCountToAdd,
                        packageType: finalType
                    });
                }
            }

            // Calculate Total Weight for this row
            let rowTotalWeight = 0;

            for (const item of items) {
                const qty = Number(item.quantity) || 0;

                // Find product
                let product = null;
                if (item.productId) product = productLookup.get(Number(item.productId));
                else {
                    for (const k of sortedKeys) {
                        if (k.startsWith(item.name + ' [ID:')) {
                            product = productLookup.get(k);
                            break;
                        }
                    }
                }

                const rawUnit = String(item.unit || product?.unit || '').trim().toLowerCase();
                const isService = ['godz', 'h', 'min', 'm', 'usł', 'srv', 'km'].includes(rawUnit);
                const isItemWeightUnit = rawUnit === 'kg' || rawUnit === 'g' || rawUnit === 'кг' || rawUnit === 'г';
                const hasNetWeight = !isService && ((item.netWeight && Number(item.netWeight) > 0) || (product?.netWeight && Number(product.netWeight) > 0));

                let weight = 0;

                if (isItemWeightUnit) {
                    weight = qty;
                } else if (hasNetWeight) {
                    let pkgCount = item.packageCount;
                    if (!pkgCount) {
                        const parsed = parseInt(item.additionalInfo);
                        if (!isNaN(parsed)) pkgCount = parsed;
                        else {
                            const inPack = Number(item.unitPerCardboard || product?.unitPerCardboard || 1);
                            pkgCount = inPack > 0 ? (qty / inPack) : 0;
                        }
                    }
                    const weightPerPack = Number(item.netWeight || product?.netWeight || 0);
                    weight = (pkgCount || 0) * weightPerPack;
                } else {
                    // Case 3: Pure pieces.
                    // New Requirement: Treat as 1kg per package
                    let pkgCount = item.packageCount;
                    if (!pkgCount && pkgCount !== 0) { // Check strictly for null/undefined if 0 is valid
                        const parsed = parseInt(item.additionalInfo);
                        if (!isNaN(parsed) && parsed > 0) {
                            pkgCount = parsed;
                        } else {
                            // Only if we can infer package count
                            const inPack = Number(item.unitPerCardboard || product?.unitPerCardboard || 1);
                            if (inPack > 0) {
                                pkgCount = (qty / inPack);
                            } else {
                                // If no package info, treat as 0 weight or 0 packages?
                                // If it's pure pieces and we have NO idea about packages, likely 0.
                                // But if it's "10 pcs", maybe it's 1 package?
                                // Safer to assume 1 package if qty > 0 and no other info?
                                // User said "1 package = 1kg".
                                // If we don't know packages, we can't add weight.
                                pkgCount = 0;
                            }
                        }
                    }

                    if (pkgCount > 0) {
                        weight = pkgCount * 1; // 1kg per package
                    }
                }

                rowTotalWeight += weight;
            }


            let rowTotalPkgCount = 0;
            orderPackageCounts.forEach(val => {
                rowTotalPkgCount += val.count;
            });

            const row: any[] = [
                order.customerName || 'Unknown', // Column 0
                rowTotalWeight                   // Column 1
            ];

            const pkgRow: any[] = [null, rowTotalPkgCount];

            for (const key of sortedKeys) {
                const val = orderWeights.get(key);
                row.push(val !== undefined ? val : 0);
                const pkg = orderPackageCounts.get(key);
                pkgRow.push(pkg ? pkg : { count: 0, packageType: 'kart' });
            }

            dataRows.push(row);
            packageCountRows.push(pkgRow);
            clientEmails[i] = order.customerEmail || '';
        }



        // Footer Row
        // Column 0: TOTAL label
        // Column 1: Total Weight Sum
        // Column 2+: Product Sums
        const footerRow: any[] = ['TOTAL', 0];

        // Initialize product totals
        for (let k = 0; k < sortedKeys.length; k++) {
            footerRow.push(0);
        }

        // Calculate columns sums
        dataRows.forEach(row => {
            // Weight column is index 1 now
            footerRow[1] = (footerRow[1] as number) + (Number(row[1]) || 0);

            // Product columns start at index 2
            for (let j = 0; j < sortedKeys.length; j++) {
                const colIndex = 2 + j;
                footerRow[colIndex] = (footerRow[colIndex] as number) + (Number(row[colIndex]) || 0);
            }
        });

        // Calculate columns sums for package counts
        const packageCountFooter: any[] = ['TOTAL', 0];
        for (let k = 0; k < sortedKeys.length; k++) {
            packageCountFooter.push(0);
        }

        // Initialize package types map for footer columns
        const footerPackageTypes = new Map<number, string>();

        packageCountRows.forEach((row: any[]) => {
            // Summary for index 1 (Total packages)
            if (row[1] !== null) {
                packageCountFooter[1] = (packageCountFooter[1] as number) + (Number(row[1]) || 0);
            }

            for (let j = 0; j < sortedKeys.length; j++) {
                const colIndex = 2 + j;
                const cell = row[colIndex];
                const count = typeof cell === 'object' && cell !== null ? cell.count : (Number(cell) || 0);
                const type = typeof cell === 'object' && cell !== null ? cell.packageType : 'kart';

                packageCountFooter[colIndex] = (packageCountFooter[colIndex] as number) + count;

                // Store package type, preferring non-'kart' types
                if (count > 0) {
                    const existingType = footerPackageTypes.get(colIndex);
                    // Update if: no type yet, OR existing is 'kart' but new is not
                    if (!existingType || (existingType === 'kart' && type !== 'kart')) {
                        footerPackageTypes.set(colIndex, type);
                    }
                }
            }
        });

        // Convert footer numbers to objects with package types
        for (let j = 0; j < sortedKeys.length; j++) {
            const colIndex = 2 + j;
            const totalCount = packageCountFooter[colIndex] as number;
            const type = footerPackageTypes.get(colIndex) || 'kart';
            if (totalCount > 0) {
                packageCountFooter[colIndex] = { count: totalCount, packageType: type };
            }
        }

        return {
            success: true,
            data: {
                headers: headerRow,
                headerMetadata: headerMetadata,
                rows: dataRows,
                packageCountRows: packageCountRows,
                footer: footerRow,
                packageCountFooter: packageCountFooter,
                clientEmails: clientEmails,
                // Store order metadata for each row to enable invoice generation
                orderMetadata: filteredOrders.map(order => ({
                    orderId: order.id,
                    customerName: order.customerName,
                    customerEmail: order.customerEmail,
                    orderDate: order.orderDate,
                    originalItems: order.items, // Original order items with all details
                    fakturowniaClientId: order.fakturowniaClientId,
                    currency: order.currency
                }))
            }
        };

    } catch (error) {
        console.error('Failed to get aggregation data:', error);
        return { success: false, error: 'Не вдалося отримати дані для звіту' };
    }
}

export async function updateOrderCell(orderId: string, field: string, value: any) {
    await verifyAuth();
    try {
        console.log(`Updating order ${orderId}, field: ${field}, value: ${value}`);

        if (field === 'Invoice Status') {
            await db.update(orders).set({ invoiceStatus: value }).where(eq(orders.id, orderId));
            return { success: true };
        }

        if (field === 'Invoice Result') {
            await db.update(orders).set({ invoice: value }).where(eq(orders.id, orderId));
            return { success: true };
        }

        if (field === 'Client ID') {
            const clientId = Number(value);
            if (!isNaN(clientId)) {
                await db.update(orders).set({ fakturowniaClientId: clientId }).where(eq(orders.id, orderId));
                return { success: true };
            }
            return { success: false, error: 'Invalid Client ID' };
        }

        // Handle Product Updates
        const idMatch = field.match(/\[ID:(.*?)\]/);
        if (idMatch) {
            const productId = idMatch[1];

            // Fetch the order
            const filteredOrders = await db.select().from(orders).where(eq(orders.id, orderId));
            const order = filteredOrders[0];

            if (!order) return { success: false, error: 'Order not found' };

            const items = Array.isArray(order.items) ? (order.items as any[]) : [];
            const itemIndex = items.findIndex((i: any) => {
                if (i.productId === productId) return true;
                if (!i.productId && productId === 'unknown') {
                    // Extract name by splitting at " [ID:" since it always separates name and ID
                    // The format is: "Product Name [ID:unknown] (unit info)"
                    const nameFromField = field.split(' [ID:')[0];
                    return i.name === nameFromField;
                }
                return false;
            });

            if (itemIndex === -1) {
                return { success: false, error: 'Item not found in order' };
            }

            const item = items[itemIndex];
            const newValue = Number(value);

            // Check metadata/defaults for this product.
            const metaResults = await db.select().from(productMetadata).where(eq(productMetadata.id, productId));
            const meta = metaResults[0];
            const aggResult = meta?.agregationResult || 'weight'; // default

            if (aggResult === 'cardboard') {
                // Cell value is Quantity (pcs)
                items[itemIndex].quantity = newValue;
            } else {
                // Cell value is Weight (kg)
                if (item.unit === 'kg') {
                    // It's loose weight. Quantity is weight.
                    items[itemIndex].quantity = newValue;
                } else {
                    // It's a box.
                    if (items[itemIndex].quantity > 0) {
                        const newNetWeight = newValue / items[itemIndex].quantity;
                        items[itemIndex].netWeight = newNetWeight;
                        if (items[itemIndex].cardboardWeight) items[itemIndex].cardboardWeight = newNetWeight;
                    }
                }
            }

            // Save order
            await db.update(orders).set({ items: items }).where(eq(orders.id, orderId));
            return { success: true };
        }

        return { success: false, error: 'Unknown field' };

    } catch (error) {
        console.error('Failed to update order cell:', error);
        return { success: false, error: 'Update failed' };
    }
}
