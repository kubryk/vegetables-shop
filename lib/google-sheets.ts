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
