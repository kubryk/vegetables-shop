'use server';

import { db } from '@/lib/db';
import { reports } from '@/lib/db/schema';
import { desc, eq } from 'drizzle-orm';
import { getAggregationData } from './products';
import { revalidatePath } from 'next/cache';

export async function getReports() {
    try {
        const allReports = await db.select().from(reports).orderBy(desc(reports.createdAt));
        return { success: true, data: allReports };
    } catch (error) {
        console.error('Failed to fetch reports:', error);
        return { success: false, error: 'Failed to fetch reports' };
    }
}

export async function getReport(id: string) {
    try {
        const report = await db.select().from(reports).where(eq(reports.id, id));
        if (report.length === 0) {
            return { success: false, error: 'Report not found' };
        }
        return { success: true, data: report[0] };
    } catch (error) {
        console.error('Failed to fetch report:', error);
        return { success: false, error: 'Failed to fetch report' };
    }
}

export async function createReport(startDate: string, endDate: string, name?: string) {
    try {
        // Generate the data snapshot
        const aggregationResult = await getAggregationData(startDate, endDate);

        if (!aggregationResult.success || !aggregationResult.data) {
            return { success: false, error: aggregationResult.error || 'Failed to generate report data' };
        }

        const reportName = name || `Report ${startDate} - ${endDate}`;

        const [newReport] = await db.insert(reports).values({
            name: reportName,
            startDate: new Date(startDate),
            endDate: new Date(endDate),
            data: aggregationResult.data,
        }).returning();

        revalidatePath('/466ed1254c89ccf77b8dab3da30f8692/reports');
        return { success: true, data: newReport };

    } catch (error) {
        console.error('Failed to create report:', error);
        return { success: false, error: 'Failed to create report' };
    }
}

export async function updateReportData(id: string, data: any) {
    try {
        await db.update(reports)
            .set({ data: data })
            .where(eq(reports.id, id));

        revalidatePath(`/466ed1254c89ccf77b8dab3da30f8692/reports/${id}`);
        return { success: true };
    } catch (error) {
        console.error('Failed to update report data:', error);
        return { success: false, error: 'Failed to update report data' };
    }
}

export async function deleteReport(id: string) {
    try {
        await db.delete(reports).where(eq(reports.id, id));
        revalidatePath('/466ed1254c89ccf77b8dab3da30f8692/reports');
        return { success: true };
    } catch (error) {
        console.error('Failed to delete report:', error);
        return { success: false, error: 'Failed to delete report' };
    }
}

export async function duplicateReport(id: string) {
    try {
        // Get the original report
        const reportResult = await getReport(id);
        if (!reportResult.success || !reportResult.data) {
            return { success: false, error: 'Report not found' };
        }

        const originalReport = reportResult.data;

        // Create a new report with the same data but new name
        const newName = `${originalReport.name} (копія)`;

        const [newReport] = await db.insert(reports).values({
            name: newName,
            startDate: originalReport.startDate,
            endDate: originalReport.endDate,
            data: originalReport.data,
            // Don't copy invoices - start fresh
            invoices: null
        }).returning();

        revalidatePath('/466ed1254c89ccf77b8dab3da30f8692/reports');
        return { success: true, data: newReport };
    } catch (error) {
        console.error('Failed to duplicate report:', error);
        return { success: false, error: 'Failed to duplicate report' };
    }
}

export async function createInvoiceForReportRow(reportId: string, rowIndex: number) {
    try {
        // Get report
        const reportResult = await getReport(reportId);
        if (!reportResult.success || !reportResult.data) {
            return { success: false, error: 'Report not found' };
        }

        const report = reportResult.data;
        const reportData = report.data as any;

        // Check if orderMetadata exists
        if (!reportData.orderMetadata || !reportData.orderMetadata[rowIndex]) {
            return { success: false, error: 'Order metadata not found for this row' };
        }

        const orderMeta = reportData.orderMetadata[rowIndex];
        const row = reportData.rows[rowIndex];

        // Check if invoice already exists for this row
        const existingInvoices = (report.invoices as any) || {};
        if (existingInvoices[rowIndex]) {
            return {
                success: false,
                error: 'Invoice already exists for this order',
                invoiceData: existingInvoices[rowIndex]
            };
        }

        // Prepare invoice positions from the edited row data
        const { createInvoice } = await import('@/lib/fakturownia-invoices');
        const positions = [];

        // Start from index 2 (skip Client and Weight columns)
        for (let i = 2; i < row.length; i++) {
            const quantity = Number(row[i]) || 0;
            if (quantity > 0) {
                const headerName = reportData.headers[i];
                // Extract product name and ID from header like "Product Name [ID:123] (кг)"
                const match = headerName.match(/^(.+?)\s+\[ID:(\d+)\]/);
                const productName = match ? match[1] : headerName.replace(/\s+\(кг\)$/, '');
                const productId = match ? parseInt(match[2]) : undefined;

                // Find original item to get price and packaging info
                const originalItems = orderMeta.originalItems || [];
                const originalItem = originalItems.find((item: any) =>
                    String(item.productId) === String(productId) || item.name === productName
                );

                const pricePerUnit = originalItem?.price || 0;
                const additionalInfo = originalItem?.additionalInfo || '';

                // Convert unit to Fakturownia format
                const convertToFakturowniaUnit = (unit: string): string => {
                    const unitMap: Record<string, string> = {
                        'шт': 'szt',
                        'pcs': 'szt',
                        'kg': 'kg',
                        'г': 'kg',
                        'g': 'kg'
                    };
                    return unitMap[unit] || unit;
                };

                const originalUnit = originalItem?.unit || 'kg';
                const fakturowniaUnit = convertToFakturowniaUnit(originalUnit);

                const pkgData = reportData.packageCountRows?.[rowIndex]?.[i];
                const pkgCountValue = typeof pkgData === 'object' && pkgData !== null ? pkgData.count : (Number(pkgData) || 0);
                const pkgType = typeof pkgData === 'object' && pkgData !== null ? pkgData.packageType : 'kart';

                let finalAdditionalInfo = additionalInfo;

                if (pkgCountValue > 0) {
                    const formattedCount = Number.isInteger(pkgCountValue) ? pkgCountValue : pkgCountValue.toFixed(1);
                    finalAdditionalInfo = `${formattedCount} ${pkgType}`;
                }

                positions.push({
                    name: productName,
                    quantity: quantity,
                    unit: fakturowniaUnit,
                    price_net: pricePerUnit,
                    tax: 0, // Adjust if needed
                    product_id: productId,
                    additional_info: String(finalAdditionalInfo || '').trim()
                });
            }
        }

        if (positions.length === 0) {
            return { success: false, error: 'No products found in this order' };
        }

        // Create invoice
        const invoiceResult = await createInvoice({
            client_id: orderMeta.fakturowniaClientId,
            buyer_name: orderMeta.customerName,
            buyer_email: orderMeta.customerEmail,
            positions: positions,
            currency: orderMeta.currency || 'EUR',
            sell_date: new Date(orderMeta.orderDate).toISOString().split('T')[0]
        });

        if (!invoiceResult.success) {
            return { success: false, error: invoiceResult.error };
        }

        // Update report with invoice data
        const updatedInvoices = {
            ...existingInvoices,
            [rowIndex]: {
                invoiceId: invoiceResult.invoiceId,
                invoiceUrl: invoiceResult.invoiceUrl,
                invoiceNumber: invoiceResult.invoiceNumber,
                createdAt: new Date().toISOString()
            }
        };

        await db.update(reports)
            .set({ invoices: updatedInvoices })
            .where(eq(reports.id, reportId));

        revalidatePath(`/466ed1254c89ccf77b8dab3da30f8692/reports/${reportId}`);

        return {
            success: true,
            invoiceId: invoiceResult.invoiceId,
            invoiceUrl: invoiceResult.invoiceUrl,
            invoiceNumber: invoiceResult.invoiceNumber
        };

    } catch (error) {
        console.error('Failed to create invoice:', error);
        return { success: false, error: 'Failed to create invoice' };
    }
}
