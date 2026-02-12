import { NextResponse } from 'next/server';
import { getFakturowniaProducts } from '@/lib/fakturownia';

export async function GET() {
    try {
        const products = await getFakturowniaProducts();
        return NextResponse.json({ products });
    } catch (error) {
        console.error('Error fetching products from Fakturownia:', error);
        return NextResponse.json(
            { error: 'Failed to fetch products' },
            { status: 500 }
        );
    }
}
