import { google } from 'googleapis';

type GoogleSheetRow = string[];

export const fetchGoogleSheet = async (sheetId: string, range: string): Promise<GoogleSheetRow[]> => {
  // Для публічної таблиці використовуємо CSV експорт (найпростіший спосіб)
  const url = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:csv&sheet=${range}`;

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Failed to fetch Google Sheet: ${response.statusText}`);
  }

  const csvText = await response.text();
  const rows = csvText.split('\n').filter(row => row.trim());

  // Парсимо CSV (простий парсер, для складніших випадків можна використати бібліотеку)
  return rows.map(row => {
    const values: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < row.length; i++) {
      const char = row[i];

      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        values.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    values.push(current.trim());
    return values;
  });
};

// Метод через Google Sheets API v4 з Service Account
export const fetchGoogleSheetAPI = async (sheetId: string, range: string): Promise<GoogleSheetRow[]> => {
  try {
    const auth = new google.auth.GoogleAuth({
      credentials: {
        client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
        // Replace escaped newlines and remove surrounding quotes if present
        private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n').replace(/^"|"$/g, ''),
      },
      scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
    });

    const sheets = google.sheets({ version: 'v4', auth });

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: sheetId,
      range: range,
    });

    return (response.data.values as string[][]) || [];
  } catch (error) {
    console.error('Google Sheets API Error:', error);
    throw new Error('Failed to fetch data from Google Sheets API');
  }
};

// Функція для запису замовлення в Google Sheets
export const appendOrderToSheet = async (
  sheetId: string,
  range: string,
  orderData: any[][]
): Promise<void> => {
  try {
    const auth = new google.auth.GoogleAuth({
      credentials: {
        client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
        // Replace escaped newlines and remove surrounding quotes if present
        private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n').replace(/^"|"$/g, ''),
      },
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });

    const sheets = google.sheets({ version: 'v4', auth });

    await sheets.spreadsheets.values.append({
      spreadsheetId: sheetId,
      range: range,
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: orderData,
      },
    });
  } catch (error) {
    console.error('Google Sheets Append Error:', error);
    throw new Error('Failed to append to Google Sheet');
  }
};
// Функція для повного оновлення листа (видалення старих даних і запис нових)
export const replaceSheetContent = async (
  sheetId: string,
  range: string,
  data: any[][]
): Promise<void> => {
  try {
    const auth = new google.auth.GoogleAuth({
      credentials: {
        client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
        private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n').replace(/^"|"$/g, ''),
      },
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });

    const sheets = google.sheets({ version: 'v4', auth });

    // Extract sheet name and ensure it's quoted for the API
    const sheetName = range.split('!')[0].replace(/^'|'$/g, '');
    const safeSheetName = `'${sheetName.replace(/'/g, "''")}'`;

    // 1. Clear a large range to ensure old data is completely removed
    await sheets.spreadsheets.values.clear({
      spreadsheetId: sheetId,
      range: `${safeSheetName}!A1:Z1000`,
    });

    // 2. Update starting from A1
    await sheets.spreadsheets.values.update({
      spreadsheetId: sheetId,
      range: `${safeSheetName}!A1`,
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: data,
      },
    });

    console.log(`Successfully updated Google Sheet: ${sheetName}, rows: ${data.length}`);
  } catch (error: any) {
    console.error('Google Sheets Replace Error:', error);
    const message = error.response?.data?.error?.message || error.message;
    const sheetPart = range.split('!')[0].replace(/^'|'$/g, '');
    if (message.includes('Unable to parse range')) {
      throw new Error(`Лист із назвою "${sheetPart}" не знайдено. Будь ласка, переконайтеся, що лист з такою назвою існує в Google Таблиці.`);
    }
    throw new Error(`Помилка Google Sheets: ${message}`);
  }
};

// Create a new sheet (tab) in the spreadsheet
export const createSheet = async (spreadsheetId: string, title: string): Promise<number | null> => {
  try {
    const auth = new google.auth.GoogleAuth({
      credentials: {
        client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
        private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n').replace(/^"|"$/g, ''),
      },
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });

    const sheets = google.sheets({ version: 'v4', auth });

    const response = await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: [{
          addSheet: {
            properties: {
              title,
            }
          }
        }]
      }
    });

    const newSheetId = response.data.replies?.[0]?.addSheet?.properties?.sheetId;
    console.log(`Created new sheet: ${title} (ID: ${newSheetId})`);
    return newSheetId ?? null;
  } catch (error: any) {
    console.error('Failed to create sheet:', error);
    throw new Error(`Failed to create sheet "${title}": ${error.message}`);
  }
};

// Write data to a specific sheet starting at A1 (simple update)
export const writeToSheet = async (spreadsheetId: string, sheetTitle: string, data: any[][]): Promise<void> => {
  try {
    const auth = new google.auth.GoogleAuth({
      credentials: {
        client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
        private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n').replace(/^"|"$/g, ''),
      },
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });

    const sheets = google.sheets({ version: 'v4', auth });
    const safeTitle = `'${sheetTitle.replace(/'/g, "''")}'`;

    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `${safeTitle}!A1`,
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: data,
      },
    });
    console.log(`Wrote ${data.length} rows to sheet: ${sheetTitle}`);
  } catch (error: any) {
    console.error('Failed to write to sheet:', error);
    throw new Error(`Failed to write to sheet "${sheetTitle}": ${error.message}`);
  }
};

export const formatSheetCells = async (
  spreadsheetId: string,
  sheetId: number,
  requests: any[]
): Promise<void> => {
  try {
    const auth = new google.auth.GoogleAuth({
      credentials: {
        client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
        private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n').replace(/^"|"$/g, ''),
      },
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });

    const sheets = google.sheets({ version: 'v4', auth });

    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests
      }
    });
    console.log(`Formatted cells in sheet ID: ${sheetId}`);
  } catch (error: any) {
    console.error('Failed to format cells:', error);
    throw new Error(`Failed to format cells: ${error.message}`);
  }
};
