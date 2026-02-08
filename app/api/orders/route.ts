import { NextResponse } from 'next/server';
import { appendOrderToSheet } from '@/lib/google-sheets';

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

        const sheetId = process.env.GOOGLE_SHEET_ORDERS_ID;
        const sheetName = process.env.GOOGLE_SHEET_ORDERS_NAME || 'Замовлення';

        if (!sheetId) {
            console.error('GOOGLE_SHEET_ORDERS_ID is missing');
            return NextResponse.json(
                { error: 'GOOGLE_SHEET_ORDERS_ID is not set' },
                { status: 500 }
            );
        }

        // Format items for the sheet
        const itemsSummary = items
            .map((item: any) => `${item.name} (${item.quantity} шт.)`)
            .join('\n');

        // Generate ID
        const id = Date.now().toString(36) + Math.random().toString(36).substr(2, 5);

        // Prepare row data
        // Columns: id, market_name, email, items, totalPrice, currency, orderDate
        const orderRow = [
            id,
            JSON.stringify(items),
            customerName,
            customerEmail,
            itemsSummary,
            totalPrice.toString(),
            currency,
            new Date(orderDate).toLocaleString('uk-UA'),
            'processing',
        ];

        console.log('Appending row to sheet:', { sheetId, sheetName, orderRow });

        await appendOrderToSheet(sheetId, sheetName, [orderRow]);

        console.log('Order created successfully, ID:', id);
        return NextResponse.json({ success: true, id });
    } catch (error) {
        console.error('Error creating order:', error);
        return NextResponse.json(
            { error: 'Failed to create order' },
            { status: 500 }
        );
    }
}
