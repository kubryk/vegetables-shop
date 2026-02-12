import { Product } from '@/types/product';

const FAKTUROWNIA_USERNAME = process.env.FAKTUROWNIA_USERNAME || 'kodarik';
const FAKTUROWNIA_API_URL = `https://${FAKTUROWNIA_USERNAME}.fakturownia.pl`;

type FakturowniaProduct = {
    id: number;
    name: string;
    description: string;
    price_net: string; // Price per unit (e.g. per kg)
    quantity: string; // Quantity in a box (e.g. 6.0 for 6kg box)
    quantity_unit: string; // Unit (e.g. "kg")
    image_url: string | null;
    tag_list: string[];
    code: string;
    category_id: number | null;
    currency: string;
    active?: boolean; // Not always present, distinct from 'disabled'
    disabled: boolean;
    stock_level: string;
};

// Map Fakturownia product to our internal Product type
function mapFakturowniaToProduct(fp: FakturowniaProduct): Product | null {
    // 1. Filter: Must have "website" tag
    if (!fp.tag_list.includes('website')) {
        return null;
    }

    const pricePerUnit = parseFloat(fp.price_net) || 0;
    const boxWeight = parseFloat(fp.quantity) || 0; // The 'quantity' field in API represents weight/amount per box for these products
    const pricePerCardboard = pricePerUnit * boxWeight;

    // Determine availability (simple check for now)
    // If disabled is true, it's inactive.
    // We can also check stock_level if needed, but 'disabled' is a good start.
    const isActive = !fp.disabled;

    return {
        id: fp.id.toString(),
        name: fp.name,
        category: 'Vegetables', // Default category or derive from elsewhere if available
        unit: fp.quantity_unit || 'kg',
        unitPerCardboard: 1, // It's sold as 1 box
        netWeight: boxWeight, // Weight of the content in the box
        pricePerUnit: pricePerUnit,
        pricePerCardboard: pricePerCardboard,
        currency: fp.currency || 'EUR',
        image: undefined, // Do not use image from API, only from metadata if available
        active: isActive,
        agregationResult: 'cardboard', // Defaulting to cardboard since they are box-only
        externalUrl: `${FAKTUROWNIA_API_URL}/products/${fp.id}`
    };
}

export async function getFakturowniaProducts(): Promise<Product[]> {
    const apiKey = process.env.FAKTUROWNIA_API_KEY;
    if (!apiKey) {
        console.error('FAKTUROWNIA_API_KEY is not set');
        return [];
    }

    // Fetch local metadata
    const { db } = await import('@/lib/db');
    const { productMetadata } = await import('@/lib/db/schema');

    let metadataMap = new Map<string, { id: string; image: string | null; agregationResult: string | null; position: number | null; }>();
    try {
        const metadata = await db.select().from(productMetadata);
        metadata.forEach(m => metadataMap.set(m.id, m));
    } catch (e) {
        console.error('Failed to fetch product metadata:', e);
        // Continue without metadata if DB fails
    }

    let allProducts: Product[] = [];
    let page = 1;
    const perPage = 50; // Maximize per page to reduce requests

    try {
        while (true) {
            const url = `${FAKTUROWNIA_API_URL}/products.json?page=${page}&per_page=${perPage}&api_token=${apiKey}`;
            const res = await fetch(url, {
                next: { revalidate: 0 }, // Disable cache for development
                headers: {
                    'Accept': 'application/json'
                }
            });

            if (!res.ok) {
                console.error(`Failed to fetch products from Fakturownia: ${res.status} ${res.statusText}`);
                break;
            }

            const data: FakturowniaProduct[] = await res.json();

            if (!Array.isArray(data) || data.length === 0) {
                break; // No more data
            }

            const mapped = data
                .map(mapFakturowniaToProduct)
                .filter((p): p is Product => p !== null)
                .map(p => {
                    const meta = metadataMap.get(p.id);
                    return {
                        ...p,
                        image: meta?.image || p.image,
                        agregationResult: (meta?.agregationResult as any) || p.agregationResult,
                        position: meta?.position ?? 0
                    };
                });

            allProducts = allProducts.concat(mapped);

            // If we got fewer items than requested, we are on the last page
            if (data.length < perPage) {
                break;
            }

            page++;
        }

        // Sort by position DESC (Higher value = Higher priority/First in list)
        return allProducts.sort((a, b) => (b.position || 0) - (a.position || 0));
    } catch (error) {
        console.error('Error fetching Fakturownia products:', error);
        return [];
    }
}
