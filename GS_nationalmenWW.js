/**
 * Google Apps Script: National Men Halls Publisher
 * Source Sheet: ALLGAMES in Spreadsheet ID 1WRReyXYryMNbY_prND2CSEpP1xnzqcB67zPmbMVmrio
 * Publish as web app and set the URL in env var NATIONAL_MEN_HALLS_APPS_SCRIPT_URL
 */

function doGet() {
  try {
    var sheetId = '1WRReyXYryMNbY_prND2CSEpP1xnzqcB67zPmbMVmrio';
    var sheetName = 'ALLGAMES';
    var ss = SpreadsheetApp.openById(sheetId);
    var sh = ss.getSheetByName(sheetName);
    if (!sh) throw new Error('Sheet ALLGAMES not found');

    var range = sh.getDataRange();
    var values = range.getValues();
    if (!values || values.length < 2) {
      return ContentService.createTextOutput(JSON.stringify({ success: true, data: [] }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    var headers = values[0];
    var data = [];
    for (var i = 1; i < values.length; i++) {
      var row = values[i];
      var obj = {};
      for (var c = 0; c < headers.length; c++) {
        obj[String(headers[c])] = row[c];
      }
      data.push(obj);
    }

    var res = { success: true, data: data };
    return ContentService.createTextOutput(JSON.stringify(res))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (e) {
    var err = { success: false, error: e && e.message ? e.message : String(e) };
    return ContentService.createTextOutput(JSON.stringify(err))
      .setMimeType(ContentService.MimeType.JSON);
  }
}


