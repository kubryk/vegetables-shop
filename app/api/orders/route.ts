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

        console.log('Parsed order data:', { customerName, customerEmail, itemCount: items?.length, totalPrice });

        // Format items for summary
        const itemsSummary = items
            .map((item: any) => `${item.name} (${item.quantity} шт.)`)
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
                orderDate: new Date(orderDate),
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
                new Date(orderDate).toLocaleString('uk-UA'),
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
