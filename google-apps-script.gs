/**
 * 日本東北 7 天 6 夜旅遊網頁 — Google 試算表雲端同步後端 (Google Apps Script)
 *
 * 使用步驟：
 * 1. 建立一份新的 Google 試算表（https://sheets.new）
 * 2. 上方選單點選「擴充功能」➔「Apps Script」
 * 3. 將本檔案全部程式碼貼上取代原本內容並按儲存（Ctrl+S）
 * 4. 右上角點選「部署」➔「新增部署作業」➔ 類型選「網頁應用程式」
 *    - 執行身分：我
 *    - 誰可以存取：所有人
 * 5. 點擊「部署」並授權，複製產生的「網頁應用程式網址」（結尾為 /exec）
 * 6. 貼回旅遊網頁「💰 總結」頁籤的「☁️ Google 試算表雲端同步」欄位即可！
 */

const SHEET_EXPENSES = '費用明細';
const SHEET_META = '設定與進度';
const EXPENSE_HEADERS = [
  'ID',
  '狀態',
  '天數',
  '站點代碼',
  '項目名稱',
  '分類',
  '付款方式',
  '幣別',
  '金額',
  '備註',
  '金額未知',
];

function getOrCreateSheet(ss, name, headers) {
  let sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
  }
  if (headers && sheet.getLastRow() === 0) {
    sheet.appendRow(headers);
    sheet.setFrozenRows(1);
    sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold').setBackground('#eef6ff');
  }
  return sheet;
}

function jsonResponse(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(
    ContentService.MimeType.JSON
  );
}

function doGet() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const expSheet = getOrCreateSheet(ss, SHEET_EXPENSES, EXPENSE_HEADERS);
    const metaSheet = getOrCreateSheet(ss, SHEET_META, ['Key', 'Value']);

    const lastRow = expSheet.getLastRow();
    const expenses = [];

    if (lastRow > 1) {
      const values = expSheet.getRange(2, 1, lastRow - 1, EXPENSE_HEADERS.length).getValues();
      for (let i = 0; i < values.length; i++) {
        const row = values[i];
        if (!row[0] && !row[4]) continue;
        expenses.push({
          id: String(row[0] || 'exp-sheet-' + i),
          paid: row[1] === '已發生' || row[1] === true || String(row[1]).toLowerCase() === 'true',
          day: String(row[2] || 'Day 1'),
          stopKey: row[3] ? String(row[3]) : undefined,
          title: String(row[4] || ''),
          category: String(row[5] || '其他'),
          method: String(row[6] || '日幣現鈔'),
          currency: String(row[7] || 'JPY') === 'TWD' ? 'TWD' : 'JPY',
          amount: Number(row[8]) || 0,
          note: String(row[9] || ''),
          isUnknown: row[10] === true || String(row[10]).toLowerCase() === 'true',
        });
      }
    }

    const meta = {};
    const metaLastRow = metaSheet.getLastRow();
    if (metaLastRow > 1) {
      const metaRows = metaSheet.getRange(2, 1, metaLastRow - 1, 2).getValues();
      metaRows.forEach(function (r) {
        if (r[0]) meta[String(r[0])] = String(r[1] || '');
      });
    }

    const isEmpty = expenses.length === 0 && !meta.updatedAt;
    let parsedChecks = {};
    try {
      parsedChecks = meta.checks ? JSON.parse(meta.checks) : {};
    } catch (err) {
      parsedChecks = {};
    }

    return jsonResponse({
      ok: true,
      empty: isEmpty,
      exchangeRate: meta.exchangeRate ? Number(meta.exchangeRate) : null,
      expenses: expenses,
      checks: parsedChecks,
      updatedAt: meta.updatedAt || null,
    });
  } catch (err) {
    return jsonResponse({ ok: false, error: String(err) });
  }
}

function doPost(e) {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) {
    return jsonResponse({ ok: false, error: '系統忙碌中，請稍後再試' });
  }

  try {
    const raw = e && e.postData && e.postData.contents ? e.postData.contents : '{}';
    const payload = JSON.parse(raw);
    const expenses = Array.isArray(payload.expenses) ? payload.expenses : [];
    const exchangeRate = Number(payload.exchangeRate) || 0.215;
    const checks = payload.checks && typeof payload.checks === 'object' ? payload.checks : {};
    const updatedAt = new Date().toISOString();

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const expSheet = getOrCreateSheet(ss, SHEET_EXPENSES, EXPENSE_HEADERS);
    const metaSheet = getOrCreateSheet(ss, SHEET_META, ['Key', 'Value']);

    // 寫入費用明細
    expSheet.clearContents();
    expSheet.getRange(1, 1, 1, EXPENSE_HEADERS.length).setValues([EXPENSE_HEADERS]);
    expSheet.setFrozenRows(1);
    expSheet.getRange(1, 1, 1, EXPENSE_HEADERS.length).setFontWeight('bold').setBackground('#eef6ff');

    if (expenses.length > 0) {
      const rows = expenses.map(function (item) {
        return [
          String(item.id || ''),
          item.paid ? '已發生' : '預估中',
          String(item.day || 'Day 1'),
          String(item.stopKey || ''),
          String(item.title || ''),
          String(item.category || '其他'),
          String(item.method || '日幣現鈔'),
          item.currency === 'TWD' ? 'TWD' : 'JPY',
          Number(item.amount) || 0,
          String(item.note || ''),
          Boolean(item.isUnknown),
        ];
      });
      expSheet.getRange(2, 1, rows.length, EXPENSE_HEADERS.length).setValues(rows);
    }

    // 寫入設定與進度
    metaSheet.clearContents();
    metaSheet.getRange(1, 1, 4, 2).setValues([
      ['Key', 'Value'],
      ['exchangeRate', String(exchangeRate)],
      ['checks', JSON.stringify(checks)],
      ['updatedAt', updatedAt],
    ]);
    metaSheet.setFrozenRows(1);
    metaSheet.getRange(1, 1, 1, 2).setFontWeight('bold').setBackground('#fff0f5');

    return jsonResponse({
      ok: true,
      count: expenses.length,
      updatedAt: updatedAt,
    });
  } catch (err) {
    return jsonResponse({ ok: false, error: String(err) });
  } finally {
    lock.releaseLock();
  }
}
