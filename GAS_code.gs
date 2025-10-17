// Code.gs
const FIXED_KEY = 'VoIPGateway48231';

function doPost(e) {
  return handleRequest(e);
}

function doGet(e) {
  return handleRequest(e);
}

function doOptions() {
  return buildResponse({}, true);
}

function handleRequest(e) {
  try {
    const macRaw = extractMac(e);
    const result = generatePassword(macRaw);
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
