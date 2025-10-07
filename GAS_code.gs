// Code.gs
const FIXED_KEY = 'VoIPGateway48231';

function doPost(e) {
  try {
    const rawBody = e && e.postData ? e.postData.contents : '';
    const payload = rawBody ? JSON.parse(rawBody) : {};
    const macRaw = typeof payload.mac === 'string' ? payload.mac : '';
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
  const mac16enc = normalized.substring(2) + normalized.substring(6);
  let password = '';
  for (let i = 0; i < 16; i++) {
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

function normalizeMac(value) {
  if (!value) return '';
  return value.replace(/[-:\.\s]/g, '').toUpperCase();
}

function buildResponse(obj) {
  const output = ContentService.createTextOutput(JSON.stringify(obj));
  output.setMimeType(ContentService.MimeType.JSON);
  setHeaderCompat(output, 'Access-Control-Allow-Origin', '*');
  setHeaderCompat(output, 'Access-Control-Allow-Methods', 'POST');
  setHeaderCompat(output, 'Access-Control-Allow-Headers', 'Content-Type');
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
