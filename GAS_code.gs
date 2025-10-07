// Code.gs
const FIXED_KEY = 'VoIPGateway48231';

function doPost(e) {
  try {
    const macRaw = extractMac(e);
    return respondWithMac(macRaw);
  } catch (error) {
    return buildResponse({ error: '内部エラーが発生しました。' });
  }
}

function doGet(e) {
  try {
    const macRaw = extractMac(e);
    return respondWithMac(macRaw);
}

function doGet(e) {
  try {
    const macRaw = extractMac(e);
    return respondWithMac(macRaw);
  } catch (error) {
    return buildResponse({ error: '内部エラーが発生しました。' });
  }
}

function generatePassword(macRaw) {
  const normalized = normalizeMac(macRaw);
  if (!normalized) {
    return { error: 'MACアドレスを入力してください。' };
  }
  const mac16enc = normalized.substring(2, 12) + normalized.substring(6, 12);
  if (mac16enc.length !== 16) {
    return { error: 'MACアドレス長が不正です。' };
  }
    return { error: 'MACアドレス長が不正です。' };
  }
    const m = mac16enc.charCodeAt(i) || 0;
    return { error: 'MACアドレスが16進数ではありません。' };
  }
      const requestUrl = `${apiUrl}?mac=${encodeURIComponent(macRaw)}`;
      fetch(requestUrl, {
        method: "GET",
        cache: "no-store"
    const m = mac16enc.charCodeAt(i);
    const k = FIXED_KEY.charCodeAt(i % FIXED_KEY.length);
    let p = String.fromCharCode(m | k);
    const code = p.charCodeAt(0);
    if (!(/[0-9A-Za-z\/_-]/.test(p)) || code < 0x21 || code > 0x7e) {
      p = '_';
  if (value == null) {
    return '';
  }
  if (typeof value !== 'string') {
    value = String(value);
  }
  const cleaned = value.replace(/[-:\.\s]/g, '').toUpperCase();
  return cleaned;
}

function respondWithMac(macRaw) {
  const result = generatePassword(macRaw);
  return buildResponse(result);
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
  return { password };
}

function normalizeMac(value) {
  setHeaderCompat(output, 'Access-Control-Allow-Origin', '*');
  setHeaderCompat(output, 'Access-Control-Allow-Methods', 'GET, POST');
  setHeaderCompat(output, 'Access-Control-Allow-Headers', 'Content-Type');
function respondWithMac(macRaw) {
  const result = generatePassword(macRaw);

function setHeaderCompat(output, name, value) {
  if (typeof output.setHeader === 'function') {
    output.setHeader(name, value);
    return;
  }
  if (typeof output.appendHeader === 'function') {
    output.appendHeader(name, value);
  }
}
  return buildResponse(result);
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


function buildResponse(obj) {
  const output = ContentService.createTextOutput(JSON.stringify(obj));
  setHeaderCompat(output, 'Access-Control-Allow-Origin', '*');
  setHeaderCompat(output, 'Access-Control-Allow-Methods', 'GET, POST');
  setHeaderCompat(output, 'Access-Control-Allow-Headers', 'Content-Type');
  setHeaderCompat(output, 'Access-Control-Allow-Headers', 'Content-Type');
  return output;

function setHeaderCompat(output, name, value) {
  if (typeof output.setHeader === 'function') {
    output.setHeader(name, value);
    return;
  }
  if (typeof output.appendHeader === 'function') {
    output.appendHeader(name, value);
  }
}
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
