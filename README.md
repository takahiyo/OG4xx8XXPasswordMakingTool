# パスワード生成ツール

MAC アドレスからパスワードを生成する Cloudflare Workers と静的 HTML のセットです。

## Cloudflare Workers
- `src/index.js` がパスワード生成と Firebase Realtime Database へのログ保存を担います。
- 通常のリクエストは `GET /?mac=<MAC>` または `POST` で受け付けます。

### 設定 (wrangler.toml)
- `FIXED_KEY` はパスワード生成用の固定キーです。
- `FIREBASE_DB_URL` は Realtime Database の URL を指定します。
- `FIREBASE_LOG_PATH` はログの保存先パスを指定します。
- `LOG_CACHE_KEY` はログキャッシュのキー名です。
- `ADMIN_PATH` は管理者ログ取得エンドポイントのパスです。
- `ADMIN_TOKEN_QUERY_KEY` は管理者トークンのクエリキー名です。
- `LOG_CACHE_TTL_SECONDS` はキャッシュの TTL(秒) です。未設定なら無期限キャッシュになります。

### KV キャッシュ
ログ閲覧用のキャッシュに Cloudflare KV を利用します。Namespace を作成し、`LOG_CACHE` としてバインドしてください。

```
npx wrangler kv:namespace create LOG_CACHE
npx wrangler kv:namespace create LOG_CACHE --env dev
```

### Secrets (wrangler secret)
秘密情報は `wrangler secret` で設定してください。

```
npx wrangler secret put FIREBASE_CLIENT_EMAIL
npx wrangler secret put FIREBASE_PRIVATE_KEY
npx wrangler secret put ADMIN_TOKEN
```

### 環境分離
`wrangler.toml` の `env.production` と `env.dev` で環境を分離しています。開発環境へデプロイする場合は `--env dev` を指定してください。

```
npx wrangler deploy --env dev
```

### フロントエンドの接続先
`index.html` のエンドポイントが Workers の URL を指しているか確認してください。

### 管理者ログ取得 API
`GET /admin?token=...` でログを取得します。初回は Firebase から取得し、以降は KV キャッシュを返します。
