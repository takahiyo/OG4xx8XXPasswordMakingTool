OG4xx/OG8xx パスワード生成ツールOG4xx/OG8xx シリーズ（VoIPゲートウェイ）のMACアドレスから、保守用パスワードを生成するWebツールです。バックエンドにCloudflare Workers、ログ保存にCloudflare D1を使用しており、生成履歴をデータベースに記録します。📋 機能概要パスワード生成: MACアドレスを入力し、特定のアルゴリズムに基づいたパスワードを生成・表示。バリデーション: MACアドレスの形式チェック（正規化、長さ、文字種）。ログ保存: 生成リクエスト（日時、MACアドレス、生成パスワード）をCloudflare D1へ保存。Silent Save: データベース保存に失敗しても、ユーザー側のパスワード生成処理は中断させず、エラーを表示しません。開発環境分離: dev ブランチと main ブランチで、デプロイ先のWorker環境を自動で切り分け。🛠 技術スタックFrontend: HTML5, CSS3, Vanilla JavaScriptBackend: Cloudflare WorkersDatabase: Cloudflare D1 (SQLite)CI/CD: GitHub ActionsIaC: Wrangler (wrangler.toml)📂 ディレクトリ構成.
├── .github/workflows
│   └── deploy.yml      # 自動デプロイ用ワークフロー
├── migrations
│   └── 001_create_request_logs.sql # D1テーブル作成用SQL
├── src
│   └── worker.js       # バックエンドロジック (API & DB処理)
├── config.js           # フロントエンド設定 (APIエンドポイント等)
├── index.html          # ツールUI
├── script.js           # フロントエンドロジック
├── style.css           # デザイン
└── wrangler.toml       # Cloudflare Workers設定
🚀 セットアップ & 開発前提条件Node.js がインストールされていることCloudflare アカウントを持っていることWrangler CLI がインストールされていること1. データベースの準備Cloudflare D1 データベースを作成し、スキーマを適用します。# データベース作成 (未作成の場合)
npx wrangler d1 create og4xx8xxpassword_db

# テーブル作成
npx wrangler d1 execute og4xx8xxpassword_db --file=./migrations/001_create_request_logs.sql
2. ローカル開発Workerをローカルで起動し、フロントエンドから接続します。# Workerの起動
npx wrangler dev
※ config.js の API_ENDPOINT をローカルのURL（例: http://localhost:8787/）に変更してテストしてください。💾 データベース構造 (D1)request_logs テーブル:カラム名型説明idINTEGERプライマリキー (AUTOINCREMENT)timestampTEXT生成日時 (ISO8601)macTEXT正規化されたMACアドレスpasswordTEXT生成されたパスワードviaTEXTリクエスト経由 (GET/POST/DebugMode)🔄 デプロイ (CI/CD)GitHub Actionsにより、ブランチに応じた環境へ自動デプロイされます。dev ブランチへのPush:開発用Worker (og4xx8xxpasswordmakingtool-dev) へデプロイmain ブランチへのPush:本番用Worker (og4xx8xxpasswordmakingtool) へデプロイ必要なGitHub Secretsリポジトリの Settings > Secrets and variables > Actions に以下を設定してください。Secret名内容CLOUDFLARE_ACCOUNT_IDCloudflareのアカウントIDCLOUDFLARE_API_TOKENWorkers/D1権限を持つAPIトークン🔍 ログ確認方法Cloudflareダッシュボード、または以下のコマンドで保存されたログを確認できます。npx wrangler d1 execute og4xx8xxpassword_db --command "SELECT * FROM request_logs ORDER BY id DESC LIMIT 10"
