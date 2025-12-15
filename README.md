# パスワード生成ツール

MAC アドレスからパスワードを生成する Google Apps Script/Cloudflare Worker/静的 HTML のセットです。

## Google Apps Script (GAS)
- `GAS_code.gs` を Web アプリとしてデプロイすると、MAC アドレスを受け取りパスワードを返します。
- 通常のリクエストは `/exec?mac=<MAC>` または POST で受け付けます。

### 管理者向けエンドポイント（非公開）
- `doGet` の `/admin` クエリは管理用です。一般利用のフロントや README 以外には露出させません。
- トークン（`token` クエリ）または許可 IP で認証します。
  - `ADMIN_TOKEN`・`ADMIN_ALLOWED_IPS` はスクリプトプロパティで設定してください。
  - `SPREADSHEET_ID` にはログ保存先スプレッドシートの ID を設定します。
- 取得パラメータ
  - `from`/`to`: 期間指定（`YYYY-MM-DD` など `Date` 変換可能な文字列）。
  - `mac`: MAC フィルタ（区切り無し 12 桁で比較）。
  - `format`: `json`（既定）または `csv`。CSV は `Content-Disposition` が付与されダウンロードできます。
- 返却値
  - JSON: `{"logs": [{timestamp, mac, password, via}, ...]}`
  - CSV: ヘッダー行付きの CSV ファイルを返します。

> 管理用ルートの URL やトークンは管理者のみで共有し、一般利用者には知らせない運用としてください。
