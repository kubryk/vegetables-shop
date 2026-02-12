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

        const productLookup = new Map();
        const headerKeys = new Set<string>();

        allProducts.forEach(p => {
            productLookup.set(p.id, p);
            productLookup.set(p.name, p);

            // Use product Name as the header key strictly
            const key = p.name;
            headerKeys.add(key);
        });

        // Sort Headers
        const sortedKeys = Array.from(headerKeys).sort((a, b) => a.localeCompare(b, 'uk'));

        const headerRow = ['order_id', 'email', 'market_name', 'weight', ...sortedKeys];

        // Prepare Rows
        const dataRows: any[][] = [];

        // Helper to get column letter (0-based index)
        const getColLetter = (n: number) => {
            let s = "";
            while (n >= 0) {
                s = String.fromCharCode(n % 26 + 65) + s;
                n = Math.floor(n / 26) - 1;
            }
            return s;
        };

        for (let i = 0; i < filteredOrders.length; i++) {
            const order = filteredOrders[i];
            const items = Array.isArray(order.items) ? (order.items as any[]) : [];

            // Map to store weight per product key for this order
            const orderWeights = new Map<string, number>();

            for (const item of items) {
                // Resolve product
                let product = productLookup.get(item.productId);
                if (!product && item.name) product = productLookup.get(item.name); // Fallback by name

                // Determine key based on product info or item info
                // Use product name as key to match headers
                const key = product?.name || item.name;

                // Only add data if this key represents an existing product column
                if (headerKeys.has(key)) {
                    const qty = Number(item.quantity) || 0;
                    let valueToAdd = 0;

                    const aggregationType = product?.agregationResult;

                    if (aggregationType === 'cardboard') {
                        // If aggregation type is cardboard, we just sum the quantity (number of packs/items)
                        valueToAdd = qty;
                    } else {
                        // Default to weight (if 'weight' or undefined/other)
                        let weightPerPack = 0;

                        // Priority for weight calculation
                        if (item.netWeight) weightPerPack = Number(item.netWeight);
                        else if (item.cardboardWeight) weightPerPack = Number(item.cardboardWeight);
                        else if (product?.netWeight) weightPerPack = Number(product.netWeight);
                        else if (product?.netWeight === 0 && product?.unit === 'kg') weightPerPack = 1; // Fallback for pure kg items

                        valueToAdd = qty * weightPerPack;
                    }

                    const current = orderWeights.get(key) || 0;
                    orderWeights.set(key, current + valueToAdd);
                }
            }

            // Build Row
            // Formula for total weight: SUM of product columns
            // Header is row 1. Data starts at row 2.
            const rowIndex = i + 2;

            // Products start at index 4 (Column E)
            const columnMultipliers = sortedKeys.map(key => {
                const product = productLookup.get(key) || [...productLookup.values()].find(p => p.name === key);
                const aggregationType = product?.agregationResult;

                if (aggregationType === 'cardboard') {
                    // Multiplier is the weight of the pack
                    // We try netWeight first, then unitPerCardboard (if that's where weight is stored), otherwise 1
                    let weight = Number(product?.netWeight) || 0;
                    if (weight === 0) weight = Number(product?.unitPerCardboard) || 0;
                    if (weight === 0) weight = 1; // Fallback to 1 explicitly to avoid 0 weight
                    return weight;
                }
                return 1; // For normal weight items, cell value is already total weight
            });

            // Construct formula: =PRODUCT_COL*MULTIPLIER + ...
            const formulaParts: string[] = [];

            sortedKeys.forEach((_, idx) => {
                const colLetter = getColLetter(4 + idx);
                const multiplier = columnMultipliers[idx];

                // Optimization: if cell is 0, we don't strictly need to include it, 
                // but we can't know the cell value inside the formula construction easily without complicating logic.
                // Just simpler to include all columns: E2*10 + F2*1 + ...
                // Actually, Google Sheets formula length limit is ~50k chars. 
                // With ~100 products, formula is roughly 100 * 10 chars = 1000 chars. Safe.

                if (multiplier !== 1) {
                    formulaParts.push(`(${colLetter}${rowIndex}*${multiplier})`);
                } else {
                    formulaParts.push(`${colLetter}${rowIndex}`);
                }
            });

            const formula = formulaParts.length > 0 ? `=${formulaParts.join('+')}` : '=0';

            const row: (string | number)[] = [
                order.id,
                order.customerEmail,
                order.customerName,
                formula
            ];

            for (const key of sortedKeys) {
                const val = orderWeights.get(key);
                // Push number if exists, otherwise empty string
                row.push(val !== undefined ? val : 0);
            }

            dataRows.push(row);
        }

        // --- ADDED FOOTER ROW Logic ---
        // We need a formula for each column from 'weight' (index 3) to the last product.
        // Data starts at Row 2.
        // Last data row is: 2 + filteredOrders.length - 1  => 1 + filteredOrders.length
        // Footer row index will be: 2 + filteredOrders.length

        const firstDataRow = 2; // Rows are 1-based in sheets
        const lastDataRow = 1 + filteredOrders.length;

        const footerRow: (string | number)[] = ['TOTAL', '', '', ''];

        // Col D (Weight) Formula
        // =SUM(D2:D5)
        const weightColLetter = getColLetter(3);
        footerRow[3] = `=SUM(${weightColLetter}${firstDataRow}:${weightColLetter}${lastDataRow})`;

        // Product Columns Formulas
        sortedKeys.forEach((_, idx) => {
            const colIndex = 4 + idx;
            const colLetter = getColLetter(colIndex);
            // =SUM(E2:E5)
            const formula = `=SUM(${colLetter}${firstDataRow}:${colLetter}${lastDataRow})`;
            footerRow.push(formula);
        });

        // Add footer to rows
        const allRows = [headerRow, ...dataRows, footerRow];

        // Export to Google Sheets
        const sheetId = process.env.GOOGLE_SHEET_ORDERS_ID;
        if (!sheetId) throw new Error('Google Sheet ID not configured');

        const { createSheet, replaceSheetContent, formatSheetCells } = await import('@/lib/google-sheets');

        const formatDate = (d: Date) => d.toLocaleDateString('uk-UA', { day: '2-digit', month: '2-digit', timeZone: 'Europe/Berlin' });
        const formatTime = (d: Date) => d.toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Berlin', hour12: false });
        const title = `Звіт ${formatDate(start)} - ${formatDate(end)} (${formatDate(new Date())} ${formatTime(new Date())})`;

        const sheetIdNum = await createSheet(sheetId, title);
        await replaceSheetContent(sheetId, `${title}!A1`, allRows);

        // Apply formatting
        if (sheetIdNum !== null) {
            const requests: any[] = [];

            // Format for weight column (column D, index 3)
            // It's always kg
            requests.push({
                repeatCell: {
                    range: {
                        sheetId: sheetIdNum,
                        startRowIndex: 1, // Skip header
                        startColumnIndex: 3,
                        endColumnIndex: 4
                    },
                    cell: {
                        userEnteredFormat: {
                            numberFormat: {
                                type: 'NUMBER',
                                pattern: '0 "kg"'
                            }
                        }
                    },
                    fields: 'userEnteredFormat.numberFormat'
                }
            });

            // Format for Product Columns (index 4 to 4+length)
            sortedKeys.forEach((key, idx) => {
                const product = productLookup.get(key) || [...productLookup.values()].find(p => p.name === key);
                const aggregationType = product?.agregationResult;

                const colIndex = 4 + idx;
                let pattern = '0 "kg"'; // Default

                if (aggregationType === 'cardboard') {
                    pattern = '0';
                }

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

                // Add Weight Column (Column D, index 3) bold formatting for all rows (Header to Footer)
                const totalRows = filteredOrders.length + 2; // Header + Data + Footer
                requests.push({
                    repeatCell: {
                        range: {
                            sheetId: sheetIdNum,
                            startRowIndex: 1, // Skip header
                            endRowIndex: totalRows,
                            startColumnIndex: 3,
                            endColumnIndex: 4
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

                // Add Zebra Striping (Alternating Grey Rows)
                // Data starts at Row index 1 (Header is 0)
                // We want to color every OTHER row. e.g. 1, 3, 5...
                for (let i = 0; i < filteredOrders.length; i++) {
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
                const lastRowIndex = 1 + filteredOrders.length;
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
