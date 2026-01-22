# パスワード生成ツール

MAC アドレスからパスワードを生成する Cloudflare Workers と静的 HTML のセットです。

## Cloudflare Workers
- `src/index.js` がパスワード生成と Firebase Realtime Database へのログ保存を担います。
- 通常のリクエストは `GET /?mac=<MAC>` または `POST` で受け付けます。

### 設定 (wrangler.toml)
- `FIXED_KEY` はパスワード生成用の固定キーです。
- `FIREBASE_DB_URL` は Realtime Database の URL を指定します。
- `FIREBASE_LOG_PATH` はログの保存先パスを指定します。

### Secrets (wrangler secret)
秘密情報は `wrangler secret` で設定してください。

```
npx wrangler secret put FIREBASE_CLIENT_EMAIL
npx wrangler secret put FIREBASE_PRIVATE_KEY
```

### 環境分離
`wrangler.toml` の `env.production` と `env.dev` で環境を分離しています。開発環境へデプロイする場合は `--env dev` を指定してください。

```
npx wrangler deploy --env dev
```

### フロントエンドの接続先
`index.html` のエンドポイントが Workers の URL を指しているか確認してください。
