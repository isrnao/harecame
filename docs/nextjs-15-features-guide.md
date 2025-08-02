# Next.js 15 新機能活用ガイド

## 概要

Next.js 15では、async request APIs、after() API、Formコンポーネントなどの新機能が導入されました。このガイドでは、これらの機能の効果的な活用方法を説明します。

## Async Request APIs

### 概要

Next.js 15では、`cookies()`、`headers()`、`params`、`searchParams`が非同期APIに変更されました。同期呼び出しは非推奨となり、将来のバージョンで削除される予定です。

### 基本的な使用方法

#### 1. Server Components での使用

```typescript
// app/profile/page.tsx
import { cookies, headers } from 'next/headers'

export default async function ProfilePage() {
  // ✅ Next.js 15: async/await が必須
  const cookieStore = await cookies()
  const headersList = await headers()

  const token = cookieStore.get('auth-token')
  const userAgent = headersList.get('user-agent')

  return (
    <div>
      <h1>Profile Page</h1>
      <p>Token: {token?.value}</p>
      <p>User Agent: {userAgent}</p>
    </div>
  )
}
```

#### 2. Route Handlers での使用

```typescript
// app/api/user/route.ts
import { cookies, headers } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  // ✅ async/await パターン
  const cookieStore = await cookies()
  const headersList = await headers()

  const authToken = cookieStore.get('auth-token')
  const authorization = headersList.get('authorization')

  if (!authToken && !authorization) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // ユーザー情報を取得
  const user = await getUserFromToken(authToken?.value || authorization)

  return NextResponse.json({ user })
}

export async function POST(request: NextRequest) {
  const cookieStore = await cookies()
  const body = await request.json()

  // クッキーの設定
  cookieStore.set('last-action', 'user-update', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    maxAge: 60 * 60 * 24 // 24時間
  })

  return NextResponse.json({ success: true })
}
```

#### 3. Dynamic Routes での params 使用

```typescript
// app/posts/[slug]/page.tsx
interface PageProps {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}

export default async function PostPage({ params, searchParams }: PageProps) {
  // ✅ params と searchParams も async
  const { slug } = await params
  const { preview, version } = await searchParams

  const post = await getPost(slug)

  if (preview === 'true') {
    // プレビューモードの処理
    return <PreviewPost post={post} version={version} />
  }

  return <Post post={post} />
}
```

#### 4. Server Actions での使用

```typescript
// app/actions/user.ts
'use server'

import { cookies, headers } from 'next/headers'
import { redirect } from 'next/navigation'

export async function updateUserPreferences(formData: FormData) {
  const cookieStore = await cookies()
  const headersList = await headers()

  // 認証チェック
  const authToken = cookieStore.get('auth-token')
  if (!authToken) {
    redirect('/login')
  }

  // ユーザーエージェントに基づく処理
  const userAgent = headersList.get('user-agent')
  const isMobile = userAgent?.includes('Mobile')

  const preferences = {
    theme: formData.get('theme'),
    language: formData.get('language'),
    mobileOptimized: isMobile
  }

  await saveUserPreferences(authToken.value, preferences)

  return { success: true }
}
```

### 移行ガイド

#### Before (Next.js 14)
```typescript
// ❌ 同期呼び出し（非推奨）
export default function Page() {
  const cookieStore = cookies() // 同期
  const headersList = headers() // 同期

  const token = cookieStore.get('token')
  return <div>{token?.value}</div>
}
```

#### After (Next.js 15)
```typescript
// ✅ 非同期呼び出し（推奨）
export default async function Page() {
  const cookieStore = await cookies() // 非同期
  const headersList = await headers() // 非同期

  const token = cookieStore.get('token')
  return <div>{token?.value}</div>
}
```

## after() API

### 概要

`after()` APIは、レスポンス送信後にタスクを実行するための機能です。ログ記録、分析、クリーンアップなどの「fire-and-forget」タスクに最適です。

### 基本的な使用方法

#### 1. Server Components での使用

```typescript
// app/dashboard/page.tsx
import { unstable_after as after } from 'next/server'
import { logPageView, trackUserActivity } from '@/lib/analytics'

export default async function DashboardPage() {
  const user = await getCurrentUser()
  const dashboardData = await getDashboardData(user.id)

  // レスポンス送信後に実行される
  after(async () => {
    // 分析データの送信
    await logPageView({
      userId: user.id,
      page: '/dashboard',
      timestamp: new Date()
    })

    // ユーザーアクティビティの追跡
    await trackUserActivity({
      userId: user.id,
      action: 'dashboard_view',
      metadata: { dataCount: dashboardData.length }
    })
  })

  return (
    <div>
      <h1>Dashboard</h1>
      {/* ダッシュボードコンテンツ */}
    </div>
  )
}
```

#### 2. Route Handlers での使用

```typescript
// app/api/posts/route.ts
import { unstable_after as after } from 'next/server'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  const body = await request.json()

  // メインの処理
  const post = await createPost(body)

  // レスポンス送信後のタスク
  after(async () => {
    // 検索インデックスの更新
    await updateSearchIndex(post)

    // 通知の送信
    await sendNotificationToFollowers(post.authorId, post.id)

    // キャッシュの無効化
    await invalidateRelatedCaches(post.tags)

    // 分析データの記録
    await recordPostCreation({
      postId: post.id,
      authorId: post.authorId,
      timestamp: new Date()
    })
  })

  // 即座にレスポンスを返す
  return NextResponse.json({ post }, { status: 201 })
}
```

#### 3. Server Actions での使用

```typescript
// app/actions/comment.ts
'use server'

import { unstable_after as after } from 'next/server'
import { revalidatePath } from 'next/cache'

export async function addComment(postId: string, content: string) {
  const user = await getCurrentUser()

  // メインの処理
  const comment = await db.comment.create({
    data: {
      content,
      postId,
      authorId: user.id
    }
  })

  // キャッシュの再検証（即座に実行）
  revalidatePath(`/posts/${postId}`)

  // レスポンス送信後のタスク
  after(async () => {
    // 投稿者への通知
    await notifyPostAuthor(postId, comment.id)

    // スパム検出
    await runSpamDetection(comment.id, content)

    // 分析データの記録
    await recordCommentActivity({
      commentId: comment.id,
      postId,
      authorId: user.id
    })

    // 関連する推薦システムの更新
    await updateRecommendations(user.id, postId)
  })

  return { success: true, comment }
}
```

### 高度な使用例

#### 1. エラーハンドリング付きafter()

```typescript
// app/api/orders/route.ts
import { unstable_after as after } from 'next/server'

export async function POST(request: NextRequest) {
  const orderData = await request.json()

  const order = await createOrder(orderData)

  after(async () => {
    try {
      // 在庫の更新
      await updateInventory(order.items)

      // 確認メールの送信
      await sendOrderConfirmation(order.customerEmail, order.id)

      // 配送システムへの通知
      await notifyShippingSystem(order)

    } catch (error) {
      // after()内のエラーは別途ログに記録
      console.error('Post-order processing failed:', error)

      // 重要な処理の場合は再試行キューに追加
      await addToRetryQueue('post-order-processing', {
        orderId: order.id,
        error: error.message
      })
    }
  })

  return NextResponse.json({ order })
}
```

#### 2. 複数のafter()タスク

```typescript
// app/actions/user-registration.ts
'use server'

import { unstable_after as after } from 'next/server'

export async function registerUser(userData: UserData) {
  const user = await createUser(userData)

  // 即座に実行される処理
  const welcomeEmail = await sendWelcomeEmail(user.email)

  // 分析とログ記録
  after(async () => {
    await recordUserRegistration({
      userId: user.id,
      source: userData.source,
      timestamp: new Date()
    })
  })

  // マーケティング関連の処理
  after(async () => {
    await addToMarketingList(user.email, user.preferences)
    await triggerOnboardingSequence(user.id)
  })

  // システム管理タスク
  after(async () => {
    await setupUserDefaults(user.id)
    await initializeUserWorkspace(user.id)
  })

  return { success: true, user }
}
```

## Form コンポーネント

### 概要

Next.js 15の`Form`コンポーネントは、クライアントサイドナビゲーションの最適化、自動プリフェッチ、フォーム送信の改善を提供します。

### 基本的な使用方法

#### 1. 基本的なForm使用

```typescript
// app/components/SearchForm.tsx
'use client'

import Form from 'next/form'

export default function SearchForm() {
  return (
    <Form action="/search" className="flex gap-2">
      <input
        name="q"
        placeholder="検索キーワード"
        className="flex-1 px-3 py-2 border rounded"
      />
      <input
        name="category"
        type="hidden"
        value="all"
      />
      <button
        type="submit"
        className="px-4 py-2 bg-blue-500 text-white rounded"
      >
        検索
      </button>
    </Form>
  )
}
```

#### 2. Server Actions との組み合わせ

```typescript
// app/components/ContactForm.tsx
'use client'

import Form from 'next/form'
import { useActionState } from 'react'
import { submitContact } from '@/app/actions/contact'

export default function ContactForm() {
  const [state, formAction, pending] = useActionState(submitContact, null)

  return (
    <Form action={formAction} className="space-y-4">
      <div>
        <label htmlFor="name">お名前</label>
        <input
          id="name"
          name="name"
          required
          disabled={pending}
          className="w-full px-3 py-2 border rounded"
        />
      </div>

      <div>
        <label htmlFor="email">メールアドレス</label>
        <input
          id="email"
          name="email"
          type="email"
          required
          disabled={pending}
          className="w-full px-3 py-2 border rounded"
        />
      </div>

      <div>
        <label htmlFor="message">メッセージ</label>
        <textarea
          id="message"
          name="message"
          required
          disabled={pending}
          className="w-full px-3 py-2 border rounded h-32"
        />
      </div>

      <button
        type="submit"
        disabled={pending}
        className="w-full px-4 py-2 bg-blue-500 text-white rounded disabled:opacity-50"
      >
        {pending ? '送信中...' : '送信'}
      </button>

      {state?.success && (
        <p className="text-green-600">メッセージを送信しました。</p>
      )}

      {state?.error && (
        <p className="text-red-600">{state.error}</p>
      )}
    </Form>
  )
}
```

#### 3. 動的ルートへのナビゲーション

```typescript
// app/components/UserSearchForm.tsx
'use client'

import Form from 'next/form'
import { useState } from 'react'

export default function UserSearchForm() {
  const [searchType, setSearchType] = useState<'username' | 'email'>('username')

  return (
    <div className="space-y-4">
      <div className="flex gap-4">
        <label className="flex items-center">
          <input
            type="radio"
            value="username"
            checked={searchType === 'username'}
            onChange={(e) => setSearchType(e.target.value as 'username')}
            className="mr-2"
          />
          ユーザー名で検索
        </label>
        <label className="flex items-center">
          <input
            type="radio"
            value="email"
            checked={searchType === 'email'}
            onChange={(e) => setSearchType(e.target.value as 'email')}
            className="mr-2"
          />
          メールアドレスで検索
        </label>
      </div>

      <Form
        action={`/users/search/${searchType}`}
        className="flex gap-2"
      >
        <input
          name="query"
          placeholder={
            searchType === 'username'
              ? 'ユーザー名を入力'
              : 'メールアドレスを入力'
          }
          className="flex-1 px-3 py-2 border rounded"
        />
        <button
          type="submit"
          className="px-4 py-2 bg-blue-500 text-white rounded"
        >
          検索
        </button>
      </Form>
    </div>
  )
}
```

### 高度な使用例

#### 1. フィルタリング機能付きForm

```typescript
// app/components/ProductFilterForm.tsx
'use client'

import Form from 'next/form'
import { useSearchParams } from 'next/navigation'

export default function ProductFilterForm() {
  const searchParams = useSearchParams()

  return (
    <Form action="/products" className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label htmlFor="category">カテゴリ</label>
          <select
            id="category"
            name="category"
            defaultValue={searchParams.get('category') || ''}
            className="w-full px-3 py-2 border rounded"
          >
            <option value="">すべて</option>
            <option value="electronics">電子機器</option>
            <option value="clothing">衣類</option>
            <option value="books">書籍</option>
          </select>
        </div>

        <div>
          <label htmlFor="minPrice">最低価格</label>
          <input
            id="minPrice"
            name="minPrice"
            type="number"
            min="0"
            defaultValue={searchParams.get('minPrice') || ''}
            className="w-full px-3 py-2 border rounded"
          />
        </div>

        <div>
          <label htmlFor="maxPrice">最高価格</label>
          <input
            id="maxPrice"
            name="maxPrice"
            type="number"
            min="0"
            defaultValue={searchParams.get('maxPrice') || ''}
            className="w-full px-3 py-2 border rounded"
          />
        </div>
      </div>

      <div>
        <label htmlFor="search">商品名</label>
        <input
          id="search"
          name="search"
          defaultValue={searchParams.get('search') || ''}
          className="w-full px-3 py-2 border rounded"
        />
      </div>

      <div className="flex gap-2">
        <button
          type="submit"
          className="px-4 py-2 bg-blue-500 text-white rounded"
        >
          フィルタを適用
        </button>

        <Form action="/products" className="inline">
          <button
            type="submit"
            className="px-4 py-2 bg-gray-500 text-white rounded"
          >
            リセット
          </button>
        </Form>
      </div>
    </Form>
  )
}
```

#### 2. 複数ステップフォーム

```typescript
// app/components/MultiStepForm.tsx
'use client'

import Form from 'next/form'
import { useSearchParams } from 'next/navigation'

export default function MultiStepForm() {
  const searchParams = useSearchParams()
  const currentStep = parseInt(searchParams.get('step') || '1')

  const renderStep = () => {
    switch (currentStep) {
      case 1:
        return (
          <div className="space-y-4">
            <h2>ステップ 1: 基本情報</h2>
            <input name="firstName" placeholder="名前" required />
            <input name="lastName" placeholder="姓" required />
            <input name="email" type="email" placeholder="メール" required />
            <input type="hidden" name="step" value="2" />
          </div>
        )

      case 2:
        return (
          <div className="space-y-4">
            <h2>ステップ 2: 住所情報</h2>
            <input name="address" placeholder="住所" required />
            <input name="city" placeholder="市区町村" required />
            <input name="zipCode" placeholder="郵便番号" required />
            <input type="hidden" name="step" value="3" />
          </div>
        )

      case 3:
        return (
          <div className="space-y-4">
            <h2>ステップ 3: 確認</h2>
            <p>入力内容を確認してください。</p>
            <input type="hidden" name="step" value="complete" />
          </div>
        )

      default:
        return <div>無効なステップです。</div>
    }
  }

  return (
    <div className="max-w-md mx-auto">
      <div className="mb-6">
        <div className="flex justify-between items-center">
          {[1, 2, 3].map((step) => (
            <div
              key={step}
              className={`w-8 h-8 rounded-full flex items-center justify-center ${
                step <= currentStep
                  ? 'bg-blue-500 text-white'
                  : 'bg-gray-200 text-gray-600'
              }`}
            >
              {step}
            </div>
          ))}
        </div>
      </div>

      <Form action="/register" className="space-y-4">
        {renderStep()}

        <div className="flex justify-between">
          {currentStep > 1 && (
            <Form action={`/register?step=${currentStep - 1}`}>
              <button
                type="submit"
                className="px-4 py-2 bg-gray-500 text-white rounded"
              >
                戻る
              </button>
            </Form>
          )}

          <button
            type="submit"
            className="px-4 py-2 bg-blue-500 text-white rounded ml-auto"
          >
            {currentStep === 3 ? '完了' : '次へ'}
          </button>
        </div>
      </Form>
    </div>
  )
}
```

## 統合例：全機能を組み合わせた実装

```typescript
// app/admin/users/page.tsx
import { unstable_after as after } from 'next/server'
import { cookies, headers } from 'next/headers'
import UserManagementForm from './UserManagementForm'

interface PageProps {
  searchParams: Promise<{
    page?: string
    search?: string
    role?: string
  }>
}

export default async function AdminUsersPage({ searchParams }: PageProps) {
  // Next.js 15: async request APIs
  const cookieStore = await cookies()
  const headersList = await headers()
  const params = await searchParams

  // 認証チェック
  const adminToken = cookieStore.get('admin-token')
  if (!adminToken) {
    redirect('/admin/login')
  }

  // ユーザーデータの取得
  const users = await getUsers({
    page: parseInt(params.page || '1'),
    search: params.search,
    role: params.role
  })

  // レスポンス送信後の分析
  after(async () => {
    const userAgent = headersList.get('user-agent')

    await logAdminActivity({
      action: 'view_users_page',
      adminId: adminToken.value,
      userAgent,
      filters: params,
      timestamp: new Date()
    })
  })

  return (
    <div className="space-y-6">
      <h1>ユーザー管理</h1>

      {/* Next.js 15 Form コンポーネント */}
      <UserManagementForm initialFilters={params} />

      <div className="grid gap-4">
        {users.map(user => (
          <UserCard key={user.id} user={user} />
        ))}
      </div>
    </div>
  )
}
```

```typescript
// app/admin/users/UserManagementForm.tsx
'use client'

import Form from 'next/form'
import { useActionState } from 'react'
import { updateUserRole } from '@/app/actions/admin'

export default function UserManagementForm({ initialFilters }) {
  const [state, formAction, pending] = useActionState(updateUserRole, null)

  return (
    <div className="space-y-4">
      {/* フィルタリングフォーム */}
      <Form action="/admin/users" className="flex gap-4">
        <input
          name="search"
          placeholder="ユーザー検索"
          defaultValue={initialFilters.search}
          className="flex-1 px-3 py-2 border rounded"
        />
        <select
          name="role"
          defaultValue={initialFilters.role}
          className="px-3 py-2 border rounded"
        >
          <option value="">すべての役割</option>
          <option value="admin">管理者</option>
          <option value="user">一般ユーザー</option>
        </select>
        <button type="submit" className="px-4 py-2 bg-blue-500 text-white rounded">
          フィルタ
        </button>
      </Form>

      {/* ユーザー役割更新フォーム */}
      <Form action={formAction} className="flex gap-2">
        <select name="userId" required className="px-3 py-2 border rounded">
          <option value="">ユーザーを選択</option>
          {/* ユーザーオプション */}
        </select>
        <select name="newRole" required className="px-3 py-2 border rounded">
          <option value="user">一般ユーザー</option>
          <option value="admin">管理者</option>
        </select>
        <button
          type="submit"
          disabled={pending}
          className="px-4 py-2 bg-green-500 text-white rounded disabled:opacity-50"
        >
          {pending ? '更新中...' : '役割を更新'}
        </button>
      </Form>

      {state?.success && (
        <p className="text-green-600">役割を更新しました。</p>
      )}
      {state?.error && (
        <p className="text-red-600">{state.error}</p>
      )}
    </div>
  )
}
```

## まとめ

1. **Async Request APIs**: `cookies()`、`headers()`、`params`、`searchParams`は必ずawaitで呼び出す
2. **after() API**: レスポンス送信後のタスクに活用し、ユーザー体験を向上
3. **Form コンポーネント**: 自動プリフェッチとクライアントサイドナビゲーションでパフォーマンス向上
4. **統合活用**: これらの機能を組み合わせて、モダンで高性能なWebアプリケーションを構築

これらの新機能を適切に活用することで、Next.js 15の性能を最大限に引き出すことができます。
