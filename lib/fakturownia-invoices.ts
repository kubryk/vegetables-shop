import { findClientByEmail } from './fakturownia';

const FAKTUROWNIA_USERNAME = process.env.FAKTUROWNIA_USERNAME || 'kodarik';
const FAKTUROWNIA_API_URL = `https://${FAKTUROWNIA_USERNAME}.fakturownia.pl`;
const FAKTUROWNIA_API_KEY = process.env.FAKTUROWNIA_API_KEY;

export type InvoicePosition = {
    name: string;
    quantity: number;
    unit: string;
    price_net: number;
    tax: number;
    product_id?: number;
    additional_info?: string;
};

export type InvoiceData = {
    client_id?: number;
    buyer_name?: string;
    buyer_email?: string;
    positions: InvoicePosition[];
    payment_type?: string;
    currency?: string;
    lang?: string;
    issue_date?: string;
    sell_date?: string;
};

export type CreateInvoiceResponse = {
    success: boolean;
    invoiceId?: number;
    invoiceUrl?: string;
    invoiceNumber?: string;
    error?: string;
};

/**
 * Find a client in Fakturownia by email
 * Returns client ID if found, null otherwise
 */
export async function findClientByEmailOnly(email: string): Promise<number | null> {
    if (!FAKTUROWNIA_API_KEY) {
        console.error('FAKTUROWNIA_API_KEY is not set');
        return null;
    }

    // Try to find existing client by email
    const existingClientId = await findClientByEmail(email);
    return existingClientId;
}

/**
 * Create an invoice in Fakturownia
 */
export async function createInvoice(invoiceData: InvoiceData): Promise<CreateInvoiceResponse> {
    if (!FAKTUROWNIA_API_KEY) {
        return {
            success: false,
            error: 'FAKTUROWNIA_API_KEY is not configured'
        };
    }

    try {
        // Ensure we have a client_id
        let clientId = invoiceData.client_id;
        if (!clientId && invoiceData.buyer_email) {
            clientId = await findClientByEmailOnly(invoiceData.buyer_email) || undefined;
        }

        if (!clientId) {
            return {
                success: false,
                error: `Клієнта з email ${invoiceData.buyer_email} не знайдено у Fakturownia. Будь ласка, створіть клієнта спочатку.`
            };
        }

        const url = `${FAKTUROWNIA_API_URL}/invoices.json`;

        const validPositions = invoiceData.positions.filter(pos => pos.name && pos.quantity > 0);

        if (validPositions.length === 0) {
            return {
                success: false,
                error: 'Жодної позиції не знайдено.'
            };
        }

        const invoicePayload = {
            api_token: FAKTUROWNIA_API_KEY,
            invoice: {
                kind: 'vat',
                client_id: String(clientId),
                additional_info: "1",
                positions: validPositions.map(pos => {
                    const tax = pos.tax ?? 0;
                    const total_price_gross = +(pos.price_net * pos.quantity * (1 + tax / 100)).toFixed(2);
                    return {
                        name: pos.name,
                        quantity: pos.quantity,
                        quantity_unit: pos.unit || undefined,
                        price_net: pos.price_net,
                        tax,
                        total_price_gross,
                    };
                })
            }
        };

        console.log('Creating invoice with payload:', JSON.stringify(invoicePayload, null, 2));

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(invoicePayload)
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error(`Failed to create invoice: ${response.status} ${response.statusText}`);
            console.error('Error details:', errorText);
            console.error('Request payload was:', JSON.stringify(invoicePayload, null, 2));
            return {
                success: false,
                error: `Помилка створення фактури: ${response.status}. ${errorText}`
            };
        }

        const data = await response.json();

        return {
            success: true,
            invoiceId: data.id,
            invoiceNumber: data.number,
            invoiceUrl: `${FAKTUROWNIA_API_URL}/invoices/${data.id}`
        };
    } catch (error: any) {
        console.error('Error creating Fakturownia invoice:', error);
        return {
            success: false,
            error: error.message || 'Unknown error occurred'
        };
    }
}


/**
 * Update an existing invoice in Fakturownia
 */
export async function updateInvoice(invoiceId: number, invoiceData: InvoiceData): Promise<CreateInvoiceResponse> {
    if (!FAKTUROWNIA_API_KEY) {
        return {
            success: false,
            error: 'FAKTUROWNIA_API_KEY is not configured'
        };
    }

    try {
        const url = `${FAKTUROWNIA_API_URL}/invoices/${invoiceId}.json`;

        const validPositions = invoiceData.positions.filter(pos => pos.name && pos.quantity > 0);

        if (validPositions.length === 0) {
            return {
                success: false,
                error: 'Жодної позиції не знайдено.'
            };
        }

        const invoicePayload: any = {
            api_token: FAKTUROWNIA_API_KEY,
            invoice: {
                kind: 'vat',
                positions: JSON.stringify(validPositions.map(pos => {
                    const tax = pos.tax ?? 0;
                    const total_price_gross = +(pos.price_net * pos.quantity * (1 + tax / 100)).toFixed(2);
                    return {
                        name: pos.name,
                        quantity: pos.quantity,
                        quantity_unit: pos.unit || undefined,
                        price_net: pos.price_net,
                        tax,
                        total_price_gross,
                    };
                }))
            }
        };

        if (invoiceData.client_id) {
            invoicePayload.invoice.client_id = String(invoiceData.client_id);
        }

        console.log(`Updating invoice ${invoiceId} with payload:`, JSON.stringify(invoicePayload, null, 2));

        const response = await fetch(url, {
            method: 'PUT',
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(invoicePayload)
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error(`Failed to update invoice: ${response.status} ${response.statusText}`);
            console.error('Error details:', errorText);
            return {
                success: false,
                error: `Помилка оновлення фактури: ${response.status}. ${errorText}`
            };
        }

        const data = await response.json();

        return {
            success: true,
            invoiceId: data.id,
            invoiceNumber: data.number,
            invoiceUrl: `${FAKTUROWNIA_API_URL}/invoices/${data.id}`
        };
    } catch (error: any) {
        console.error('Error updating Fakturownia invoice:', error);
        return {
            success: false,
            error: error.message || 'Unknown error occurred'
        };
    }
}

/**
 * Get invoice details from Fakturownia
 */
export async function getInvoice(invoiceId: number): Promise<any> {
    if (!FAKTUROWNIA_API_KEY) {
        return null;
    }

    try {
        const url = `${FAKTUROWNIA_API_URL}/invoices/${invoiceId}.json?api_token=${FAKTUROWNIA_API_KEY}`;
        const response = await fetch(url, {
            headers: {
                'Accept': 'application/json',
            }
        });

        if (!response.ok) {
            console.error(`Failed to get invoice: ${response.status}`);
            return null;
        }

        return await response.json();
    } catch (error) {
        console.error('Error getting Fakturownia invoice:', error);
        return null;
    }
}
