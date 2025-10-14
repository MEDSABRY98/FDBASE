/**
 * Egyptian Clubs Data - Google Apps Script
 * Sheet ID: 10UA-7awu0E_WBbxehNznng83MIUMVLCmpspvvkS1hTU
 */

function doGet(e) {
  try {
    const sheetId = '10UA-7awu0E_WBbxehNznng83MIUMVLCmpspvvkS1hTU';
    const spreadsheet = SpreadsheetApp.openById(sheetId);
    
    // Get all sheets
    const sheets = spreadsheet.getSheets();
    const data = {};
    
    sheets.forEach(sheet => {
      const sheetName = sheet.getName();
      const range = sheet.getDataRange();
      const values = range.getValues();
      
      if (values.length > 0) {
        // First row is headers
        const headers = values[0];
        const rows = [];
        
        // Process remaining rows
        for (let i = 1; i < values.length; i++) {
          const row = {};
          for (let j = 0; j < headers.length; j++) {
            row[headers[j]] = values[i][j];
          }
          rows.push(row);
        }
        
        data[sheetName] = rows;
      }
    });
    
    // Return JSON response
    return ContentService
      .createTextOutput(JSON.stringify({
        success: true,
        data: data,
        timestamp: new Date().toISOString(),
        sheets: Object.keys(data)
      }))
      .setMimeType(ContentService.MimeType.JSON);
      
  } catch (error) {
    return ContentService
      .createTextOutput(JSON.stringify({
        success: false,
        error: error.toString()
      }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

