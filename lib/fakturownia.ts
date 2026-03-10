import { Product } from '@/types/product';
import { getProductMetadataRows } from '@/lib/product-metadata';
import { getWeightMode, isWeightUnit } from '@/lib/weights';

const FAKTUROWNIA_USERNAME = process.env.FAKTUROWNIA_USERNAME || 'kodarik';
const FAKTUROWNIA_API_URL = `https://${FAKTUROWNIA_USERNAME}.fakturownia.pl`;

type FakturowniaProduct = {
    id: number;
    name: string;
    description: string;
    price_net: string; // Price per unit (e.g. per kg)
    quantity: string; // Quantity in a box (e.g. 6.0 for 6kg box)
    quantity_unit: string; // Unit (e.g. "kg")
    weight?: string | null;
    weight_unit?: string | null;
    image_url: string | null;
    tag_list: string[];
    code: string;
    category_id: number | null;
    currency: string;
    active?: boolean; // Not always present, distinct from 'disabled'
    disabled: boolean;
    stock_level: string;
    additional_info?: string;
};

function parseWeightToKg(value?: string | null, unit?: string | null) {
    const parsed = parseFloat(value || '');
    if (!Number.isFinite(parsed) || parsed <= 0) {
        return 0;
    }

    const normalizedUnit = String(unit || 'kg').trim().toLowerCase();
    if (normalizedUnit === 'g') {
        return parsed / 1000;
    }

    return parsed;
}

// Map Fakturownia product to our internal Product type
function mapFakturowniaToProduct(fp: FakturowniaProduct): Product | null {
    // 1. Filter: Must have "website" tag
    if (!fp.tag_list.includes('website')) {
        return null;
    }

    const pricePerUnit = parseFloat(fp.price_net) || 0;
    let boxWeight = 0;
    let unitsInBox = 1;

    // Normalize unit
    const rawUnit = (fp.quantity_unit || 'kg').toLowerCase();
    const isPiece = !isWeightUnit(rawUnit);
    const fakturowniaWeightPerPackageKg = parseWeightToKg(fp.weight, fp.weight_unit);

    if (isPiece) {
        unitsInBox = parseFloat(fp.quantity) || 1;
        boxWeight = fakturowniaWeightPerPackageKg;
    } else {
        boxWeight = parseFloat(fp.quantity) || 0;
        unitsInBox = 1;
    }

    const pricePerCardboard = pricePerUnit * (isPiece ? unitsInBox : boxWeight);

    // Determine availability (simple check for now)
    // If disabled is true, it's inactive.
    const isActive = !fp.disabled;
    const weightManagedByFakturownia = isWeightUnit(rawUnit) || (isPiece && fakturowniaWeightPerPackageKg > 0);

    return {
        id: fp.id.toString(),
        name: fp.name,
        category: 'Vegetables', // Default category or derive from elsewhere if available
        unit: fp.quantity_unit || 'kg',
        unitPerCardboard: unitsInBox,
        netWeight: boxWeight,
        pricePerUnit: pricePerUnit,
        pricePerCardboard: pricePerCardboard,
        currency: fp.currency || 'EUR',
        image: undefined, // Do not use image from API, only from metadata if available
        active: isActive,
        agregationResult: 'cardboard', // Defaulting to cardboard since they are box-only
        externalUrl: `${FAKTUROWNIA_API_URL}/products/${fp.id}`,
        additionalInfo: fp.additional_info,
        weightPerUnitKg: undefined,
        weightPerPackageKg: boxWeight || undefined,
        weightManagedByFakturownia
    };
}

export async function getFakturowniaProducts(): Promise<Product[]> {
    const apiKey = process.env.FAKTUROWNIA_API_KEY;
    if (!apiKey) {
        console.error('FAKTUROWNIA_API_KEY is not set');
        return [];
    }

    let metadataMap = new Map<string, {
        id: string;
        image: string | null;
        agregationResult: string | null;
        position: number | null;
    }>();
    try {
        const metadata = await getProductMetadataRows();
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

            const withTag = data.filter(p => p.tag_list?.includes('website'));
            const debugProduct = data.find(p => String(p.id) === '17322543662');
            if (debugProduct) {
                console.log(`[Fakturownia] DEBUG product 17322543662:`, JSON.stringify(debugProduct, null, 2));
            }

            console.log(`[Fakturownia] Page ${page}: ${data.length} total, ${withTag.length} with 'website' tag`);
            withTag.forEach(p => {
                console.log(`  - [${p.id}] ${p.name} | unit: ${p.quantity_unit} | disabled: ${p.disabled}`);
            });

            if (!Array.isArray(data) || data.length === 0) {
                break; // No more data
            }

            const mapped = data
                .map(mapFakturowniaToProduct)
                .filter((p): p is Product => p !== null)
                .map(p => {
                    const meta = metadataMap.get(p.id);
                    const unitsPerPackage = p.unitPerCardboard || undefined;

                    return {
                        ...p,
                        image: meta?.image || p.image,
                        agregationResult: (meta?.agregationResult as any) || p.agregationResult,
                        position: meta?.position ?? 0,
                        weightMode: getWeightMode({
                            ...p,
                            unitsPerPackage,
                        }),
                        weightPerUnitKg: p.weightPerUnitKg,
                        weightPerPackageKg: p.weightPerPackageKg || p.netWeight || undefined,
                        unitsPerPackage,
                        // Keep legacy Fakturownia packaging fields intact.
                        netWeight: p.netWeight,
                        unitPerCardboard: p.unitPerCardboard,
                        weightManagedByFakturownia: Boolean(p.weightManagedByFakturownia)
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
        console.log(`[Fakturownia] Total products with 'website' tag: ${allProducts.length}`);
        return allProducts.sort((a, b) => (b.position || 0) - (a.position || 0));
    } catch (error) {
        console.error('Error fetching Fakturownia products:', error);
        return [];
    }
}

export async function findClientByEmail(email: string): Promise<number | null> {
    const apiKey = process.env.FAKTUROWNIA_API_KEY;
    if (!apiKey) return null;

    let page = 1;
    // Fakturownia API might return partial matches for email search, so we need to filter strictly
    const targetEmail = email.toLowerCase().trim();

    try {
        while (true) {
            const url = `${FAKTUROWNIA_API_URL}/clients.json?email=${encodeURIComponent(email)}&page=${page}&per_page=10&api_token=${apiKey}`;
            const res = await fetch(url, {
                next: { revalidate: 0 },
                headers: { 'Accept': 'application/json' }
            });

            if (!res.ok) {
                console.error(`Failed to find client in Fakturownia: ${res.status}`);
                return null;
            }

            const clients: any[] = await res.json();

            if (!Array.isArray(clients) || clients.length === 0) {
                return null; // No matches found
            }

            // Look for exact match in the current page
            const match = clients.find((c: any) => c.email && c.email.toLowerCase().trim() === targetEmail);
            if (match) {
                return match.id;
            }

            // If strict match not found in this page, check if we should continue
            if (clients.length < 10) {
                // Last page reached, and no strict match found
                return null;
            }

            page++;
        }
    } catch (error) {
        console.error('Error finding Fakturownia client:', error);
        return null;
    }
}
