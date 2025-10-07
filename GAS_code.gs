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

    if (contents) {
      if (treatAsJson) {
        try {
          const parsed = JSON.parse(contents);
          if (parsed && typeof parsed.mac === 'string') {
            return parsed.mac;
          }
        } catch (err) {
          // フォーマットエラー時は他の形式を確認
        }
      }

      if (treatAsForm) {
        const params = Utilities.parseQueryString(contents);
        if (params.mac) {
          return String(params.mac);
        }
      }
    }
  }

  return '';
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
  setHeaderCompat(output, 'Access-Control-Allow-Origin', '*');
  if (!isOptions && typeof output.setMimeType === 'function') {
    output.setMimeType(ContentService.MimeType.JSON);
  }
  setHeaderCompat(output, 'Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  setHeaderCompat(output, 'Access-Control-Allow-Headers', 'Content-Type');
  setHeaderCompat(output, 'Access-Control-Max-Age', '3600');
  return output;
}

function setHeaderCompat(output, name, value) {
  if (typeof output.setHeader === 'function') {
    output.setHeader(name, value);
    return;
  }
  if (typeof output.appendHeader === 'function') {
    output.appendHeader(name, value);
  }
}
