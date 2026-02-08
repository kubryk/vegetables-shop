import { db } from '@/lib/db';
import { products as productsTable } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';

export async function GET() {
    try {
        // Fetch from Drizzle DB instead of Google Sheets
        const products = await db.select().from(productsTable).where(eq(productsTable.active, true));

        // Format to match the frontend expectations
        const formattedProducts = products.map((p) => ({
            id: p.id,
            name: p.name,
            category: p.category,
            cardboardWeight: p.cardboardWeight,
            pricePerUnit: p.price,
            unit: p.unit,
            pricePerCardboard: p.pricePerCardboard,
            currency: p.currency,
            image: p.image,
            active: p.active,
        }));

        return NextResponse.json({ products: formattedProducts });
    } catch (error) {
        console.error('Error fetching products from DB:', error);
        return NextResponse.json(
            { error: 'Failed to fetch products' },
            { status: 500 }
        );
    }
}
