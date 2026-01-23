# D1で保存されているデータの確認方法

このドキュメントは `request_logs` テーブルに保存されたデータを確認するための手順です。

## 事前準備

1. `wrangler` がインストール済みであること。
2. `wrangler.toml` の `database_name` が正しいこと。

## 確認手順

### 1. 最新のログを取得する

`wrangler.toml` の `database_name` を参照し、次のコマンドを実行します。

```bash
wrangler d1 execute <database_name> --command "SELECT * FROM request_logs ORDER BY id DESC LIMIT 20"
```

### 2. 条件を絞り込んで確認する

特定のMACアドレスだけを確認したい場合は、次のように絞り込みます。

```bash
wrangler d1 execute <database_name> --command "SELECT * FROM request_logs WHERE mac = '<MACアドレス>' ORDER BY id DESC"
```

### 3. テーブル構造を確認する

テーブルのスキーマを確認する場合は、次のコマンドを実行します。

```bash
wrangler d1 execute <database_name> --command "PRAGMA table_info(request_logs)"
```
