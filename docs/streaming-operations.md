# 配信運用とリリース確認

この手順は、認証・実配信・状態復旧を再設計したバージョン向けです。少人数の運用者がイベントを作り、当日の主催者へイベント限定の操作権限を渡す構成です。団体別のアカウント・請求・会員管理は含みません。

## 必要なサービス

- Next.jsを動かすNode.js 22以上の環境。配信操作は長時間のHTTP処理を含み、Route Handlerの`maxDuration`は300秒。実際の上限はホスティング環境でも確認する。
- Supabase/PostgreSQL。`supabase/migrations`を順番に適用する。anon/authenticatedはアプリのテーブルに直接アクセスできず、サーバーがアプリJWTの権限を確認してservice roleでアクセスする。
- LiveKitのRoomServiceとEgress。CloudではEgressを有効化し、セルフホストではEgressと必要なRedis等を別途用意する。RoomServiceだけではYouTubeへ送出できない。
- ライブ配信を有効化したYouTubeチャンネルと、`youtube.force-ssl`スコープのOAuthクライアント・リフレッシュトークン。APIキーだけでは作成・終了操作ができない。
- アプリを公開するHTTPSの`APP_URL`。LiveKit Egressから`/egress`を開ける必要がある。プレビューサイトの認証でこのページを遮断しない。
- 継続稼働する配信状態確認ワーカー。画面を開いていることに依存させない。

## 設定と起動

1. `.env.example`を参考に`.env.local`を設定する。`JWT_SECRET`、`ADMIN_KEY`、`RECONCILE_SECRET`にはそれぞれ別のランダム値を使う。
2. `pnpm install --frozen-lockfile`。
3. ローカルはDockerを起動し、`supabase start`、`supabase migration up --local`。既存データを消す`db reset`は不要。
4. ローカルLiveKitは`node scripts/start-local-livekit.mjs`。このスクリプトは開発専用で、127.0.0.1へバインドし、Webhookの通知先は`WORKER_APP_URL`、`APP_URL`、localhost:3000の順で決まる。ブラウザ検証時は起動時に`WORKER_APP_URL=http://127.0.0.1:3100`を指定する。
5. `pnpm preflight`で設定とSupabase・LiveKitの読み取り接続を確認する。値そのものは出力しない。このチェックはYouTubeの権限やEgressの稼働を保証するものではない。
6. `pnpm build`、`pnpm start`。開発時は`pnpm dev`。
7. 別プロセスで`pnpm worker`。15秒間隔で`POST /api/internal/reconcile`を呼ぶ。supervisor等で再起動とログ監視を設定する。代わりに同じ認証付きPOSTを外部スケジューラから定期実行してもよい。

本番マイグレーションは対象プロジェクトを確認し、通常のリリース手順で適用する。このリポジトリの実装作業では本番への適用・デプロイは行っていない。

## LiveKit Webhook

通知先は`https://<APP_URLのホスト>/api/webhooks/livekit`。署名用APIキーはアプリの`LIVEKIT_API_KEY`と対応するものを使う。

受信時はraw bodyの署名を検証し、通知IDとルーム名だけをDBへ保存する。重複通知を無視し、ワーカーが最新のLiveKit状態を照会する。過去の通知に含まれる状態をそのまま反映しないため、順序の逆転による巻き戻しを防ぐ。Webhookだけでなく定期照会も使い、稼働中の配信を再確認する。

## 当日の流れ

1. `/login`から管理者キーでログインし、イベントを作成する。この段階ではYouTube番組を作成しない。
2. 必要なら「当日の主催者用ログインコードを発行」を使う。担当者は同じログイン画面の主催者欄から入る。コードはイベント限定で12時間有効。再配布可能な認証情報なので安全な連絡手段で渡す。
3. 参加QRをカメラ担当者へ渡す。参加コードは一般視聴者向けAPIには返さない。
4. カメラ側でプレビューを確認し、「カメラを開始」。新しい接続用トークンを発行してからLiveKitへ映像と音声を送る。
5. 主催者がメインと任意の予備カメラを選択して配信を開始する。状態が「配信中」になり、YouTube側で映像・音声が届くことを別端末でも確認する。
6. 新しいカメラが参加してもメインを変えない。予備を指定した場合はメインの映像が途切れると予備へ切り替え、復旧後はメインに戻す。両方不在なら待機画面と無音になる。
7. 「配信を終了」。YouTube番組の終了、Egressの停止・完了確認、LiveKitルーム削除まで実行する。「停止中」はリソース解放の完了前であり、終了扱いにしない。
8. YouTubeのリンクから配信・アーカイブを確認する。アーカイブはYouTube側の処理・制限に従い、アプリ内の独立した録画ストレージは持たない。

## 障害と再試行

| 表示・症状 | 対応 |
| --- | --- |
| カメラ／マイクの許可待ち | ブラウザの権限と使用中のアプリを確認。15秒でタイムアウトし、遅れて取得したトラックも解放する。 |
| 再接続中 | LiveKitの再接続を待つ。切断に至った場合は「再接続」。イベント終了後の新規トークン発行は拒否する。 |
| 配信先の確認中 | Egress稼働とYouTube番組のlive状態がそろうまで待つ。カメラ接続だけでは配信中にならない。 |
| 作成結果が未確定 | 「状態を再確認」。外部APIの応答を失った場合、識別子から作成済みリソースを探す。自動的に同じものを再作成しない。 |
| 未確定のまま見つからない | LiveKit/YouTubeの管理画面で実在リソースを確認する。DBのattemptedフラグを安易に戻さない。新イベントへ切り替える前に旧リソースを停止する。 |
| 停止中が続く | ワーカーとサービス管理画面を確認する。YouTube障害時もEgress停止を試みる。片方だけの成功で完了としない。 |
| 別担当者の操作と競合 | DBの排他制御が409を返す。処理の完了を待ち、状態を再取得する。 |

外部APIとDBの間に分散トランザクションはない。開始要求とpreparing段階を同時に保存する。120秒の処理ロックは外部通信中も30秒ごとに更新し、更新に失敗した処理は以降の変更を拒否する。処理の前に「作成を試みた」記録を保存し、失敗時は照会して復旧する。作成が成功したか不明なケースは安全側に止めるため、人の確認が必要な場合がある。

ルーム用JWTは短時間有効だが、その有効期間内の再利用をDBだけでは失効できない。終了済みルームへの再参加が通知された場合もワーカーがルームを閉じる。主催者JWTは12時間の期限による失効で、個別の即時失効・本格的なアカウント管理は今後の拡張対象。

参加コードのレート制限はDBで共有する。`X-Real-IP`/`X-Forwarded-For`は識別に使用しない。プロキシが実際の接続元IPを`X-Harecame-Client-IP`へ設定し、`X-Harecame-Proxy-Secret`へアプリの`TRUSTED_PROXY_SECRET`と同じランダム値を設定する。プロキシは両ヘッダーを必ず上書きし、秘密値をクライアントへ公開しない。認証値がない・不一致・IPが不正なリクエストは全て共有バケットで制限する。公開環境ではオリジンへの直接アクセスを遮断する。管理者ログイン等の補助レート制限はプロセス内なので、公開時は入口側の制限も設定する。

## リリース前に実機で確認する項目

- iOS/SafariとAndroid/Chromeでカメラ・マイクを許可し、2台が同じイベントへ参加する。
- メインと予備の映像・音声を見分けられるようにして切り替えを確認する。選ばれていないカメラの音声が混ざらないこと。
- メインのネットワークを切り、予備へ切り替わること。両方切断時は待機画面となり、復旧後に映像が戻ること。
- 管理画面を閉じてもワーカーによる状態反映と停止処理が続くこと。
- YouTubeに実際の映像・音声が届くこと。限定公開リンクの共有範囲を運用者が確認すること。
- 終了後にLiveKit管理画面でEgressが完了し、ルームが残っていないこと。YouTube番組が終了していること。
- 実配信のアーカイブ再生と、利用時間・転送量・課金明細を確認する。

自動テストはこの実機・実サービス確認の代替ではない。検証環境にYouTubeのOAuth設定とEgressがそろってから、少人数の有料実証へ進む。

## 参考

- [Next.js 15: Data Security](https://nextjs.org/docs/15/app/guides/data-security)
- [LiveKit: Egress](https://docs.livekit.io/transport/media/ingress-egress/egress/)
- [LiveKit: Custom recording templates](https://docs.livekit.io/transport/media/ingress-egress/egress/custom-template/)
- [YouTube: liveStreams.insert](https://developers.google.com/youtube/v3/live/docs/liveStreams/insert)
- [YouTube: liveBroadcasts.transition](https://developers.google.com/youtube/v3/live/docs/liveBroadcasts/transition)
