// Code.gs
const FIXED_KEY = 'VoIPGateway48231';
// スクリプトプロパティに設定したスプレッドシートIDのキー名
const SPREADSHEET_ID_PROP = 'SPREADSHEET_ID';
const ADMIN_TOKEN_PROP = 'ADMIN_TOKEN';
const ADMIN_ALLOWED_IPS_PROP = 'ADMIN_ALLOWED_IPS';
const LOG_SHEET_NAME = 'request_logs';
const LOG_COLUMNS = ['timestamp', 'mac', 'password', 'via'];

function doPost(e) {
  return handleRequest(e);
}

function doGet(e) {
  if (isAdminRequest(e)) {
    return handleAdminRequest(e);
  }
  return handleRequest(e);
}

function doOptions() {
  return buildResponse({}, true);
}

function handleRequest(e) {
  try {
    const macRaw = extractMac(e);
    const result = generatePassword(macRaw);
    if (result && result.password) {
      try {
        appendPasswordLog({
          mac: normalizeMac(macRaw),
          password: result.password,
          via: extractVia(e),
        });
      } catch (loggingError) {
        // ログ記録の失敗はレスポンスに影響させない
      }
    }
    const callback = extractCallback(e);
    if (callback) {
      return buildJsonpResponse(callback, result);
    }
    return buildResponse(result);
  } catch (error) {
    return buildResponse({ error: '内部エラーが発生しました。' });
  }
}

function generatePassword(macRaw) {
  const normalized = normalizeMac(macRaw);
  if (!normalized) {
    return { error: 'MACアドレスを入力してください。' };
  }

  if (normalized.length !== 12) {
    return { error: 'MACアドレス長が不正です。' };
  }

  if (!/^[0-9A-F]{12}$/.test(normalized)) {
    return { error: 'MACアドレスが16進数ではありません。' };
  }

  const mac16enc = normalized.substring(2, 12) + normalized.substring(6, 12);
  let password = '';

  for (let i = 0; i < mac16enc.length; i++) {
    const m = mac16enc.charCodeAt(i);
    const k = FIXED_KEY.charCodeAt(i % FIXED_KEY.length);
    let p = String.fromCharCode(m | k);

    const code = p.charCodeAt(0);
    if (!(/[0-9A-Za-z\/_-]/.test(p)) || code < 0x21 || code > 0x7e) {
      p = '_';
    }

    password += p;
  }

  return { password };
}

function extractMac(e) {
  if (!e) {
    return '';
  }

  if (e.parameter && typeof e.parameter.mac === 'string' && e.parameter.mac) {
    return e.parameter.mac;
  }

  if (e.postData && typeof e.postData.contents === 'string') {
    const type = (e.postData.type || '').toLowerCase();
    const contents = e.postData.contents;
    const treatAsJson = !type || type.indexOf('application/json') !== -1;
    const treatAsForm = !type || type.indexOf('application/x-www-form-urlencoded') !== -1;
    const treatAsPlain = type.indexOf('text/plain') !== -1;

    if (contents) {
      if (treatAsJson) {
        try {
          const parsed = JSON.parse(contents);
          if (parsed && typeof parsed.mac === 'string') {
            return parsed.mac;
          }
        } catch (err) {
          // ignore
        }
      }

      if (treatAsForm) {
        const params = Utilities.parseQueryString(contents);
        if (params.mac) {
          return String(params.mac);
        }
      }

      if (treatAsPlain) {
        return contents.trim();
      }
    }
  }

  return '';
}

function extractCallback(e) {
  if (!e || !e.parameter) {
    return '';
  }
  const callback = e.parameter.callback;
  if (typeof callback !== 'string') {
    return '';
  }
  return callback.replace(/[^0-9A-Za-z_\.]/g, '').substring(0, 100);
}

function normalizeMac(value) {
  if (value == null) {
    return '';
  }
  if (typeof value !== 'string') {
    value = String(value);
  }
  const cleaned = value.replace(/[-:\.\s]/g, '').toUpperCase();
  return cleaned;
}

function buildResponse(obj, isOptions) {
  const payload = isOptions ? '' : JSON.stringify(obj);
  const output = ContentService.createTextOutput(payload);
  if (!isOptions && typeof output.setMimeType === 'function') {
    output.setMimeType(ContentService.MimeType.JSON);
  }
  if (typeof output.setHeader === 'function') {
    output.setHeader('Access-Control-Allow-Origin', '*');
    output.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    output.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    output.setHeader('Access-Control-Max-Age', '3600');
  }
  return output;
}

function buildJsonpResponse(callback, obj) {
  const safeCallback = callback || 'callback';
  const payload = `${safeCallback}(${JSON.stringify(obj)});`;
  const output = ContentService.createTextOutput(payload)
    .setMimeType(ContentService.MimeType.JAVASCRIPT);
  if (typeof output.setHeader === 'function') {
    output.setHeader('Cache-Control', 'no-store, max-age=0');
  }
  return output;
}

function appendPasswordLog(entry) {
  const props = PropertiesService.getScriptProperties();
  const spreadsheetId = props.getProperty(SPREADSHEET_ID_PROP);
  if (!spreadsheetId) {
    return;
  }
  const spreadsheet = SpreadsheetApp.openById(spreadsheetId);
  let sheet = spreadsheet.getSheetByName(LOG_SHEET_NAME);
  if (!sheet) {
    sheet = spreadsheet.insertSheet(LOG_SHEET_NAME);
  }
  const row = LOG_COLUMNS.map(function (key) {
    if (key === 'timestamp') {
      return new Date();
    }
    return entry[key] || '';
  });
  sheet.appendRow(row);
}

function extractVia(e) {
  if (e && e.parameter && typeof e.parameter.via === 'string' && e.parameter.via) {
    return e.parameter.via.substring(0, 100);
  }
  if (e && e.postData) {
    return 'POST';
  }
  return 'GET';
}

function isAdminRequest(e) {
  return Boolean(e && e.parameter && typeof e.parameter.admin !== 'undefined');
}

function handleAdminRequest(e) {
  if (!isAuthorizedAdmin(e)) {
    return buildResponse({ error: '認証に失敗しました。' });
  }

  const filters = {
    from: parseDateParameter(e.parameter.from),
    to: parseDateParameter(e.parameter.to, true),
    mac: normalizeMac(e.parameter.mac || ''),
  };
  const format = (e.parameter.format || 'json').toLowerCase();
  const logs = fetchLogs(filters);

  if (format === 'csv') {
    return buildAdminCsvResponse(logs);
  }
  return buildResponse({ logs });
}

function isAuthorizedAdmin(e) {
  const props = PropertiesService.getScriptProperties();
  const adminToken = props.getProperty(ADMIN_TOKEN_PROP) || '';
  const allowedIpsRaw = props.getProperty(ADMIN_ALLOWED_IPS_PROP) || '';
  const allowedIps = allowedIpsRaw
    .split(',')
    .map(function (ip) { return ip.trim(); })
    .filter(function (ip) { return ip; });

  const providedToken = (e && e.parameter && e.parameter.token) || '';
  var clientIp = '';
  if (e && e.context && e.context.clientIp) {
    clientIp = e.context.clientIp;
  } else if (e && e.parameter && e.parameter.clientIp) {
    clientIp = e.parameter.clientIp;
  }

  if (adminToken && providedToken && adminToken === providedToken) {
    return true;
  }
  if (clientIp && allowedIps.length > 0 && allowedIps.indexOf(clientIp) !== -1) {
    return true;
  }
  return false;
}

function parseDateParameter(value, asEndOfDay) {
  if (!value) {
    return null;
  }
  var date;
  try {
    date = new Date(value);
  } catch (err) {
    return null;
  }
  if (isNaN(date.getTime())) {
    return null;
  }
  if (asEndOfDay) {
    date.setHours(23, 59, 59, 999);
  }
  return date;
}

function fetchLogs(filters) {
  const props = PropertiesService.getScriptProperties();
  const spreadsheetId = props.getProperty(SPREADSHEET_ID_PROP);
  if (!spreadsheetId) {
    return [];
  }
  const spreadsheet = SpreadsheetApp.openById(spreadsheetId);
  const sheet = spreadsheet.getSheetByName(LOG_SHEET_NAME);
  if (!sheet) {
    return [];
  }
  const values = sheet.getDataRange().getValues();
  return values
    .map(function (row) {
      const record = {};
      LOG_COLUMNS.forEach(function (key, idx) {
        record[key] = row[idx];
      });
      return record;
    })
    .filter(function (record) {
      if (!record.timestamp || !(record.timestamp instanceof Date)) {
        return false;
      }
      if (filters.from && record.timestamp < filters.from) {
        return false;
      }
      if (filters.to && record.timestamp > filters.to) {
        return false;
      }
      if (filters.mac && filters.mac !== normalizeMac(record.mac || '')) {
        return false;
      }
      return true;
    });
}

function buildAdminCsvResponse(logs) {
  const rows = [LOG_COLUMNS].concat(
    logs.map(function (log) {
      return LOG_COLUMNS.map(function (key) {
        if (key === 'timestamp' && log[key] instanceof Date) {
          return Utilities.formatDate(log[key], Session.getScriptTimeZone(), "yyyy-MM-dd'T'HH:mm:ssXXX");
        }
        return log[key] || '';
      });
    })
  );

  const csv = rows
    .map(function (row) {
      return row
        .map(function (value) {
          const str = value === null || value === undefined ? '' : String(value);
          const escaped = str.replace(/"/g, '""');
          return '"' + escaped + '"';
        })
        .join(',');
    })
    .join('\n');

  const output = ContentService.createTextOutput(csv).setMimeType(ContentService.MimeType.CSV);
  if (typeof output.setHeader === 'function') {
    output.setHeader('Content-Disposition', 'attachment; filename="password_logs.csv"');
  }
  return output;
}
