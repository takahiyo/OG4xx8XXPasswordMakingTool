// config.js
export const DEFAULTS = {
  allowOrigin: "*",
  environment: "unknown",
  via: "API",
  maxCallbackLength: 100,
  adminPath: "/admin",
  adminTokenQueryKey: "token",
  fixedKey: "", // 環境変数がない場合のフォールバック（基本は空）
};
