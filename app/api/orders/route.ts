import { NextResponse } from 'next/server';
import { appendOrderToSheet } from '@/lib/google-sheets';
import { db } from '@/lib/db';
import { orders as ordersTable } from '@/lib/db/schema';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        console.log('Received order request:', body);

        const {
            customerName,
            customerEmail,
            items,
            totalPrice,
            currency,
            orderDate,
        } = body;

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
                const inPack = Number(item.netWeight || item.unitPerCardboard || 0);
                const unit = item.unit === 'pcs' ? 'шт' : (item.unit || 'кг');
                const quantity = Number(item.quantity) || 0;

                if (inPack > 0) {
                    return `${item.name} (${quantity} уп. по ${inPack} ${unit})`;
                }
                return `${item.name} (${quantity} ${unit})`;
            })
            .join('\n');

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
                orderDate: dbDate,
            }).returning();
            dbOrderId = newOrder.id;
            console.log('Order saved to DB with ID:', dbOrderId);
        } catch (dbError) {
            console.error('Failed to save order to DB:', dbError);
            // We continue to sheets even if DB fails for redundancy, 
            // but in a production app we might want to handle this differently
        }

        // 2. Save to Google Sheets
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
