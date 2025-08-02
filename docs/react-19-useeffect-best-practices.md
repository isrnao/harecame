# React 19 useEffect ベストプラクティスガイド

## 概要

React 19では、useEffectの使用を最小限に抑え、より効率的なパターンを推奨しています。このガイドでは、useEffectの適切な使用方法と、避けるべきアンチパターンについて説明します。

## useEffectを使うべき場面

### ✅ 適切な使用例

#### 1. 外部システムとの同期
```typescript
// ✅ WebSocket接続の管理
useEffect(() => {
  const ws = new WebSocket('ws://localhost:8080');

  ws.onmessage = (event) => {
    setMessages(prev => [...prev, event.data]);
  };

  return () => {
    ws.close();
  };
}, []);

// ✅ イベントリスナーの管理
useEffect(() => {
  const handleResize = () => {
    setWindowSize({ width: window.innerWidth, height: window.innerHeight });
  };

  window.addEventListener('resize', handleResize);
  return () => window.removeEventListener('resize', handleResize);
}, []);
```

#### 2. データフェッチ（適切なクリーンアップ付き）
```typescript
// ✅ AbortControllerを使用したデータフェッチ
useEffect(() => {
  const abortController = new AbortController();

  const fetchData = async () => {
    try {
      const response = await fetch('/api/data', {
        signal: abortController.signal
      });
      const data = await response.json();
      setData(data);
    } catch (error) {
      if (error.name !== 'AbortError') {
        setError(error.message);
      }
    }
  };

  fetchData();

  return () => {
    abortController.abort();
  };
}, []);
```

#### 3. 外部ストアとの同期（useSyncExternalStoreが推奨）
```typescript
// ✅ useSyncExternalStoreを使用（推奨）
import { useSyncExternalStore } from 'react';

function useLocalStorage(key: string) {
  return useSyncExternalStore(
    (callback) => {
      const handleStorageChange = () => callback();
      window.addEventListener('storage', handleStorageChange);
      return () => window.removeEventListener('storage', handleStorageChange);
    },
    () => localStorage.getItem(key),
    () => null // サーバーサイドでの初期値
  );
}
```

## useEffectを避けるべき場面

### ❌ アンチパターン

#### 1. 派生状態の管理
```typescript
// ❌ 悪い例：useEffectで派生状態を管理
function UserProfile({ firstName, lastName }) {
  const [fullName, setFullName] = useState('');

  useEffect(() => {
    setFullName(firstName + ' ' + lastName);
  }, [firstName, lastName]);

  return <div>{fullName}</div>;
}

// ✅ 良い例：レンダリング中に計算
function UserProfile({ firstName, lastName }) {
  const fullName = firstName + ' ' + lastName;
  return <div>{fullName}</div>;
}

// ✅ 高価な計算の場合はuseMemoを使用
function UserProfile({ firstName, lastName }) {
  const fullName = useMemo(() => {
    // 高価な計算の例
    return expensiveNameFormatting(firstName, lastName);
  }, [firstName, lastName]);

  return <div>{fullName}</div>;
}
```

#### 2. イベントハンドラーのロジック
```typescript
// ❌ 悪い例：useEffectでイベント固有のロジックを処理
function Counter() {
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (count > 10) {
      showNotification('Count exceeded!');
    }
  }, [count]);

  return (
    <button onClick={() => setCount(c => c + 1)}>
      Count: {count}
    </button>
  );
}

// ✅ 良い例：イベントハンドラー内で処理
function Counter() {
  const [count, setCount] = useState(0);

  const handleIncrement = () => {
    const newCount = count + 1;
    setCount(newCount);

    if (newCount > 10) {
      showNotification('Count exceeded!');
    }
  };

  return (
    <button onClick={handleIncrement}>
      Count: {count}
    </button>
  );
}
```

#### 3. propsの変更による状態リセット
```typescript
// ❌ 悪い例：useEffectでpropsの変更を監視
function UserForm({ userId }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');

  useEffect(() => {
    setName('');
    setEmail('');
  }, [userId]);

  return (
    <form>
      <input value={name} onChange={(e) => setName(e.target.value)} />
      <input value={email} onChange={(e) => setEmail(e.target.value)} />
    </form>
  );
}

// ✅ 良い例：keyプロパティで再作成
function UserForm({ userId }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');

  return (
    <form key={userId}>
      <input value={name} onChange={(e) => setName(e.target.value)} />
      <input value={email} onChange={(e) => setEmail(e.target.value)} />
    </form>
  );
}

// ✅ または、レンダリング中に状態を調整
function UserForm({ userId }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [prevUserId, setPrevUserId] = useState(userId);

  if (userId !== prevUserId) {
    setName('');
    setEmail('');
    setPrevUserId(userId);
  }

  return (
    <form>
      <input value={name} onChange={(e) => setName(e.target.value)} />
      <input value={email} onChange={(e) => setEmail(e.target.value)} />
    </form>
  );
}
```

#### 4. 計算チェーン
```typescript
// ❌ 悪い例：複数のuseEffectで連鎖的に更新
function Dashboard({ data }) {
  const [processedData, setProcessedData] = useState([]);
  const [summary, setSummary] = useState({});
  const [chartData, setChartData] = useState([]);

  useEffect(() => {
    setProcessedData(processData(data));
  }, [data]);

  useEffect(() => {
    setSummary(calculateSummary(processedData));
  }, [processedData]);

  useEffect(() => {
    setChartData(formatForChart(processedData));
  }, [processedData]);

  return <div>{/* レンダリング */}</div>;
}

// ✅ 良い例：レンダリング中に計算
function Dashboard({ data }) {
  const processedData = useMemo(() => processData(data), [data]);
  const summary = useMemo(() => calculateSummary(processedData), [processedData]);
  const chartData = useMemo(() => formatForChart(processedData), [processedData]);

  return <div>{/* レンダリング */}</div>;
}

// ✅ または、useReducerで状態を統合
function Dashboard({ data }) {
  const [state, dispatch] = useReducer(dashboardReducer, {
    processedData: [],
    summary: {},
    chartData: []
  });

  useEffect(() => {
    dispatch({ type: 'UPDATE_DATA', payload: data });
  }, [data]);

  return <div>{/* レンダリング */}</div>;
}
```

## React 19の新機能活用

### 1. ref cleanup機能
```typescript
// ✅ React 19のref cleanup機能を活用（DOM要素の管理）
function ScrollableDiv({ children }) {
  return (
    <div
      ref={(el) => {
        if (!el) return;

        const handleScroll = () => {
          // スクロール処理
        };

        el.addEventListener('scroll', handleScroll);

        // クリーンアップ関数を返す
        return () => {
          el.removeEventListener('scroll', handleScroll);
        };
      }}
    >
      {children}
    </div>
  );
}

// ❌ MediaStreamのような外部リソースには適さない
// MediaStreamの管理はuseEffectを使用する
function VideoPlayer({ stream }) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }

    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, [stream]);

  return <video ref={videoRef} autoPlay muted />;
}
```

### 2. useDeferredValue with initialValue
```typescript
// ✅ useDeferredValueで初期値を設定
function SearchResults({ query }) {
  const [results, setResults] = useState([]);
  const deferredResults = useDeferredValue(results, []); // 初期値を設定

  useEffect(() => {
    if (!query) return;

    searchAPI(query).then(setResults);
  }, [query]);

  return (
    <div>
      {deferredResults.map(result => (
        <div key={result.id}>{result.title}</div>
      ))}
    </div>
  );
}
```

## 開発環境での注意点

### Strict Modeでの二重実行対策
```typescript
// ✅ 開発環境での二重実行を防ぐ
let isInitialized = false;

function useAppInitialization() {
  useEffect(() => {
    if (isInitialized) return;

    // 初期化処理
    initializeApp();
    isInitialized = true;

    // 開発環境でのクリーンアップ
    return () => {
      if (process.env.NODE_ENV === 'development') {
        isInitialized = false;
      }
    };
  }, []);
}
```

## パフォーマンス最適化

### 1. 依存関係配列の最適化
```typescript
// ❌ 悪い例：オブジェクトを依存関係に含める
function MyComponent({ config }) {
  useEffect(() => {
    // configが毎回新しいオブジェクトの場合、毎回実行される
    doSomething(config);
  }, [config]);
}

// ✅ 良い例：必要なプロパティのみを依存関係に含める
function MyComponent({ config }) {
  useEffect(() => {
    doSomething(config);
  }, [config.apiUrl, config.timeout]); // 必要なプロパティのみ
}

// ✅ または、useMemoでオブジェクトを安定化
function MyComponent({ config }) {
  const stableConfig = useMemo(() => ({
    apiUrl: config.apiUrl,
    timeout: config.timeout
  }), [config.apiUrl, config.timeout]);

  useEffect(() => {
    doSomething(stableConfig);
  }, [stableConfig]);
}
```

### 2. クリーンアップの重要性
```typescript
// ✅ 適切なクリーンアップの実装
function useWebSocket(url) {
  const [socket, setSocket] = useState(null);

  useEffect(() => {
    const ws = new WebSocket(url);
    setSocket(ws);

    ws.onopen = () => console.log('Connected');
    ws.onclose = () => console.log('Disconnected');
    ws.onerror = (error) => console.error('WebSocket error:', error);

    return () => {
      ws.close();
      setSocket(null);
    };
  }, [url]);

  return socket;
}
```

## まとめ

1. **useEffectは外部システムとの同期にのみ使用する**
2. **派生状態はレンダリング中に計算する**
3. **イベントロジックはイベントハンドラーに配置する**
4. **propsの変更による状態リセットはkeyプロパティを使用する**
5. **計算チェーンはuseMemoやuseReducerで最適化する**
6. **React 19の新機能（ref cleanup、useDeferredValue）を活用する**
7. **適切なクリーンアップを必ず実装する**

これらのベストプラクティスに従うことで、より効率的で保守しやすいReactアプリケーションを構築できます。
