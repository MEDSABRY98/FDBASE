/**
 * Google Apps Script for AHLY LINEUP Data Distribution
 * This script handles saving lineup data to different sheets based on target sheet selection
 */

// Configuration - Update these with your actual Google Sheets IDs
const SHEET_CONFIG = {
  'CLAM': '11Op0E4wUI_A6yo1yCe3Gz5QvRb2tR_bD75eNwP-Wnj4',
  'ALAM': '1dFTxTJJAr2TRCSmAVOQZgoMvyyz5TeJ4bfEGWjM6cE4', 
  'CCAM': '1jUOKUJQhAPEYP8i1xU9Nn_a7O11T34Vpk61eJtBSM8k',
  'SCAM': '1aP4CJHeyj_sVxqJz8YnjrxxcA4RenOWqnpkXBHCs5AE',
  'CWCAM': '1YF2UbWWX54lz9akSlEZObyaU1_EPsoQArSvSlwPG0Ys',
  'WCAM': '1ghZCE0b5ssdRtZdJM-38LlE-JrLMVGGs9HDV4C0hC1I',
  'EGYAM': '1_cwgRcc5vHk9lHl7Anc1Mo_W4rAoIsCP9ILS4FPny8Q'
};

// Fallback: Create new spreadsheet if sheet ID doesn't work
const FALLBACK_SPREADSHEET_ID = 'YOUR_MAIN_SPREADSHEET_ID_HERE';

// Column headers for all sheets
const COLUMN_HEADERS = ['DATE', 'MINMAT', 'PLAYER', 'STATU', 'PLAYEROUT', 'MINOUT', 'MINTOTAL'];

/**
 * Main function to handle lineup data saving
 * Called via HTTP POST request from the web app
 */
function doPost(e) {
  try {
    // Check if e and postData exist
    if (!e || !e.postData || !e.postData.contents) {
      return ContentService
        .createTextOutput(JSON.stringify({
          success: false,
          message: 'No data received in POST request'
        }))
        .setMimeType(ContentService.MimeType.JSON);
    }
    
    // Parse the incoming data
    const data = JSON.parse(e.postData.contents);
    
    // Validate required fields
    if (!data.target_sheet || !data.players || !Array.isArray(data.players)) {
      return ContentService
        .createTextOutput(JSON.stringify({
          success: false,
          message: 'Missing required fields: target_sheet and players array'
        }))
        .setMimeType(ContentService.MimeType.JSON);
    }
    
    // Get the target sheet ID
    const targetSheetId = SHEET_CONFIG[data.target_sheet];
    if (!targetSheetId) {
      return ContentService
        .createTextOutput(JSON.stringify({
          success: false,
          message: `Unknown target sheet: ${data.target_sheet}`
        }))
        .setMimeType(ContentService.MimeType.JSON);
    }
    
    // Try to open spreadsheet with multiple approaches
    let spreadsheet;
    
    // Method 1: Try direct openById
    try {
      spreadsheet = SpreadsheetApp.openById(targetSheetId);
      console.log(`Successfully opened spreadsheet: ${spreadsheet.getName()}`);
    } catch (error) {
      console.log(`Method 1 failed: ${error.toString()}`);
      
      // Method 2: Try with URL
      try {
        const url = `https://docs.google.com/spreadsheets/d/${targetSheetId}/edit`;
        spreadsheet = SpreadsheetApp.openByUrl(url);
        console.log(`Successfully opened by URL: ${spreadsheet.getName()}`);
      } catch (urlError) {
        console.log(`Method 2 failed: ${urlError.toString()}`);
        
        // Method 3: Create new spreadsheet for testing
        try {
          spreadsheet = SpreadsheetApp.create(`AHLY LINEUP - ${data.target_sheet} - ${new Date().toISOString()}`);
          console.log(`Created new spreadsheet: ${spreadsheet.getId()}`);
          
          return ContentService
            .createTextOutput(JSON.stringify({
              success: true,
              message: `Created new spreadsheet for testing. ID: ${spreadsheet.getId()}`,
              new_spreadsheet_id: spreadsheet.getId(),
              new_spreadsheet_url: spreadsheet.getUrl()
            }))
            .setMimeType(ContentService.MimeType.JSON);
            
        } catch (createError) {
          return ContentService
            .createTextOutput(JSON.stringify({
              success: false,
              message: `All methods failed. Original error: ${error.toString()}, URL error: ${urlError.toString()}, Create error: ${createError.toString()}`
            }))
            .setMimeType(ContentService.MimeType.JSON);
        }
      }
    }
    
    // Get the target sheet - try multiple approaches
    let sheet;
    try {
      // First try: get sheet by exact name
      sheet = spreadsheet.getSheetByName(data.target_sheet);
      
      // Second try: if not found, get the first sheet (main sheet)
      if (!sheet) {
        sheet = spreadsheet.getSheets()[0];
        console.log(`Sheet '${data.target_sheet}' not found, using main sheet: ${sheet.getName()}`);
      }
      
      // Third try: if still not found, create new sheet
      if (!sheet) {
        sheet = spreadsheet.insertSheet(data.target_sheet);
        console.log(`Created new sheet: ${data.target_sheet}`);
      }
    } catch (error) {
      console.error(`Error getting sheet: ${error.toString()}`);
      return ContentService
        .createTextOutput(JSON.stringify({
          success: false,
          message: `Error accessing sheet: ${error.toString()}`
        }))
        .setMimeType(ContentService.MimeType.JSON);
    }
    
    // Ensure headers are present
    ensureHeaders(sheet);
    
    // Prepare data rows
    const dataRows = prepareDataRows(data);
    
    // Add data to sheet
    if (dataRows.length > 0) {
      // Find the last row with data (not empty)
      const lastRow = sheet.getLastRow();
      let lastDataRow = 1; // Start from header row
      
      // Check from bottom to top to find last row with actual data
      for (let row = lastRow; row > 1; row--) {
        const rowValues = sheet.getRange(row, 1, 1, COLUMN_HEADERS.length).getValues()[0];
        const hasData = rowValues.some(cell => cell && cell.toString().trim() !== '');
        
        if (hasData) {
          lastDataRow = row;
          break;
        }
      }
      
      // Ensure there's an empty row after the last data
      const nextEmptyRow = lastDataRow + 1;
      const nextRowValues = sheet.getRange(nextEmptyRow, 1, 1, COLUMN_HEADERS.length).getValues()[0];
      const isNextRowEmpty = !nextRowValues.some(cell => cell && cell.toString().trim() !== '');
      
      if (!isNextRowEmpty) {
        // Insert empty row after last data
        sheet.insertRowAfter(lastDataRow);
      }
      
      // Add each player data row starting from the position after the empty row
      const startRow = nextEmptyRow + 1;
      dataRows.forEach((row, index) => {
        const targetRow = startRow + index;
        sheet.getRange(targetRow, 1, 1, COLUMN_HEADERS.length).setValues([row]);
      });
    }
    
    return ContentService
      .createTextOutput(JSON.stringify({
        success: true,
        message: `Data saved successfully to ${data.target_sheet} sheet`,
        players_saved: dataRows.length
      }))
      .setMimeType(ContentService.MimeType.JSON);
      
  } catch (error) {
    console.error('Error in doPost:', error);
    console.error('Error details:', error.toString());
    console.error('Stack trace:', error.stack);
    
    return ContentService
      .createTextOutput(JSON.stringify({
        success: false,
        message: `Error: ${error.toString()}`,
        error_type: error.name,
        error_details: error.message
      }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * Handle GET requests (for testing)
 */
function doGet(e) {
  return ContentService
    .createTextOutput(JSON.stringify({
      message: 'AHLY LINEUP Google Apps Script is running',
      available_sheets: Object.keys(SHEET_CONFIG),
      timestamp: new Date().toISOString()
    }))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * Ensure the sheet has proper headers
 */
function ensureHeaders(sheet) {
  const lastRow = sheet.getLastRow();
  
  if (lastRow === 0) {
    // Sheet is empty, add headers
    sheet.getRange(1, 1, 1, COLUMN_HEADERS.length).setValues([COLUMN_HEADERS]);
    
    // Format headers
    const headerRange = sheet.getRange(1, 1, 1, COLUMN_HEADERS.length);
    headerRange.setFontWeight('bold');
    headerRange.setBackground('#f0f0f0');
  } else {
    // Check if headers exist in first row
    const firstRowValues = sheet.getRange(1, 1, 1, COLUMN_HEADERS.length).getValues()[0];
    const hasHeaders = COLUMN_HEADERS.every((header, index) => 
      firstRowValues[index] && firstRowValues[index].toString().trim() === header
    );
    
    if (!hasHeaders) {
      // Insert headers at the beginning
      sheet.insertRowBefore(1);
      sheet.getRange(1, 1, 1, COLUMN_HEADERS.length).setValues([COLUMN_HEADERS]);
      
      // Format headers
      const headerRange = sheet.getRange(1, 1, 1, COLUMN_HEADERS.length);
      headerRange.setFontWeight('bold');
      headerRange.setBackground('#f0f0f0');
    }
  }
}

/**
 * Prepare data rows from the incoming data
 */
function prepareDataRows(data) {
  const rows = [];
  const matchDate = data.match_date || '';
  
  data.players.forEach(player => {
    if (player.name && player.name.trim() !== '') {
      rows.push([
        matchDate,
        player.minmat || '',
        player.name || '',
        player.status || '',
        player.playerout || '',
        player.minout || '',
        player.mintotal || ''
      ]);
    }
  });
  
  return rows;
}

