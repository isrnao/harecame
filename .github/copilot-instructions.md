## 共通設定
- 日本語で回答、簡潔で分かりやすく
- ベストプラクティスと学習リソースを提案
- パフォーマンスとスケーラビリティを重視

## コードレビュー指示
### 分類プレフィックス
- `[must]` - 必須（セキュリティ、バグ、重大設計問題）
- `[recommend]` - 推奨（パフォーマンス、可読性改善）
- `[nits]` - 軽微（スタイル、タイポ）

### チェック項目
1. **セキュリティ**: SQLインジェクション、XSS、認証・認可
2. **パフォーマンス**: N+1問題、メモリリーク
3. **可読性**: 命名、コメント
4. **保守性**: DRY、SOLID原則
5. **テスト**: カバレッジ、エッジケース

### 技術別ルール
#### Next.js
- App Router、SSG/SSR/ISR最適選択
- Core Web Vitals、SEO、セキュリティヘッダー
- Server/Client Components使い分け
- 環境変数（NEXT_PUBLIC_）適切使用

#### React
- コンポーネント再利用性・分離性
- パフォーマンス最適化（memo、useMemo、useCallback）
- Hooks依存配列、Error Boundaries
- 状態管理適切化

#### TypeScript
- `any`型回避、型安全性確保
- `var` → `let/const`
- async/await適切使用
