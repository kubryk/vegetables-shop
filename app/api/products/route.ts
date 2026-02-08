import { fetchGoogleSheetAPI } from '@/lib/google-sheets';
import { NextResponse } from 'next/server';

export async function GET() {
    try {
        const sheetId = process.env.GOOGLE_SHEET_ID;
        const sheetName = process.env.GOOGLE_SHEET_NAME || 'Sheet1';

        if (!sheetId) {
            return NextResponse.json(
                { error: 'GOOGLE_SHEET_ID is not set in environment variables' },
                { status: 500 }
            );
        }

        // Отримуємо дані з Google Sheets (масив масивів рядків)
        const rows = await fetchGoogleSheetAPI(sheetId, sheetName);

        if (!rows || rows.length === 0) {
            return NextResponse.json({ data: [] });
        }

        // Перший рядок - це заголовки
        const headers = rows[0];
        const dataRows = rows.slice(1);

        // Перетворюємо масив рядків в масив об'єктів
        const products = dataRows.map((row) => {
            // Створюємо мапу значень по заголовкам
            const rowData: Record<string, string> = {};
            headers.forEach((header, index) => {
                rowData[header.trim()] = row[index] || '';
            });

            // Хелпер для парсингу цін та чисел
            const parsePrice = (val: string) => {
                if (!val) return 0;
                // Видаляємо символ валюти та все зайве, замінюємо кому на крапку
                const cleaned = val.replace(/[€$£]/g, '').replace(',', '.').trim();
                return parseFloat(cleaned) || 0;
            };

            const parseWeight = (val: string) => {
                if (!val) return 0;
                // Видаляємо 'kg' та інші літери
                const cleaned = val.replace(/[a-zA-Z]/g, '').replace(',', '.').trim();
                return parseFloat(cleaned) || 0;
            };

            return {
                id: rowData['id'] || Math.random().toString(36).substr(2, 9),
                name: rowData['name'] || '',
                category: rowData['category'] || 'Інше',
                cardboardWeight: parseWeight(rowData['сardboard_weight'] || rowData['cardboard_weight'] || ''),
                pricePerUnit: parsePrice(rowData['price_per_unit'] || rowData['price_per_kg']),
                unit: rowData['unit'] || 'кг',
                pricePerCardboard: parsePrice(rowData['price_per_cardboard']),
                currency: rowData['currency'] || 'EUR',
                image: rowData['image'] || '',
                active: (rowData['active'] || '').toLowerCase() === 'true',
            };
        }).filter(p => p.active); // Показуємо тільки активні товари

        return NextResponse.json({ products });
    } catch (error) {
        console.error('Error fetching products from Google Sheets:', error);
        return NextResponse.json(
            { error: 'Failed to fetch products' },
            { status: 500 }
        );
    }
}
