/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { CheckupRecord, CATEGORIES, AgeGroup } from '../types';

interface SheetResponse {
  spreadsheetId: string;
  spreadsheetUrl: string;
}

/**
 * Searches for a spreadsheet named "Quản lý Hồ sơ Khám sức khỏe" in the user's Google Drive.
 * Returns the spreadsheet ID and URL if found, or null otherwise.
 */
export const findExistingSpreadsheet = async (accessToken: string): Promise<SheetResponse | null> => {
  try {
    const response = await fetch(
      `https://www.googleapis.com/drive/v3/files?q=name='Quản lý Hồ sơ Khám sức khỏe' and mimeType='application/vnd.google-apps.spreadsheet' and trashed=false&fields=files(id,name,webViewLink)`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Drive search failed: ${response.statusText}`);
    }

    const data = await response.json();
    if (data.files && data.files.length > 0) {
      return {
        spreadsheetId: data.files[0].id,
        spreadsheetUrl: data.files[0].webViewLink,
      };
    }
    return null;
  } catch (error) {
    console.error('Lỗi khi tìm file trên Drive:', error);
    return null;
  }
};

/**
 * Creates a new spreadsheet in the user's Drive with proper initial layout and formulas.
 */
export const createSpreadsheet = async (accessToken: string): Promise<SheetResponse> => {
  try {
    const payload = {
      properties: {
        title: 'Quản lý Hồ sơ Khám sức khỏe',
      },
      sheets: [
        {
          properties: {
            title: 'Danh sách hồ sơ',
            gridProperties: {
              columnCount: 10,
              frozenRowCount: 1,
            },
          },
        },
        {
          properties: {
            title: 'Báo cáo tổng hợp',
            gridProperties: {
              columnCount: 5,
              frozenRowCount: 1,
            },
          },
        },
      ],
    };

    const response = await fetch('https://sheets.googleapis.com/v4/spreadsheets', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(`Create spreadsheet failed: ${response.statusText}`);
    }

    const data = await response.json();
    return {
      spreadsheetId: data.spreadsheetId,
      spreadsheetUrl: data.spreadsheetUrl || `https://docs.google.com/spreadsheets/d/${data.spreadsheetId}/edit`,
    };
  } catch (error) {
    console.error('Lỗi khi tạo bảng tính mới:', error);
    throw error;
  }
};

/**
 * Syncs all records to the Google Sheet by clearing academic rows and overwriting.
 * Also configures the Summary sheet with ready-to-use live formulae.
 */
export const syncRecordsToSpreadsheet = async (
  accessToken: string,
  spreadsheetId: string,
  records: CheckupRecord[]
): Promise<void> => {
  try {
    // 1. Write the Records sheet
    // Format rows: [ID, Ngày nhập, Cơ sở y tế, Nhóm, Số lượng, Ghi chú, Thời gian tạo, Thời gian đồng bộ]
    const headerRow = [
      'Mã bản ghi',
      'Ngày nhập',
      'Cơ sở y tế / Địa bàn',
      'Mã nhóm tuổi',
      'Tên nhóm đối tượng',
      'Cấp nhóm cha',
      'Số lượng hồ sơ',
      'Ghi chú',
      'Thời điểm tạo',
      'Đã đồng bộ lúc',
    ];

    const recordsRows = records.map((r) => {
      const cat = CATEGORIES[r.category];
      return [
        r.id,
        r.date,
        r.facility,
        r.category,
        cat.name,
        cat.parentGroupName,
        r.quantity,
        r.notes || '',
        new Date(r.createdAt).toLocaleString('vi-VN'),
        new Date().toLocaleString('vi-VN'),
      ];
    });

    const valuesToUpload = [headerRow, ...recordsRows];

    // Clear 'Danh sách hồ sơ' completely
    await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Danh sách hồ sơ!A1:Z5000:clear`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    // Save records data
    const updateRecordsRes = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Danh sách hồ sơ!A1?valueInputOption=USER_ENTERED`,
      {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          range: 'Danh sách hồ sơ!A1',
          majorDimension: 'ROWS',
          values: valuesToUpload,
        }),
      }
    );

    if (!updateRecordsRes.ok) {
      throw new Error(`Failed to write records: ${updateRecordsRes.statusText}`);
    }

    // 2. Setup the "Báo cáo tổng hợp" sheet with dynamic SUMIF formulas pointing to "Danh sách hồ sơ"
    // Columns: [Nhóm đối tượng, Cấp nhóm cha, Công thức tính tổng, Mô tả]
    const summaryHeaders = [
      'Mã nhóm',
      'Nhóm đối tượng',
      'Nhóm độ tuổi cha',
      'Tổng số lượng hồ sơ (Tính bằng Công thức)',
      'Tỷ lệ (%)',
    ];

    const totalRecordsFormula = `=SUM('Danh sách hồ sơ'!G2:G5000)`;

    const summaryRows = [
      [
        'under_6',
        CATEGORIES.under_6.name,
        CATEGORIES.under_6.parentGroupName,
        `=SUMIF('Danh sách hồ sơ'!D:D, "under_6", 'Danh sách hồ sơ'!G:G)`,
        `=IF(${totalRecordsFormula}>0, D3/${totalRecordsFormula}, 0)`,
      ],
      [
        'from_6_to_18',
        CATEGORIES.from_6_to_18.name,
        CATEGORIES.from_6_to_18.parentGroupName,
        `=SUMIF('Danh sách hồ sơ'!D:D, "from_6_to_18", 'Danh sách hồ sơ'!G:G)`,
        `=IF(${totalRecordsFormula}>0, D4/${totalRecordsFormula}, 0)`,
      ],
      [
        'from_18_to_60_community',
        CATEGORIES.from_18_to_60_community.name,
        CATEGORIES.from_18_to_60_community.parentGroupName,
        `=SUMIF('Danh sách hồ sơ'!D:D, "from_18_to_60_community", 'Danh sách hồ sơ'!G:G)`,
        `=IF(${totalRecordsFormula}>0, D5/${totalRecordsFormula}, 0)`,
      ],
      [
        'from_18_to_60_worker',
        CATEGORIES.from_18_to_60_worker.name,
        CATEGORIES.from_18_to_60_worker.parentGroupName,
        `=SUMIF('Danh sách hồ sơ'!D:D, "from_18_to_60_worker", 'Danh sách hồ sơ'!G:G)`,
        `=IF(${totalRecordsFormula}>0, D6/${totalRecordsFormula}, 0)`,
      ],
      [
        'from_18_to_60_officer',
        CATEGORIES.from_18_to_60_officer.name,
        CATEGORIES.from_18_to_60_officer.parentGroupName,
        `=SUMIF('Danh sách hồ sơ'!D:D, "from_18_to_60_officer", 'Danh sách hồ sơ'!G:G)`,
        `=IF(${totalRecordsFormula}>0, D7/${totalRecordsFormula}, 0)`,
      ],
      [
        'above_60',
        CATEGORIES.above_60.name,
        CATEGORIES.above_60.parentGroupName,
        `=SUMIF('Danh sách hồ sơ'!D:D, "above_60", 'Danh sách hồ sơ'!G:G)`,
        `=IF(${totalRecordsFormula}>0, D8/${totalRecordsFormula}, 0)`,
      ],
      [
        'TOTAL',
        'TỔNG CỘNG HỒ SƠ',
        '-',
        totalRecordsFormula,
        `=SUM(E3:E8)`,
      ],
    ];

    const summaryValues = [summaryHeaders, ...summaryRows];

    // Clear 'Báo cáo tổng hợp' completely
    await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Báo cáo tổng hợp!A1:Z100:clear`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    // Write summary templates and formulas
    const updateSummaryRes = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Báo cáo tổng hợp!A1?valueInputOption=USER_ENTERED`,
      {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          range: 'Báo cáo tổng hợp!A1',
          majorDimension: 'ROWS',
          values: summaryValues,
        }),
      }
    );

    if (!updateSummaryRes.ok) {
      throw new Error(`Failed to write summary: ${updateSummaryRes.statusText}`);
    }

    // Apply number formatting using batchUpdate standard spreadsheets formatting to make the Percentage look correct
    await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        requests: [
          // Bold the headers in both sheets
          {
            repeatCell: {
              range: {
                sheetId: 0, // usually first sheet (Danh sách hồ sơ)
                startRowIndex: 0,
                endRowIndex: 1,
              },
              cell: {
                userEnteredFormat: {
                  textFormat: { bold: true },
                  backgroundColor: { red: 0.9, green: 0.94, blue: 1.0 },
                },
              },
              fields: 'userEnteredFormat(textFormat,backgroundColor)',
            },
          },
          {
            repeatCell: {
              range: {
                sheetId: 1, // Báo cáo tổng hợp (approx index 1, or dynamic is safer but 1 is usually it)
                startRowIndex: 0,
                endRowIndex: 1,
              },
              cell: {
                userEnteredFormat: {
                  textFormat: { bold: true },
                  backgroundColor: { red: 0.9, green: 0.94, blue: 1.0 },
                },
              },
              fields: 'userEnteredFormat(textFormat,backgroundColor)',
            },
          },
          // Format percentage column in Báo cáo tổng hợp (Column E is Index 4)
          {
            repeatCell: {
              range: {
                sheetId: 1,
                startRowIndex: 1,
                endRowIndex: 9,
                startColumnIndex: 4,
                endColumnIndex: 5,
              },
              cell: {
                userEnteredFormat: {
                  numberFormat: {
                    type: 'PERCENT',
                    pattern: '0.0%',
                  },
                },
              },
              fields: 'userEnteredFormat(numberFormat)',
            },
          },
          // Format Total row in Báo cáo tổng hợp (Row 8, Index 7 is Total)
          {
            repeatCell: {
              range: {
                sheetId: 1,
                startRowIndex: 7,
                endRowIndex: 8,
              },
              cell: {
                userEnteredFormat: {
                  textFormat: { bold: true },
                  backgroundColor: { red: 0.95, green: 0.95, blue: 0.95 },
                },
              },
              fields: 'userEnteredFormat(textFormat,backgroundColor)',
            },
          },
        ],
      }),
    });
  } catch (error) {
    console.error('Lỗi khi đồng bộ Google Sheets:', error);
    throw error;
  }
};
