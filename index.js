// index.js
import { DEFAULTS } from './config.js';
import { HTML_CONTENT } from './html.js';

export default {
  async fetch(request, env, ctx) {
    const config = buildConfig(env);
    const url = new URL(request.url);

    // --- 0. 環境チェック ---
    if (!config.fixedKey) {
      return buildErrorResponse(config.allowOrigin, 500, "Error: Server configuration missing (FIXED_KEY).");
    }

    // --- 1. 管理者用アクセス ---
    if (url.pathname === config.adminPath) {
      return handleAdminRequest(request, env, config);
    }

    // --- 2. ブラウザ表示 (HTMLを返す) ---
    // ★重要: ここが削除されていたため、ページが表示されませんでした
    // GETメソッドで、パラメータがない場合はHTMLを表示
    if (request.method === "GET" && !url.searchParams.has("mac") && !url.searchParams.has("callback")) {
      return new Response(HTML_CONTENT, {
        headers: { "Content-Type": "text/html; charset=utf-8" },
      });
    }

    // --- 3. API処理 (パスワード生成) ---
    if (request.method === "OPTIONS") {
      return buildCorsResponse(config.allowOrigin, 204);
    }
    if (request.method !== "GET" && request.method !== "POST") {
      return buildErrorResponse(config.allowOrigin, 405, "Method Not Allowed");
    }

    let params;
    try {
      params = await extractParams(request, config.maxCallbackLength);
    } catch (e) {
      return buildErrorResponse(config.allowOrigin, 400, "Invalid Request");
    }

    const { mac, callback, via } = params;
    if (!mac) {
      return buildErrorResponse(config.allowOrigin, 400, "MAC アドレスを指定してください。", callback);
    }

    // パスワード生成
    const result = generatePassword(mac, config.fixedKey);
    if (result.error) {
      return buildErrorResponse(config.allowOrigin, 400, result.error, callback);
    }

    // D1へログ保存
    ctx.waitUntil(
      saveLogToD1(env, {
        timestamp: new Date().toISOString(),
        mac: normalizeMac(mac),
        password: result.password,
        via: via || config.via,
        environment: config.environment,
      })
    );

    // 結果返却
    if (callback) {
      return buildJsonpResponse(config.allowOrigin, 200, callback, result);
    }
    return buildJsonResponse(config.allowOrigin, 200, result);
  },
};

// --- ヘルパー関数 ---

async function saveLogToD1(env, log) {
  if (!env.DB) return; 
  try {
    await env.DB.prepare(
      "INSERT INTO logs (timestamp, mac, password, via, environment) VALUES (?, ?, ?, ?, ?)"
    )
    .bind(log.timestamp, log.mac, log.password, log.via, log.environment)
    .run();
  } catch (err) {
    console.error("D1 Log Error:", err);
  }
}

async function handleAdminRequest(request, env, config) {
  const url = new URL(request.url);
  const token = url.searchParams.get(config.adminTokenQueryKey);

  if (token !== config.adminToken) {
    return buildErrorResponse(config.allowOrigin, 401, "Unauthorized");
  }
  if (!env.DB) {
    return buildErrorResponse(config.allowOrigin, 500, "Database not configured");
  }

  try {
    const { results } = await env.DB.prepare(
      "SELECT * FROM logs ORDER BY id DESC LIMIT 100"
    ).all();
    return buildJsonResponse(config.allowOrigin, 200, { logs: results });
  } catch (err) {
    return buildErrorResponse(config.allowOrigin, 500, "DB Error: " + err.message);
  }
}

function buildConfig(env) {
  return {
    allowOrigin: env.ALLOW_ORIGIN || DEFAULTS.allowOrigin,
    environment: env.ENVIRONMENT || DEFAULTS.environment,
    via: DEFAULTS.via,
    maxCallbackLength: DEFAULTS.maxCallbackLength,
    adminPath: env.ADMIN_PATH || DEFAULTS.adminPath,
    adminToken: env.ADMIN_TOKEN || "", 
    adminTokenQueryKey: env.ADMIN_TOKEN_QUERY_KEY || DEFAULTS.adminTokenQueryKey,
    fixedKey: env.FIXED_KEY || DEFAULTS.fixedKey,
  };
}

function generatePassword(macRaw, fixedKey) {
  const normalized = normalizeMac(macRaw);
  if (!normalized) return { error: "MAC アドレスを入力してください。" };
  if (normalized.length !== 12) return { error: "MAC アドレス長が不正です。" };
  if (!/^[0-9A-F]{12}$/.test(normalized)) return { error: "MAC アドレスが16進数ではありません。" };

  const mac16enc = normalized.substring(2, 12) + normalized.substring(6, 12);
  let password = "";
  for (let i = 0; i < mac16enc.length; i++) {
    const m = mac16enc.charCodeAt(i);
    const k = fixedKey.charCodeAt(i % fixedKey.length);
    let p = String.fromCharCode(m | k);
    const code = p.charCodeAt(0);
    if (!/[0-9A-Za-z/_-]/.test(p) || code < 0x21 || code > 0x7e) p = "_";
    password += p;
  }
  return { password };
}

function normalizeMac(value) {
  if (value == null) return "";
  return String(value).replace(/[-:.\s]/g, "").toUpperCase();
}

async function extractParams(request, maxCallbackLength) {
  const url = new URL(request.url);
  const callback = (url.searchParams.get("callback") || "").replace(/[^0-9A-Za-z_.]/g, "").slice(0, maxCallbackLength);
  
  if (request.method === "GET") {
    return { mac: url.searchParams.get("mac") || "", callback, via: "GET" };
  }
  if (request.method === "POST") {
    const type = request.headers.get("content-type") || "";
    if (type.includes("json")) {
      const body = await request.json().catch(() => ({}));
      return { mac: body.mac || "", callback, via: "POST" };
    }
    if (type.includes("form")) {
      const form = await request.formData();
      return { mac: form.get("mac") || "", callback, via: "POST" };
    }
    return { mac: (await request.text()).trim(), callback, via: "POST" };
  }
  return { mac: "", callback, via: "UNKNOWN" };
}

function buildCorsResponse(origin, status) {
  return new Response(null, { status, headers: { "Access-Control-Allow-Origin": origin, "Access-Control-Allow-Methods": "GET,POST,OPTIONS", "Access-Control-Allow-Headers": "Content-Type" } });
}
function buildJsonResponse(origin, status, data) {
  return new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json; charset=utf-8", "Access-Control-Allow-Origin": origin } });
}
function buildJsonpResponse(origin, status, callback, data) {
  return new Response(`${callback}(${JSON.stringify(data)});`, { status: status >= 400 ? 200 : status, headers: { "Content-Type": "application/javascript; charset=utf-8", "Access-Control-Allow-Origin": origin } });
}
function buildErrorResponse(origin, status, message, callback) {
  const data = { error: message };
  return callback ? buildJsonpResponse(origin, status, callback, data) : buildJsonResponse(origin, status, data);
}
