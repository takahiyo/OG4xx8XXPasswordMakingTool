const OAUTH_SCOPES = [
  "https://www.googleapis.com/auth/userinfo.email",
  "https://www.googleapis.com/auth/firebase.database",
];

const DEFAULTS = {
  allowOrigin: "*",
  environment: "unknown",
  via: "API",
  logPath: "logs",
  maxCallbackLength: 100,
};

export default {
  async fetch(request, env, ctx) {
    const config = buildConfig(env);

    if (request.method === "OPTIONS") {
      return buildCorsResponse(config.allowOrigin, 204);
    }

    if (request.method !== "GET" && request.method !== "POST") {
      return buildErrorResponse(
        config.allowOrigin,
        405,
        "GET または POST のみ受け付けています。"
      );
    }

    if (!config.fixedKey) {
      return buildErrorResponse(
        config.allowOrigin,
        500,
        "FIXED_KEY が設定されていません。"
      );
    }

    let params;
    try {
      params = await extractParams(request, config.maxCallbackLength);
    } catch (error) {
      return buildErrorResponse(
        config.allowOrigin,
        400,
        "リクエストの解析に失敗しました。"
      );
    }

    const { mac, callback, via } = params;

    if (!mac) {
      return buildErrorResponse(
        config.allowOrigin,
        400,
        "MAC アドレスを指定してください。",
        callback
      );
    }

    const result = generatePassword(mac, config.fixedKey);

    if (result.error) {
      return buildErrorResponse(
        config.allowOrigin,
        400,
        result.error,
        callback
      );
    }

    ctx.waitUntil(
      logToFirebase(config, {
        timestamp: new Date().toISOString(),
        mac: normalizeMac(mac),
        password: result.password,
        via: via || config.via,
        environment: config.environment,
      })
    );

    if (callback) {
      return buildJsonpResponse(config.allowOrigin, 200, callback, result);
    }

    return buildJsonResponse(config.allowOrigin, 200, result);
  },
};

function buildConfig(env) {
  return {
    allowOrigin: env.ALLOW_ORIGIN || DEFAULTS.allowOrigin,
    environment: env.ENVIRONMENT || DEFAULTS.environment,
    via: DEFAULTS.via,
    logPath: env.FIREBASE_LOG_PATH || DEFAULTS.logPath,
    fixedKey: env.FIXED_KEY || "",
    firebaseDbUrl: env.FIREBASE_DB_URL || "",
    firebaseProjectId: env.FIREBASE_PROJECT_ID || "",
    firebaseClientEmail: env.FIREBASE_CLIENT_EMAIL || "",
    firebasePrivateKey: env.FIREBASE_PRIVATE_KEY || "",
    maxCallbackLength: DEFAULTS.maxCallbackLength,
  };
}

function generatePassword(macRaw, fixedKey) {
  const normalized = normalizeMac(macRaw);

  if (!normalized) return { error: "MAC アドレスを入力してください。" };
  if (normalized.length !== 12) return { error: "MAC アドレス長が不正です。" };
  if (!/^[0-9A-F]{12}$/.test(normalized)) {
    return { error: "MAC アドレスが16進数ではありません。" };
  }

  const mac16enc = normalized.substring(2, 12) + normalized.substring(6, 12);
  const fixedKeyLength = fixedKey.length;
  let password = "";

  for (let i = 0; i < mac16enc.length; i++) {
    const m = mac16enc.charCodeAt(i);
    const k = fixedKey.charCodeAt(i % fixedKeyLength);
    let p = String.fromCharCode(m | k);

    const code = p.charCodeAt(0);
    if (!/[0-9A-Za-z/_-]/.test(p) || code < 0x21 || code > 0x7e) {
      p = "_";
    }
    password += p;
  }

  return { password };
}

function normalizeMac(value) {
  if (value == null) return "";
  return String(value).replace(/[-:.\s]/g, "").toUpperCase();
}

async function logToFirebase(config, logData) {
  if (!config.firebaseDbUrl) {
    console.error("FIREBASE_DB_URL が設定されていません。");
    return;
  }

  try {
    const token = await getAccessToken(config);
    if (!token) {
      console.error("Firebase アクセストークンの取得に失敗しました。");
      return;
    }

    const url = new URL(`${config.firebaseDbUrl}/${config.logPath}.json`);
    url.searchParams.set("access_token", token);

    const response = await fetch(url.toString(), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(logData),
    });

    if (!response.ok) {
      console.error("Firebase 書き込み失敗:", await response.text());
    }
  } catch (error) {
    console.error("ログ保存中にエラーが発生しました:", error);
  }
}

async function getAccessToken(config) {
  if (!config.firebasePrivateKey || !config.firebaseClientEmail) {
    console.error("Firebase の認証情報が不足しています。");
    return null;
  }

  const pemContents = stripPem(config.firebasePrivateKey);
  const binaryDer = base64ToBytes(pemContents);

  const key = await crypto.subtle.importKey(
    "pkcs8",
    binaryDer.buffer,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const header = { alg: "RS256", typ: "JWT" };
  const now = Math.floor(Date.now() / 1000);
  const claimSet = {
    iss: config.firebaseClientEmail,
    scope: OAUTH_SCOPES.join(" "),
    aud: "https://oauth2.googleapis.com/token",
    exp: now + 3600,
    iat: now,
  };

  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedClaimSet = base64UrlEncode(JSON.stringify(claimSet));
  const signatureInput = `${encodedHeader}.${encodedClaimSet}`;
  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    key,
    new TextEncoder().encode(signatureInput)
  );

  const jwt = `${signatureInput}.${base64UrlEncode(signature)}`;

  const params = new URLSearchParams();
  params.append("grant_type", "urn:ietf:params:oauth:grant-type:jwt-bearer");
  params.append("assertion", jwt);

  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params,
  });

  const tokenData = await tokenRes.json();
  return tokenData.access_token;
}

function stripPem(pem) {
  const header = "-----BEGIN PRIVATE KEY-----";
  const footer = "-----END PRIVATE KEY-----";
  return pem
    .replace(header, "")
    .replace(footer, "")
    .replace(/\s/g, "");
}

function base64ToBytes(base64) {
  const binaryString = atob(base64);
  const length = binaryString.length;
  const bytes = new Uint8Array(length);
  for (let i = 0; i < length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

function base64UrlEncode(input) {
  let bytes;
  if (typeof input === "string") {
    bytes = new TextEncoder().encode(input);
  } else if (input instanceof ArrayBuffer) {
    bytes = new Uint8Array(input);
  } else {
    bytes = new Uint8Array(input);
  }

  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }

  return btoa(binary).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

async function extractParams(request, maxCallbackLength) {
  const url = new URL(request.url);
  const callbackRaw = url.searchParams.get("callback") || "";
  const callback = callbackRaw.replace(/[^0-9A-Za-z_.]/g, "").slice(0, maxCallbackLength);
  const via = url.searchParams.get("via") || DEFAULTS.via;

  if (request.method === "GET") {
    return { mac: url.searchParams.get("mac") || "", callback, via };
  }

  if (request.method === "POST") {
    const contentType = request.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      const body = await request.json().catch(() => ({}));
      return {
        mac: typeof body.mac === "string" ? body.mac : "",
        callback,
        via: "POST",
      };
    }
    if (contentType.includes("application/x-www-form-urlencoded")) {
      const form = await request.formData();
      const value = form.get("mac");
      return {
        mac: typeof value === "string" ? value : "",
        callback,
        via: "POST",
      };
    }
    if (contentType.includes("text/plain")) {
      const text = await request.text();
      return { mac: text.trim(), callback, via: "POST" };
    }
  }

  return { mac: "", callback, via };
}

function buildCorsResponse(allowOrigin, status) {
  return new Response(null, {
    status,
    headers: {
      "Access-Control-Allow-Origin": allowOrigin,
      "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Max-Age": "86400",
    },
  });
}

function buildJsonResponse(allowOrigin, status, payload) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      "Content-Type": "application/json; charset=UTF-8",
      "Access-Control-Allow-Origin": allowOrigin,
      "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}

function buildJsonpResponse(allowOrigin, status, callback, payload) {
  const body = `${callback}(${JSON.stringify(payload)});`;
  return new Response(body, {
    status: status >= 400 ? 200 : status,
    headers: {
      "Content-Type": "application/javascript; charset=UTF-8",
      "Cache-Control": "no-store, max-age=0",
      "Access-Control-Allow-Origin": allowOrigin,
    },
  });
}

function buildErrorResponse(allowOrigin, status, message, callback = "") {
  const payload = { error: message };
  if (callback) {
    return buildJsonpResponse(allowOrigin, status, callback, payload);
  }
  return buildJsonResponse(allowOrigin, status, payload);
}
