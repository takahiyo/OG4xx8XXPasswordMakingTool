// --- 設定・定数 ---
const DEFAULTS = {
  allowOrigin: "*",
  environment: "unknown",
  via: "API",
  maxCallbackLength: 100,
  adminPath: "/admin",
  adminTokenQueryKey: "token",
  // ★修正: コードからキーを削除。環境変数(env.FIXED_KEY)が必須になります。
  fixedKey: "", 
};

// --- フロントエンド(HTML) ---
const HTML_CONTENT = `
<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <title>パスワード生成ツール</title>
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <style>
    body { max-width: 400px; margin: 2em auto; font-size: 1.1em; font-family: sans-serif; padding: 0 1em; background: #f8f9fa; }
    h2 { font-size: 1.2em; margin-bottom: 1.5em; text-align: center; }
    label, input, button { display: block; width: 100%; margin-bottom: 0.8em; }
    input[type="text"] { padding: 0.5em; font-size: 1.1em; box-sizing: border-box; border: 1px solid #ccc; border-radius: 4px; background: #fff; }
    button { padding: 0.7em 0; font-size: 1.1em; border: none; border-radius: 4px; background: #007bff; color: #fff; margin-bottom: 1em; cursor: pointer; }
    button:active { background: #0056b3; }
    #error { color: #e74c3c; font-weight: bold; margin-bottom: 1em; text-align: center; min-height: 1.5em; }
    #password { background: #e9ecef; }
    @media (max-width: 480px) { body { max-width: 98vw; font-size: 1em; } }
  </style>
</head>
<body>
  <h2>OG4xx/OG8xx パスワード生成ツール</h2>
  <label for="macInput">MACアドレス：</label>
  <input type="text" id="macInput" size="20" autocomplete="off" placeholder="例）00:11:22:33:44:55">
  <button id="generateBtn">生成</button>
  <p id="error"></p>
  <label for="password">パスワード：</label>
  <input type="text" id="password" size="20" readonly>
  <button id="copyBtn">コピー</button>
  <script>
    // 現在のページURLへPOSTリクエストを送る
    const API_ENDPOINT = window.location.href;

    document.getElementById("generateBtn").addEventListener("click", handleGenerate);
    document.getElementById("copyBtn").addEventListener("click", copyToClipboard);

    async function handleGenerate() {
      const macInput = document.getElementById("macInput");
      const errorEl = document.getElementById("error");
      const passwordEl = document.getElementById("password");
      const macRaw = macInput.value.trim();
      
      errorEl.textContent = "";
      passwordEl.value = "";

      if (!macRaw) { errorEl.textContent = "MACアドレスを入力してください。"; return; }

      try {
        const formData = new FormData();
        formData.append("mac", macRaw);
        
        const response = await fetch(API_ENDPOINT, { method: "POST", body: formData });
        
        // レスポンスがJSONでない場合(HTMLが返ってきている等)のエラーハンドリング
        const contentType = response.headers.get("content-type");
        if (!contentType || !contentType.includes("application/json")) {
           const text = await response.text();
           console.error("Non-JSON response:", text);
           throw new Error("サーバーから不正な応答がありました。");
        }

        const data = await response.json();
        
        if (!response.ok || data.error) {
          throw new Error(data.error || "サーバーエラーが発生しました");
        }
        passwordEl.value = data.password;
        
      } catch (err) {
        errorEl.textContent = err.message;
      }
    }

    function copyToClipboard() {
      const pwd = document.getElementById("password");
      if (!pwd.value) return;
      navigator.clipboard.writeText(pwd.value).then(() => {
        alert("クリップボードにコピーしました");
      });
    }
  </script>
</body>
</html>
`;

export default {
  async fetch(request, env, ctx) {
    try {
      const config = buildConfig(env);
      const url = new URL(request.url);

      // --- 0. 環境チェック ---
      // 固定キーが設定されていない場合はエラー (コードに直書きしないため、ここでのチェックが重要)
      if (!config.fixedKey) {
        return new Response("Error: Server configuration missing (FIXED_KEY).", { status: 500 });
      }

      // --- 1. 管理者用アクセス ---
      if (url.pathname === config.adminPath) {
        return handleAdminRequest(request, env, config);
      }

      // --- 2. ブラウザ表示 (HTMLを返す) ---
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

    } catch (criticalError) {
      // 予期せぬエラーは画面に出力して原因究明できるようにする
      return new Response(`System Error: ${criticalError.message}\n${criticalError.stack}`, {
        status: 500,
        headers: { "Content-Type": "text/plain; charset=utf-8" }
      });
    }
  },
};

// --- 以下、ヘルパー関数 ---

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
    return buildErrorResponse(config.allowOrigin, 500, "Database not configured (env.DB is missing)");
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
    // 環境変数からキーを取得。なければ空文字
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
