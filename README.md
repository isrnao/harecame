# Harecame（ハレカメ）

スマートフォンを持ち寄り、地域のスポーツ大会や行事を配信するWebアプリケーションです。運用者がイベントを作成し、撮影者がQRコードから参加し、主催者が使用するカメラを選んでYouTubeへ配信します。

**顧客検証前のプロジェクトです。** イベント管理・カメラ送信・配信制御を実装していますが、有料運用へ進む前に、YouTubeとEgressを接続した通し配信、実際のスマートフォン、会場回線、課金を確認してください。自動テストの成功と、本番配信の成功は区別しています。

## 目次

- [できることと制約](#できることと制約)
- [構成と設計方針](#構成と設計方針)
- [必要な環境](#必要な環境)
- [セットアップ](#セットアップ)
- [環境変数](#環境変数)
- [画面と使い方](#画面と使い方)
- [API](#api)
- [認証とデータ保護](#認証とデータ保護)
- [データベース](#データベース)
- [ディレクトリ](#ディレクトリ)
- [コマンドと検証](#コマンドと検証)
- [配備・運用・トラブル対応](#配備運用トラブル対応)
- [事業検証と関連資料](#事業検証と関連資料)

## できることと制約

| 領域 | 実装 | 制約・確認事項 |
| --- | --- | --- |
| イベント管理 | 作成、一覧、詳細、更新、削除。APIとServer Actionsが同じ権限確認を使う | 作成は管理者のみ。配信制御を開始したイベントは履歴保持のため削除不可 |
| 当日の引き継ぎ | イベント限定・12時間有効の主催者ログインコード | 個別アカウント、招待メール、自動課金、即時失効は未実装 |
| カメラ参加 | 6文字の参加コード、QR生成、ダウンロード、参加URLのコピー | 同時に接続・接続待ちにできるカメラは最大10台 |
| カメラ送信 | ローカルプレビュー、映像・音声の送信、ミュート、停止、再接続 | ブラウザと会場回線に依存。実機互換性は別途確認 |
| 配信操作 | 主催者による開始・終了、メイン／予備カメラ指定、状態再確認 | YouTube OAuth、LiveKit Egress、公開HTTPS URLが必要 |
| カメラ切り替え | 選ばれたカメラの映像・音声だけを合成。明示した予備への切り替え | 新規参加者へ自動で切り替えない。両方不在時は待機画面・無音 |
| 状態復旧 | DBへの操作記録、排他制御、署名付きWebhook、定期照会、重複作成の抑制 | 外部APIの成功が未確定の場合、人の確認が必要なことがある |
| 視聴 | YouTube埋め込み、ライブチャット、配信状態表示、YouTubeへのリンク | 限定公開リンクはURLを知る人が視聴可能。会員限定配信ではない |
| アーカイブ | YouTubeの配信・アーカイブURLを利用 | 独立した録画ストレージやダウンロード保証はない |
| 分析・エラー | Web Vitalsとエラー受付、Error Boundary | 分析基盤・外部通知は未実装。分析GET APIは架空の数値を返さず501 |
| モバイル | レスポンシブ画面、Manifest | オフライン配信やバックグラウンド撮影を保証しない。Service Workerはない |

## 構成と設計方針

同じリポジトリのNext.jsアプリ内で、画面、業務処理、DB・外部サービスの役割を分けています。

```text
主催者の画面 ─ API / Server Actions ─ server/access.ts（権限確認）
                                      │
                                      ├─ events.ts / cameras.ts ─ Supabase
                                      │
                                      └─ streaming.ts ─ stream-controller.ts
                                            │                 │
                                            ├─ LiveKit Egress └─ YouTube API
                                            └─ stream_sessions（処理状態・排他制御）

スマホ ─ LiveKit Room ─ /egress（映像・音声の選択）─ YouTube
              │
              └─ 署名付きWebhook ─ DB ─ 定期ワーカー ─ 状態の再照会
```

- `src/server`が認証付きの業務処理と外部サービスを担当します。APIとServer Actionsに処理を重複させません。
- DBと秘密情報を扱うモジュールには`server-only`を付けています。ブラウザ用LiveKitクライアントからサーバーSDKを読み込みません。
- カメラ側のメディア取得・接続・解放は`useCameraSession`にまとめています。
- カメラ接続とYouTube配信成功を区別します。LiveKit Egressが稼働し、YouTubeがlive状態になって初めて「配信中」と判定します。
- 配信の希望状態と観測状態をDBに保存し、画面を閉じてもワーカーで処理を継続します。
- 外部リソースを作成する前に試行を記録し、応答が失われた場合は既存リソースを照会します。未確定のまま再作成しません。
- カメラと管理画面はHTTPで状態を取得します。以前のハートビートだけのSSE APIは410を返します。

## 必要な環境

| 分類 | 使用技術 |
| --- | --- |
| ランタイム | Node.js 22以上、pnpm 10.13.1 |
| Web | Next.js 15.5系、React 19.1系、TypeScript |
| UI | Tailwind CSS 4、Radix UI、React Hook Form、Zod |
| DB | Supabase / PostgreSQL。ローカル設定はPostgreSQL 17 |
| 映像 | LiveKit Client・Server SDK、Egress Template SDK |
| 外部配信 | YouTube Live Streaming API、OAuth 2.0 |
| テスト | Jest / Testing Library、Node.js test runner、PGlite、Playwright |

正確な依存バージョンは`package.json`と`pnpm-lock.yaml`を参照してください。

## セットアップ

```bash
pnpm install --frozen-lockfile
cp .env.example .env.local
```

`.env.local`に実際の設定を記入します。秘密情報をGitへ追加しないでください。

ローカルDBはDockerとSupabase CLIを用意して起動します。

```bash
supabase start
supabase migration up --local
```

`supabase start`の出力にローカルのAPI URLとキーが表示されます。これを環境変数に設定してください。既存の検証DBがある場合はデータを保持してマイグレーションを適用します。

開発用の`livekit-server`をインストール済みなら、別ターミナルで起動できます。

```bash
node scripts/start-local-livekit.mjs
pnpm preflight
pnpm dev
```

`start-local-livekit.mjs`はポート7880のローカル検証用です。Egressは起動しません。通常の`pnpm dev`はポート3000ですが、この検証スクリプトのWebhook通知先はブラウザテストに合わせたポート3100です。通常の配信開発・本番では通知先を実際のアプリURLへ設定してください。

YouTubeへの配信を動かす場合は、Egressからアクセスできる公開HTTPSの`APP_URL`とYouTube OAuthを設定し、別プロセスでワーカーを起動します。

```bash
pnpm worker
```

## 環境変数

| 変数 | 用途 |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase API URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | 公開キー。アプリの直接DBアクセス権限を与えるものではない |
| `SUPABASE_SERVICE_ROLE_KEY` | サーバー専用DBアクセスキー |
| `DATABASE_URL` | CLI等で使うDB接続先。ブラウザには渡さない |
| `NEXT_PUBLIC_LIVEKIT_URL` | ブラウザのLiveKit接続先。公開環境は`wss://` |
| `LIVEKIT_API_KEY` / `LIVEKIT_API_SECRET` | トークン発行・サーバーAPI・Webhook検証 |
| `JWT_SECRET` | アプリJWT署名用。推測困難な長いランダム値を設定 |
| `ADMIN_KEY` | 運用管理者のログインキー |
| `APP_URL` | Egressから到達できるアプリの公開HTTPSオリジン |
| `YOUTUBE_CLIENT_ID` / `YOUTUBE_CLIENT_SECRET` | YouTube OAuthクライアント |
| `YOUTUBE_REFRESH_TOKEN` | 配信対象チャンネルの更新用トークン。`youtube.force-ssl`スコープが必要 |
| `RECONCILE_SECRET` | 定期ワーカーのAPI認証。管理者キーと別の値にする |
| `WORKER_APP_URL` | 任意。ワーカーからアプリへ接続する内部URL |

未設定のサービスをモック成功に置き換えません。イベント作成自体はYouTubeに依存しませんが、配信開始には各サービスの設定が必要です。

## 画面と使い方

| URL | 利用者・役割 |
| --- | --- |
| `/` | サービスの入口 |
| `/login` | 管理者キーまたは主催者用コードでログイン |
| `/events` | 権限のあるイベントを一覧表示 |
| `/events/create` | 管理者によるイベント作成 |
| `/events/[eventId]/dashboard` | 状態確認、参加QR、カメラ選択、開始・終了、担当者コード発行 |
| `/camera` | カメラ参加画面への入口 |
| `/camera/join?code=ABC123` | 参加コードでカメラとして参加 |
| `/camera/[eventId]` | プレビュー、映像・音声の送信、停止・再接続 |
| `/watch/[eventId]` | 視聴者向けYouTubeプレーヤーとチャット |
| `/egress` | LiveKitの録画・送出ブラウザが読み込む専用ページ |

基本の流れは「管理者ログイン → イベント作成 → QR共有 → カメラの送信開始 → 主催者がメインと予備を選択 → 配信開始 → YouTubeで確認 → 配信終了」です。

## API

通常の成功応答は`{ "success": true, "data": ... }`、失敗応答は`{ "success": false, "error": "..." }`です。未認証401、権限不足403、競合409、レート制限429、サービス未設定・利用不可503を区別します。

| エンドポイント | メソッド | 用途・権限 |
| --- | --- | --- |
| `/api/auth/admin` | POST / DELETE | 管理者ログイン／Cookieの削除 |
| `/api/auth/organizer` | POST | 署名済みイベント限定コードをCookieセッションにする |
| `/api/events` | GET / POST | 許可されたイベント一覧／管理者による作成 |
| `/api/events/[eventId]` | GET | 公開イベント情報。`include_cameras=true`または`include_status=true`を付けると主催者権限が必要 |
| 同上 | PUT / DELETE | 当該イベントの主催者または管理者による更新・削除 |
| `/api/events/[eventId]/organizer-token` | POST | 管理者による12時間有効の主催者コード発行 |
| `/api/events/validate-code` | POST | コードを検証し、サーバー生成の参加者IDとカメラ用アプリJWTを発行 |
| `/api/events/[eventId]/join` | POST | カメラJWTを検証し、参加枠と短時間のLiveKitトークンを取得。再試行は同じ参加者を再利用 |
| `/api/events/[eventId]/cameras` | GET | 主催者向けカメラ一覧 |
| `/api/events/[eventId]/cameras/[cameraId]/status` | PUT | 自分のカメラの補助情報を更新。接続状態そのものは上書きしない |
| `/api/events/[eventId]/status` | GET | 公開配信状態。90秒以上更新がない場合は配信中と断定しない |
| 同上 | PUT | 廃止。405。配信状態を直接代入せずcontrol APIを使う |
| `/api/events/[eventId]/control` | GET / POST | 主催者向け制御状態／配信操作 |
| `/api/events/[eventId]/stream` | GET | 旧SSE。410。status APIへ移行 |
| `/api/webhooks/livekit` | POST | LiveKitの署名付き通知を永続化 |
| `/api/internal/reconcile` | POST | ワーカー用。`Bearer RECONCILE_SECRET`が必要 |
| `/api/health` | GET / HEAD | アプリプロセスの生存確認。外部サービスの稼働保証ではない |
| `/api/analytics/events/[eventId]` | GET | 未実装。501 |
| `/api/analytics/performance` | POST / GET | 指標受付／分析未実装のためGETは501 |
| `/api/analytics/interactions` | POST | 操作イベント受付 |
| `/api/errors` | POST | エラー受付 |
| `/api/docs` | GET | 旧API資料は廃止。410。現在の契約はこのREADMEを参照 |

配信操作のリクエスト例:

```json
{ "action": "start", "cameraId": "カメラのUUID", "fallbackCameraId": null }
```

```json
{ "action": "select", "cameraId": "切り替え先のUUID", "fallbackCameraId": "予備カメラのUUID" }
```

```json
{ "action": "reconcile" }
```

```json
{ "action": "stop" }
```

開始・切り替え・終了のHTTP成功だけでYouTubeへの到達やリソース解放を判断せず、返された状態を確認してください。

## 認証とデータ保護

- 管理者は全イベントを管理し、主催者はJWTに署名されたイベントだけを操作できます。
- ブラウザの管理セッションはHttpOnly Cookieを使います。本番ではSecure、SameSite=Strictを設定します。Server Actionsもサーバー側で確認します。
- カメラ用アプリJWTとLiveKit接続JWTは用途・署名鍵・権限が異なります。LiveKit JWTでアプリを操作することはできません。
- カメラの参加者IDはサーバーで生成し、再接続でも署名済みのIDを使います。他のカメラIDを指定した補助情報の更新は拒否します。
- 公開イベント情報は許可した項目だけを返し、参加コード・配信キー・内部ルーム名を含めません。
- DBはRLSとテーブル権限でanon/authenticatedの直接操作を禁止します。service roleはRLSを迂回するため、サーバーの権限確認とセットで運用します。
- クロスオリジンの変更要求を拒否します。ログへAuthorization/CookieやURLのクエリを出しません。
- カメラ参加コードの試行数はDBで共有します。プロキシの接続元ヘッダーの扱いは[運用手順](docs/streaming-operations.md)を確認してください。

## データベース

| テーブル | 内容 |
| --- | --- |
| `events` | イベント、参加コード、LiveKitルーム名、YouTube URL |
| `camera_connections` | カメラの参加者ID、接続・映像状態、端末補助情報 |
| `stream_status` | 視聴・管理画面向けの観測結果 |
| `event_logs` | イベントに関連する補助ログ |
| `stream_sessions` | 希望状態、処理段階、選択カメラ、非公開の送出先、外部作成の試行記録、処理ロック |
| `provider_notifications` | LiveKit通知のID、ルーム、受信・処理日時 |
| `admission_limits` | 参加試行数と有効期限。接続元はハッシュ化して保存 |

SQL関数は、状態の部分更新、イベント単位の排他制御、10台制限を含むカメラ参加、参加コードの共有レート制限を担当します。状態の一部だけを更新して他の値を初期値へ戻すことを避けています。

**スキーマの正本は`supabase/migrations`です。** `database/schema.sql`は初期スキーマの資料であり、単独で適用すると現在の構成になりません。`database-init.ts`の旧初期化ヘルパーも現在のセットアップ手順には使用しません。

## ディレクトリ

```text
src/app/                 ページ、API、Server Actions
src/components/          イベント管理・カメラ・視聴・共通UI
src/hooks/               カメラライフサイクル、画面のデータ取得等
src/server/              認証、業務処理、配信制御、外部サービス
src/lib/                 DB変換、JWT、入力検証、クライアント補助
src/types/               共通型
supabase/migrations/     適用順序を持つDB変更
supabase/seed.sql        ローカルの初期データ
scripts/                 起動前確認、ワーカー、ブラウザ検証
src/**/__tests__/        Jestのコンポーネント・業務ロジックテスト
tests/server/            実JWT・Webhook署名・PostgreSQLのテスト
docs/                    運用・事業検証資料
.github/workflows/       PRの自動検証
```

## コマンドと検証

| コマンド | 内容 |
| --- | --- |
| `pnpm dev` | 開発サーバー |
| `pnpm build` / `pnpm start` | 本番ビルド／起動 |
| `pnpm type-check` | TypeScriptの検証 |
| `pnpm lint` | ESLint |
| `pnpm test --runInBand --watchman=false` | Jest。`test:watch`、`test:coverage`も利用可能 |
| `pnpm test:server` | Node.js上の実署名検証とPGlite上のPostgreSQLテスト |
| `pnpm preflight` | 環境変数の有無とSupabase・LiveKitの読み取り接続 |
| `pnpm worker` | 状態確認ワーカーを継続稼働 |
| `node scripts/browser-smoke.mjs` | ローカルSupabase・LiveKitを使う実ブラウザ検証。生成した映像・音声を使用 |
| `pnpm verify:static-routes` | 実際のビルド出力で私的なページが静的生成されていないか確認 |
| `pnpm check:static-config` | 認証が必要なページのdynamic設定を確認 |
| `pnpm build:analyze` / `pnpm perf:bundle-analyzer` | バンドル解析用 |
| `pnpm perf:build-size` | ビルドサイズの確認 |
| `pnpm perf:lighthouse` | 開発サーバーに対するLighthouse。CLIを別途用意する |

ブラウザ検証には`pnpm exec playwright install chromium`が必要です。検証は一時的な管理者キーを使ってポート3100にNext.jsを起動し、その実行で作ったイベントを終了時に削除します。既存イベントは変更しません。スマートフォンの実機カメラや本番YouTube送出を代替するものではありません。

テストでは、匿名・別イベント・他カメラの権限、署名の改ざん、公開データ、部分更新、接続枠、排他制御、外部作成の応答喪失、停止の再試行、カメラの取得・解放などを確認します。テスト専用のDBエンジンとプロバイダー差し替えは本番コードのモック成功とは分けています。

## 配備・運用・トラブル対応

[配信運用とリリース確認](docs/streaming-operations.md)に、サービスの設定、ワーカーの実行、障害復旧、実機での受け入れ確認をまとめています。

特に、Egressの到達可能なURL、Webhookの署名設定、常時稼働するワーカー、終了後のリソース確認が必要です。ワーカーが停止すると、画面の操作だけでは配信状態を継続的に確認できません。

| 症状 | 最初に確認すること |
| --- | --- |
| 管理者ログイン不可 | `ADMIN_KEY`、Cookie、HTTPS、本番の`JWT_SECRET` |
| 参加コードで入れない | コード、イベント終了状態、10台制限、共有レート制限、マイグレーション |
| カメラが起動しない | ブラウザ権限、HTTPSまたはlocalhost、他アプリの使用状況 |
| カメラ接続後も配信されない | 主催者の開始操作、YouTube OAuth、Egress、`APP_URL` |
| 状態が更新されない | ワーカー、Webhook通知先、DB、LiveKit読み取り接続 |
| 作成結果が未確定 | 同じ配信を再作成せず、サービス管理画面と状態再確認を使う |
| 停止中が続く | YouTubeとEgressの両方を確認。配信出力が残っていないか確認 |

## 事業検証と関連資料

目標は少人数で継続的に利益を出す運営です。地域の大会主催者などに対象を絞り、少数の有料実証で再利用意向と当日の支援時間を確認する前提です。

- [将来性・グロース戦略・損益分岐点](docs/business-growth-strategy.md)
- [配信運用とリリース確認](docs/streaming-operations.md)
- [今回の検証結果](docs/verification.md)
- [Next.jsのデータ保護](https://nextjs.org/docs/15/app/guides/data-security)
- [LiveKitのカスタム配信テンプレート](https://docs.livekit.io/transport/media/ingress-egress/egress/custom-template/)

`package.json`は`private: true`です。リポジトリには利用許諾を定めるLICENSEファイルがないため、公開・再配布時のライセンス方針は別途決定してください。
