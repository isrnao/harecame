# React 19/Next.js 15 コードレビューガイドライン

## 概要

このガイドラインは、React 19とNext.js 15のベストプラクティスに基づいたコードレビューの指針を提供します。useEffectの不適切な使用や、新機能の活用不足を早期に発見し、コード品質を向上させることを目的としています。

## useEffect関連のチェックポイント

### 🔴 Critical Issues（必ず修正）

#### 1. 派生状態の不適切な管理
```typescript
// ❌ 問題のあるコード
function UserProfile({ firstName, lastName }) {
  const [fullName, setFullName] = useState('');

  useEffect(() => {
    setFullName(firstName + ' ' + lastName);
  }, [firstName, lastName]);

  return <div>{fullName}</div>;
}

// ✅ 修正後
function UserProfile({ firstName, lastName }) {
  const fullName = firstName + ' ' + lastName;
  return <div>{fullName}</div>;
}
```

**レビューポイント:**
- useEffectで状態を設定している箇所を特定
- レンダリング中に計算可能かどうかを確認
- 高価な計算の場合はuseMemoの使用を提案

#### 2. イベントハンドラーロジックの誤配置
```typescript
// ❌ 問題のあるコード
function Counter() {
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (count > 10) {
      showNotification('Count exceeded!');
    }
  }, [count]);

  return <button onClick={() => setCount(c => c + 1)}>Count: {count}</button>;
}

// ✅ 修正後
function Counter() {
  const [count, setCount] = useState(0);

  const handleIncrement = () => {
    const newCount = count + 1;
    setCount(newCount);

    if (newCount > 10) {
      showNotification('Count exceeded!');
    }
  };

  return <button onClick={handleIncrement}>Count: {count}</button>;
}
```

**レビューポイント:**
- useEffect内でイベント固有のロジックを処理していないか
- ユーザーアクションに応じた処理がuseEffectに含まれていないか

#### 3. props変更による不適切な状態リセット
```typescript
// ❌ 問題のあるコード
function UserForm({ userId }) {
  const [name, setName] = useState('');

  useEffect(() => {
    setName('');
  }, [userId]);

  return <input value={name} onChange={(e) => setName(e.target.value)} />;
}

// ✅ 修正後（keyプロパティ使用）
function UserForm({ userId }) {
  const [name, setName] = useState('');

  return (
    <input
      key={userId}
      value={name}
      onChange={(e) => setName(e.target.value)}
    />
  );
}
```

**レビューポイント:**
- propsの変更でuseEffectが実行されていないか
- keyプロパティでの再作成が適切かどうか

### 🟡 Warning Issues（改善推奨）

#### 1. 計算チェーンの非効率性
```typescript
// ❌ 非効率なコード
function Dashboard({ data }) {
  const [processedData, setProcessedData] = useState([]);
  const [summary, setSummary] = useState({});

  useEffect(() => {
    setProcessedData(processData(data));
  }, [data]);

  useEffect(() => {
    setSummary(calculateSummary(processedData));
  }, [processedData]);

  return <div>{/* レンダリング */}</div>;
}

// ✅ 改善後
function Dashboard({ data }) {
  const processedData = useMemo(() => processData(data), [data]);
  const summary = useMemo(() => calculateSummary(processedData), [processedData]);

  return <div>{/* レンダリング */}</div>;
}
```

**レビューポイント:**
- 複数のuseEffectが連鎖的に実行されていないか
- useMemoやuseReducerでの最適化が可能か

#### 2. 外部システム同期の改善余地
```typescript
// ❌ 改善の余地があるコード
function useLocalStorage(key) {
  const [value, setValue] = useState(null);

  useEffect(() => {
    const handleStorageChange = () => {
      setValue(localStorage.getItem(key));
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, [key]);

  return value;
}

// ✅ 改善後
function useLocalStorage(key) {
  return useSyncExternalStore(
    (callback) => {
      const handleStorageChange = () => callback();
      window.addEventListener('storage', handleStorageChange);
      return () => window.removeEventListener('storage', handleStorageChange);
    },
    () => localStorage.getItem(key),
    () => null
  );
}
```

**レビューポイント:**
- useSyncExternalStoreの使用が適切か
- 外部ストアとの同期が効率的に実装されているか

## React 19新機能の活用チェック

### Server Actions & useActionState

#### チェックポイント
```typescript
// ❌ 従来のフォーム処理
function ContactForm() {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setPending(true);
    setError('');

    try {
      const formData = new FormData(e.target);
      await submitContact(formData);
    } catch (err) {
      setError(err.message);
    } finally {
      setPending(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      {/* フォーム要素 */}
      {error && <p className="error">{error}</p>}
      <button disabled={pending}>
        {pending ? 'Sending...' : 'Send'}
      </button>
    </form>
  );
}

// ✅ React 19のuseActionState使用
function ContactForm() {
  const [state, formAction, pending] = useActionState(submitContact, null);

  return (
    <form action={formAction}>
      {/* フォーム要素 */}
      {state?.error && <p className="error">{state.error}</p>}
      <button disabled={pending}>
        {pending ? 'Sending...' : 'Send'}
      </button>
    </form>
  );
}
```

**レビューポイント:**
- フォーム処理でuseActionStateを使用しているか
- 手動でpending状態やエラーハンドリングを管理していないか
- Server Actionsが適切に定義されているか

### useOptimistic

#### チェックポイント
```typescript
// ❌ 従来の楽観的更新
function LikeButton({ postId, initialLikes, initialIsLiked }) {
  const [likes, setLikes] = useState(initialLikes);
  const [isLiked, setIsLiked] = useState(initialIsLiked);
  const [isLoading, setIsLoading] = useState(false);

  const handleToggleLike = async () => {
    setIsLoading(true);
    const newIsLiked = !isLiked;

    // 楽観的更新
    setIsLiked(newIsLiked);
    setLikes(prev => newIsLiked ? prev + 1 : prev - 1);

    try {
      await toggleLike(postId, newIsLiked);
    } catch (error) {
      // ロールバック
      setIsLiked(!newIsLiked);
      setLikes(prev => newIsLiked ? prev - 1 : prev + 1);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <button onClick={handleToggleLike} disabled={isLoading}>
      {isLiked ? '❤️' : '🤍'} {likes}
    </button>
  );
}

// ✅ useOptimistic使用
function LikeButton({ postId, initialLikes, initialIsLiked }) {
  const [optimisticState, addOptimistic] = useOptimistic(
    { likes: initialLikes, isLiked: initialIsLiked },
    (state, newIsLiked) => ({
      likes: newIsLiked ? state.likes + 1 : state.likes - 1,
      isLiked: newIsLiked
    })
  );

  const handleToggleLike = async () => {
    addOptimistic(!optimisticState.isLiked);
    await toggleLike(postId, !optimisticState.isLiked);
  };

  return (
    <button onClick={handleToggleLike}>
      {optimisticState.isLiked ? '❤️' : '🤍'} {optimisticState.likes}
    </button>
  );
}
```

**レビューポイント:**
- 楽観的更新でuseOptimisticを使用しているか
- 手動でロールバック処理を実装していないか

## Next.js 15新機能の活用チェック

### Async Request APIs

#### チェックポイント
```typescript
// ❌ 同期呼び出し（非推奨）
export default function Page() {
  const cookieStore = cookies(); // 警告が出る
  const headersList = headers(); // 警告が出る

  return <div>Content</div>;
}

// ✅ 非同期呼び出し
export default async function Page() {
  const cookieStore = await cookies();
  const headersList = await headers();

  return <div>Content</div>;
}
```

**レビューポイント:**
- cookies()、headers()を同期的に呼び出していないか
- paramsやsearchParamsをawaitしているか
- TypeScript警告が出ていないか

### after() API

#### チェックポイント
```typescript
// ❌ レスポンス前に重い処理
export async function POST(request) {
  const data = await request.json();
  const result = await processData(data);

  // 重い処理がレスポンスを遅らせる
  await sendNotifications(result);
  await updateAnalytics(result);
  await cleanupTempFiles();

  return NextResponse.json({ result });
}

// ✅ after()で応答後処理
export async function POST(request) {
  const data = await request.json();
  const result = await processData(data);

  // レスポンス送信後に実行
  after(async () => {
    await sendNotifications(result);
    await updateAnalytics(result);
    await cleanupTempFiles();
  });

  return NextResponse.json({ result });
}
```

**レビューポイント:**
- レスポンス時間に影響しない処理をafter()で実行しているか
- ログ記録や分析処理が適切に分離されているか

### Form コンポーネント

#### チェックポイント
```typescript
// ❌ 通常のform要素
function SearchForm() {
  return (
    <form action="/search" method="GET">
      <input name="q" placeholder="検索..." />
      <button type="submit">検索</button>
    </form>
  );
}

// ✅ Next.js 15のFormコンポーネント
import Form from 'next/form';

function SearchForm() {
  return (
    <Form action="/search">
      <input name="q" placeholder="検索..." />
      <button type="submit">検索</button>
    </Form>
  );
}
```

**レビューポイント:**
- フォーム送信でFormコンポーネントを使用しているか
- クライアントサイドナビゲーションが最適化されているか

## 自動チェックツールの設定

### ESLint設定
```javascript
// eslint.config.mjs
export default [
  {
    rules: {
      // React 19の非推奨パターン検出
      'react-19-upgrade/no-default-props': 'error',
      'react-19-upgrade/no-prop-types': 'warn',
      'react-19-upgrade/no-legacy-context': 'error',

      // useEffect関連のルール
      'react-hooks/exhaustive-deps': 'error',
      'react-hooks/rules-of-hooks': 'error',

      // カスタムルール（プロジェクト固有）
      'custom/no-derived-state-in-effect': 'error',
      'custom/prefer-use-action-state': 'warn',
      'custom/prefer-use-optimistic': 'warn',
    }
  }
];
```

### TypeScript設定
```json
// tsconfig.json
{
  "compilerOptions": {
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "exactOptionalPropertyTypes": true
  }
}
```

## レビューチェックリスト

### 🔍 useEffect関連
- [ ] 派生状態をuseEffectで管理していないか
- [ ] イベントハンドラーのロジックがuseEffectに含まれていないか
- [ ] propsの変更でuseEffectが不要に実行されていないか
- [ ] 計算チェーンが複数のuseEffectで実装されていないか
- [ ] 外部システム同期でuseSyncExternalStoreが使用可能か
- [ ] クリーンアップ関数が適切に実装されているか

### 🚀 React 19新機能
- [ ] フォーム処理でuseActionStateを使用しているか
- [ ] 楽観的更新でuseOptimisticを使用しているか
- [ ] Server Actionsが適切に定義されているか
- [ ] ref cleanupが活用されているか
- [ ] useDeferredValueで初期値が設定されているか

### 🔧 Next.js 15新機能
- [ ] cookies()、headers()を非同期で呼び出しているか
- [ ] after()でレスポンス後処理を分離しているか
- [ ] Formコンポーネントでクライアントサイドナビゲーションを最適化しているか
- [ ] 静的ルートが適切に設定されているか

### 📊 パフォーマンス
- [ ] 不要な再レンダリングが発生していないか
- [ ] useMemoが適切に使用されているか
- [ ] 依存関係配列が最適化されているか
- [ ] メモリリークの可能性がないか

## レビューコメントテンプレート

### useEffect関連
```markdown
## useEffect最適化の提案

この`useEffect`は派生状態を管理しているようですが、レンダリング中の計算に変更できます：

```typescript
// 現在のコード
useEffect(() => {
  setFullName(firstName + ' ' + lastName);
}, [firstName, lastName]);

// 提案
const fullName = firstName + ' ' + lastName;
```

これにより不要な再レンダリングを削除し、パフォーマンスが向上します。
```

### React 19新機能
```markdown
## useActionStateの活用提案

フォーム処理でReact 19の`useActionState`を使用することで、pending状態とエラーハンドリングを自動化できます：

```typescript
// 提案
const [state, formAction, pending] = useActionState(submitForm, null);

return (
  <form action={formAction}>
    {/* フォーム要素 */}
    <button disabled={pending}>
      {pending ? 'Submitting...' : 'Submit'}
    </button>
  </form>
);
```
```

## まとめ

1. **useEffectの適切な使用**を最優先でチェック
2. **React 19新機能**の活用を推奨
3. **Next.js 15新機能**でパフォーマンス向上
4. **自動チェックツール**で効率的なレビュー
5. **建設的なフィードバック**でチーム全体のスキル向上

このガイドラインに従うことで、高品質で保守しやすいコードベースを維持できます。
