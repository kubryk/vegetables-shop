import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { orders as ordersTable } from '@/lib/db/schema';
import { findClientByEmail } from '@/lib/fakturownia';
import { calculateItemWeight, getPackageCount, getUnitsPerPackage, getWeightMode, getWeightPerPackageKg } from '@/lib/weights';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        console.log('Received order request:', body);

        const {
            customerName,
            customerEmail,
            items: rawItems,
            totalPrice,
            currency,
            orderDate,
        } = body;

        const items = Array.isArray(rawItems) ? rawItems.map((item: any) => {
            const quantity = Number(item.quantity) || 0;
            const unitsPerPackage = getUnitsPerPackage(item) || undefined;
            const weightPerPackageKg = getWeightPerPackageKg(item) || undefined;
            const weightMode = getWeightMode(item);
            const packageCount = getPackageCount(item);
            const { calculatedWeightKg, weightSource } = calculateItemWeight({
                ...item,
                quantity,
                unitsPerPackage,
                weightPerPackageKg,
                weightMode,
                packageCount,
            });

            return {
                ...item,
                quantity,
                unitsPerPackage,
                weightMode,
                weightPerUnitKg: Number(item.weightPerUnitKg || 0) || undefined,
                weightPerPackageKg,
                packageCount: packageCount > 0 ? packageCount : undefined,
                calculatedWeightKg,
                weightSource,
            };
        }) : [];

        const originalDate = new Date(orderDate);

        // Calculate Berlin time representation as UTC for DB storage
        const berlinParts = new Intl.DateTimeFormat('en-US', {
            timeZone: 'Europe/Berlin',
            year: 'numeric', month: '2-digit', day: '2-digit',
            hour: '2-digit', minute: '2-digit', second: '2-digit',
            hour12: false
        }).formatToParts(originalDate);

        const p: any = berlinParts.reduce((acc, part) => ({ ...acc, [part.type]: part.value }), {});
        const dbDate = new Date(`${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}:${p.second}Z`);


        console.log('Parsed order data:', { customerName, customerEmail, itemCount: items?.length, totalPrice });

        // Format items for summary
        const itemsSummary = items
            .map((item: any) => {
                const unit = item.unit || 'kg';
                const quantity = Number(item.quantity) || 0;
                const weightPart = item.calculatedWeightKg ? `, ${item.calculatedWeightKg} kg` : '';

                return `${item.name} (${quantity} ${unit}${weightPart})${item.additionalInfo ? ` [${item.additionalInfo}]` : ''}`;
            })
            .join('\n');

        // Look up Fakturownia Client ID
        let fakturowniaClientId: number | null = null;
        if (customerEmail) {
            try {
                fakturowniaClientId = await findClientByEmail(customerEmail);
                if (fakturowniaClientId) {
                    console.log(`Found Fakturownia Client ID for ${customerEmail}: ${fakturowniaClientId}`);
                } else {
                    console.log(`No Fakturownia Client found for ${customerEmail}`);
                }
            } catch (err) {
                console.error('Error looking up Fakturownia client:', err);
            }
        }

        // 1. Save to Database
        let dbOrderId = null;
        try {
            const [newOrder] = await db.insert(ordersTable).values({
                customerName,
                customerEmail,
                items,
                itemsSummary,
                totalPrice: parseFloat(totalPrice.toString()),
                currency,
                status: 'processing',
                fakturowniaClientId,
                orderDate: dbDate,
            }).returning();
            dbOrderId = newOrder.id;
            console.log('Order saved to DB with ID:', dbOrderId);
        } catch (dbError) {
            console.error('Failed to save order to DB:', dbError);
            // We continue to sheets even if DB fails for redundancy, 
            // but in a production app we might want to handle this differently
        }

        // 2. Save to Google Sheets - DISABLED
        /*
        const sheetId = process.env.GOOGLE_SHEET_ORDERS_ID;
        const sheetName = process.env.GOOGLE_SHEET_ORDERS_NAME || 'Замовлення';

        if (sheetId) {
            const orderRow = [
                dbOrderId || Date.now().toString(36),
                JSON.stringify(items),
                customerName,
                customerEmail,
                itemsSummary,
                totalPrice.toString(),
                currency,
                originalDate.toLocaleString('uk-UA', { timeZone: 'Europe/Berlin' }),
                'processing',
            ];

            await appendOrderToSheet(sheetId, sheetName, [orderRow]).catch(err => {
                console.error('Failed to sync to Google Sheets:', err);
            });
        }
        */

        return NextResponse.json({
            success: true,
            id: dbOrderId || 'temp-' + Date.now().toString(36)
        });
    } catch (error) {
        console.error('Error creating order:', error);
        return NextResponse.json(
            { error: 'Failed to create order' },
            { status: 500 }
        );
    }
}
