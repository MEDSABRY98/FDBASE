/**
 * Google Apps Script for AHLY PKs Data Entry
 * Handles saving penalty kick data to Google Sheets
 */

// Configuration for the PKS sheet
const PKS_SHEET_ID = '1NM06fKzqEQc-K9XLgaIgd0PyQQAMHmOCVBKttQicZwY';
const PKS_SHEET_NAME = 'PKS';

// Column headers in order
const PKS_COLUMNS = [
  'PKS System',
  'CHAMPION System', 
  'MATCH_ID',
  'SEASON',
  'CHAMPION',
  'ROUND',
  'WHO START?',
  'OPPONENT TEAM',
  'OPPONENT PLAYER',
  'OPPONENT STATUS',
  'HOWMISS OPPONENT',
  'AHLY GK',
  'MATCH RESULT',
  'PKS RESULT',
  'PKS W-L',
  'AHLY TEAM',
  'AHLY PLAYER',
  'AHLY STATUS',
  'HOWMISS AHLY',
  'OPPONENT GK'
];

/**
 * Main function to handle POST requests
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
    
    // Validate data type
    if (data.data_type !== 'ahly_pks') {
      return ContentService
        .createTextOutput(JSON.stringify({
          success: false,
          message: 'Invalid data type for PKS handler'
        }))
        .setMimeType(ContentService.MimeType.JSON);
    }
    
    // Save data to sheet
    const result = savePKSData(data);
    
    return ContentService
      .createTextOutput(JSON.stringify(result))
      .setMimeType(ContentService.MimeType.JSON);
      
  } catch (error) {
    console.error('Error in doPost:', error);
    return ContentService
      .createTextOutput(JSON.stringify({
        success: false,
        message: 'Server error: ' + error.toString()
      }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * Handle GET requests for testing
 */
function doGet(e) {
  return ContentService
    .createTextOutput(JSON.stringify({
      success: true,
      message: 'AHLY PKs Google Apps Script is running',
      timestamp: new Date().toISOString()
    }))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * Save PKS data to Google Sheet
 */
function savePKSData(data) {
  try {
    // Open the spreadsheet
    const spreadsheet = SpreadsheetApp.openById(PKS_SHEET_ID);
    let sheet = spreadsheet.getSheetByName(PKS_SHEET_NAME);
    
    // Create sheet if it doesn't exist
    if (!sheet) {
      sheet = spreadsheet.insertSheet(PKS_SHEET_NAME);
      // Add headers
      sheet.getRange(1, 1, 1, PKS_COLUMNS.length).setValues([PKS_COLUMNS]);
      // Format headers
      const headerRange = sheet.getRange(1, 1, 1, PKS_COLUMNS.length);
      headerRange.setBackground('#4285f4');
      headerRange.setFontColor('white');
      headerRange.setFontWeight('bold');
    }
    
    // Get the last row with data
    const lastRow = sheet.getLastRow();
    const nextRow = lastRow + 1;
    
    // Prepare data for each PK entry
    const rowsToAdd = [];
    
    // Add player rows with both Ahly and Opponent players in the same row
    let max_players = Math.max(
      Object.keys(data).filter(key => key.startsWith('ahly_') && key.includes('_player_name')).length,
      Object.keys(data).filter(key => key.startsWith('opponent_') && key.includes('_player_name')).length
    );
    
    for (let i = 0; i < max_players; i++) {
      const ahly_player = data[`ahly_${i}_player_name`] || '';
      const opponent_player = data[`opponent_${i}_player_name`] || '';
      
      // Only add row if at least one player has data
      if (ahly_player.trim() !== '' || opponent_player.trim() !== '') {
        const row = [
          data.pks_system || '', // PKS System
          data.champion_system || '', // CHAMPION System
          data.match_id || '', // MATCH_ID
          data.season || '', // SEASON
          data.champion || '', // CHAMPION
          data.round || '', // ROUND
          data.who_start || '', // WHO START?
          data.opponent_team || '', // OPPONENT TEAM
          opponent_player, // OPPONENT PLAYER
          data[`opponent_${i}_eleven_backup`] || '', // OPPONENT STATUS
          data[`opponent_${i}_howmiss`] || '', // HOWMISS OPPONENT
          data.ahly_gk || '', // AHLY GK
          data.match_result || '', // MATCH RESULT
          data.pks_result || '', // PKS RESULT
          data.pks_wl || '', // PKS W-L
          data.ahly_team || '', // AHLY TEAM
          ahly_player, // AHLY PLAYER
          data[`ahly_${i}_eleven_backup`] || '', // AHLY STATUS
          data[`ahly_${i}_howmiss`] || '', // HOWMISS AHLY
          data.opponent_gk || '' // OPPONENT GK
        ];
        rowsToAdd.push(row);
      }
    }
    
    // If no players data, add basic match data
    if (rowsToAdd.length === 0) {
      const row = [
        data.pks_system || '',
        data.champion_system || '',
        data.match_id || '',
        data.season || '',
        data.champion || '',
        data.round || '',
        data.who_start || '',
        data.opponent_team || '',
        data.opponent_player || '',
        data.opponent_status || '',
        data.howmiss_opponent || '',
        data.ahly_gk || '',
        data.match_result || '',
        data.pks_result || '',
        data.pks_wl || '',
        data.ahly_team || '',
        data.ahly_player || '',
        data.ahly_status || '',
        data.howmiss_ahly || '',
        data.opponent_gk || ''
      ];
      rowsToAdd.push(row);
    }
    
    // Add data to sheet
    if (rowsToAdd.length > 0) {
      // أضف سطر فارغ قبل البيانات الجديدة
      const emptyRow = new Array(PKS_COLUMNS.length).fill('');
      rowsToAdd.unshift(emptyRow);
      
      const range = sheet.getRange(nextRow, 1, rowsToAdd.length, PKS_COLUMNS.length);
      range.setValues(rowsToAdd);

      // Auto-resize columns
      sheet.autoResizeColumns(1, PKS_COLUMNS.length);
    }
    
    return {
      success: true,
      message: `تم حفظ ${rowsToAdd.length} صف بنجاح في شيت PKS`,
      rows_added: rowsToAdd.length
    };
    
  } catch (error) {
    console.error('Error saving PKS data:', error);
    return {
      success: false,
      message: 'خطأ في حفظ البيانات: ' + error.toString()
    };
  }
}

