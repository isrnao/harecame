# React 19 Server Actions & State Management ガイド

## 概要

React 19では、Server Actions、useActionState、useOptimisticという新しい機能が導入され、フォーム処理と楽観的UIの実装が大幅に簡素化されました。このガイドでは、これらの機能の効果的な使用方法を説明します。

## Server Actions

### 基本的な使用方法

#### 1. Server Actionの定義
```typescript
// app/actions/user.ts
'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

export async function createUser(prevState: any, formData: FormData) {
  const name = formData.get('name') as string
  const email = formData.get('email') as string

  // バリデーション
  if (!name || !email) {
    return {
      success: false,
      error: 'Name and email are required'
    }
  }

  try {
    // データベース操作
    const user = await db.user.create({
      data: { name, email }
    })

    // キャッシュの再検証
    revalidatePath('/users')

    return {
      success: true,
      data: user
    }
  } catch (error) {
    return {
      success: false,
      error: 'Failed to create user'
    }
  }
}
```

#### 2. ファイル内でのServer Action定義
```typescript
// app/user/CreateUserForm.tsx
import { useActionState } from 'react'

// ファイル内でServer Actionを定義
async function createUser(prevState: any, formData: FormData) {
  'use server'

  const name = formData.get('name') as string

  if (!name) {
    return { error: 'Name is required' }
  }

  // 処理...
  return { success: true }
}

export default function CreateUserForm() {
  const [state, formAction, pending] = useActionState(createUser, null)

  return (
    <form action={formAction}>
      <input name="name" required />
      <button disabled={pending}>
        {pending ? 'Creating...' : 'Create User'}
      </button>
      {state?.error && <p className="error">{state.error}</p>}
    </form>
  )
}
```

### 高度なServer Actions

#### 1. 認証付きServer Action
```typescript
// app/actions/auth.ts
'use server'

import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'

export async function updateProfile(prevState: any, formData: FormData) {
  const session = await auth()

  if (!session?.user) {
    redirect('/login')
  }

  const name = formData.get('name') as string

  try {
    await db.user.update({
      where: { id: session.user.id },
      data: { name }
    })

    return { success: true, message: 'Profile updated successfully' }
  } catch (error) {
    return { success: false, error: 'Failed to update profile' }
  }
}
```

#### 2. ファイルアップロード付きServer Action
```typescript
// app/actions/upload.ts
'use server'

import { writeFile } from 'fs/promises'
import { join } from 'path'

export async function uploadFile(prevState: any, formData: FormData) {
  const file = formData.get('file') as File

  if (!file) {
    return { error: 'No file selected' }
  }

  // ファイルサイズ制限
  if (file.size > 5 * 1024 * 1024) { // 5MB
    return { error: 'File size must be less than 5MB' }
  }

  try {
    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)

    const path = join(process.cwd(), 'uploads', file.name)
    await writeFile(path, buffer)

    return { success: true, filename: file.name }
  } catch (error) {
    return { error: 'Failed to upload file' }
  }
}
```

## useActionState

### 基本的な使用方法

```typescript
// app/components/ContactForm.tsx
'use client'

import { useActionState } from 'react'
import { submitContact } from '@/app/actions/contact'

export default function ContactForm() {
  const [state, formAction, pending] = useActionState(submitContact, {
    message: '',
    errors: {}
  })

  return (
    <form action={formAction} className="space-y-4">
      <div>
        <label htmlFor="name">Name</label>
        <input
          id="name"
          name="name"
          type="text"
          disabled={pending}
          className={state.errors?.name ? 'border-red-500' : ''}
        />
        {state.errors?.name && (
          <p className="text-red-500 text-sm">{state.errors.name}</p>
        )}
      </div>

      <div>
        <label htmlFor="email">Email</label>
        <input
          id="email"
          name="email"
          type="email"
          disabled={pending}
          className={state.errors?.email ? 'border-red-500' : ''}
        />
        {state.errors?.email && (
          <p className="text-red-500 text-sm">{state.errors.email}</p>
        )}
      </div>

      <div>
        <label htmlFor="message">Message</label>
        <textarea
          id="message"
          name="message"
          disabled={pending}
          className={state.errors?.message ? 'border-red-500' : ''}
        />
        {state.errors?.message && (
          <p className="text-red-500 text-sm">{state.errors.message}</p>
        )}
      </div>

      <button
        type="submit"
        disabled={pending}
        className="bg-blue-500 text-white px-4 py-2 rounded disabled:opacity-50"
      >
        {pending ? 'Sending...' : 'Send Message'}
      </button>

      {state.message && (
        <p className={`text-sm ${state.success ? 'text-green-500' : 'text-red-500'}`}>
          {state.message}
        </p>
      )}
    </form>
  )
}
```

### 複雑なフォーム状態管理

```typescript
// app/components/UserRegistrationForm.tsx
'use client'

import { useActionState } from 'react'
import { registerUser } from '@/app/actions/auth'

interface FormState {
  success?: boolean
  message?: string
  errors?: {
    username?: string
    email?: string
    password?: string
    confirmPassword?: string
  }
  step?: number
}

const initialState: FormState = {
  step: 1,
  errors: {}
}

export default function UserRegistrationForm() {
  const [state, formAction, pending] = useActionState(registerUser, initialState)

  return (
    <form action={formAction} className="max-w-md mx-auto">
      {state.step === 1 && (
        <div className="space-y-4">
          <h2>Step 1: Basic Information</h2>
          <input
            name="username"
            placeholder="Username"
            disabled={pending}
            className={state.errors?.username ? 'border-red-500' : ''}
          />
          {state.errors?.username && (
            <p className="text-red-500 text-sm">{state.errors.username}</p>
          )}

          <input
            name="email"
            type="email"
            placeholder="Email"
            disabled={pending}
            className={state.errors?.email ? 'border-red-500' : ''}
          />
          {state.errors?.email && (
            <p className="text-red-500 text-sm">{state.errors.email}</p>
          )}

          <input type="hidden" name="step" value="1" />
          <button type="submit" disabled={pending}>
            {pending ? 'Validating...' : 'Next'}
          </button>
        </div>
      )}

      {state.step === 2 && (
        <div className="space-y-4">
          <h2>Step 2: Password</h2>
          <input
            name="password"
            type="password"
            placeholder="Password"
            disabled={pending}
            className={state.errors?.password ? 'border-red-500' : ''}
          />
          {state.errors?.password && (
            <p className="text-red-500 text-sm">{state.errors.password}</p>
          )}

          <input
            name="confirmPassword"
            type="password"
            placeholder="Confirm Password"
            disabled={pending}
            className={state.errors?.confirmPassword ? 'border-red-500' : ''}
          />
          {state.errors?.confirmPassword && (
            <p className="text-red-500 text-sm">{state.errors.confirmPassword}</p>
          )}

          <input type="hidden" name="step" value="2" />
          <button type="submit" disabled={pending}>
            {pending ? 'Creating Account...' : 'Create Account'}
          </button>
        </div>
      )}

      {state.success && (
        <div className="text-green-500 text-center">
          <p>Account created successfully!</p>
        </div>
      )}
    </form>
  )
}
```

## useOptimistic

### 基本的な使用方法

```typescript
// app/components/LikeButton.tsx
'use client'

import { useOptimistic } from 'react'
import { toggleLike } from '@/app/actions/posts'

interface LikeButtonProps {
  postId: string
  initialLikes: number
  initialIsLiked: boolean
}

export default function LikeButton({ postId, initialLikes, initialIsLiked }: LikeButtonProps) {
  const [optimisticState, addOptimistic] = useOptimistic(
    { likes: initialLikes, isLiked: initialIsLiked },
    (state, newIsLiked: boolean) => ({
      likes: newIsLiked ? state.likes + 1 : state.likes - 1,
      isLiked: newIsLiked
    })
  )

  const handleToggleLike = async () => {
    // 楽観的更新を即座に実行
    addOptimistic(!optimisticState.isLiked)

    // Server Actionを実行（失敗時は自動的にロールバック）
    await toggleLike(postId, !optimisticState.isLiked)
  }

  return (
    <button
      onClick={handleToggleLike}
      className={`flex items-center gap-2 px-3 py-1 rounded ${
        optimisticState.isLiked
          ? 'bg-red-100 text-red-600'
          : 'bg-gray-100 text-gray-600'
      }`}
    >
      <span>{optimisticState.isLiked ? '❤️' : '🤍'}</span>
      <span>{optimisticState.likes}</span>
    </button>
  )
}
```

### 複雑な楽観的更新

```typescript
// app/components/TodoList.tsx
'use client'

import { useOptimistic } from 'react'
import { addTodo, toggleTodo, deleteTodo } from '@/app/actions/todos'

interface Todo {
  id: string
  text: string
  completed: boolean
}

interface TodoListProps {
  initialTodos: Todo[]
}

type OptimisticAction =
  | { type: 'add'; text: string; tempId: string }
  | { type: 'toggle'; id: string }
  | { type: 'delete'; id: string }

export default function TodoList({ initialTodos }: TodoListProps) {
  const [optimisticTodos, addOptimistic] = useOptimistic(
    initialTodos,
    (state, action: OptimisticAction) => {
      switch (action.type) {
        case 'add':
          return [
            ...state,
            { id: action.tempId, text: action.text, completed: false }
          ]
        case 'toggle':
          return state.map(todo =>
            todo.id === action.id
              ? { ...todo, completed: !todo.completed }
              : todo
          )
        case 'delete':
          return state.filter(todo => todo.id !== action.id)
        default:
          return state
      }
    }
  )

  const handleAddTodo = async (formData: FormData) => {
    const text = formData.get('text') as string
    if (!text.trim()) return

    const tempId = `temp-${Date.now()}`
    addOptimistic({ type: 'add', text, tempId })

    await addTodo(text)
  }

  const handleToggleTodo = async (id: string) => {
    addOptimistic({ type: 'toggle', id })
    await toggleTodo(id)
  }

  const handleDeleteTodo = async (id: string) => {
    addOptimistic({ type: 'delete', id })
    await deleteTodo(id)
  }

  return (
    <div className="space-y-4">
      <form action={handleAddTodo} className="flex gap-2">
        <input
          name="text"
          placeholder="Add a new todo..."
          className="flex-1 px-3 py-2 border rounded"
        />
        <button
          type="submit"
          className="px-4 py-2 bg-blue-500 text-white rounded"
        >
          Add
        </button>
      </form>

      <ul className="space-y-2">
        {optimisticTodos.map(todo => (
          <li
            key={todo.id}
            className={`flex items-center gap-3 p-3 border rounded ${
              todo.completed ? 'bg-gray-50' : 'bg-white'
            }`}
          >
            <button
              onClick={() => handleToggleTodo(todo.id)}
              className={`w-5 h-5 rounded border-2 flex items-center justify-center ${
                todo.completed
                  ? 'bg-green-500 border-green-500 text-white'
                  : 'border-gray-300'
              }`}
            >
              {todo.completed && '✓'}
            </button>

            <span
              className={`flex-1 ${
                todo.completed ? 'line-through text-gray-500' : ''
              }`}
            >
              {todo.text}
            </span>

            <button
              onClick={() => handleDeleteTodo(todo.id)}
              className="text-red-500 hover:text-red-700"
            >
              Delete
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
```

## Next.js 15 Form コンポーネントとの組み合わせ

```typescript
// app/components/SearchForm.tsx
'use client'

import { useActionState } from 'react'
import Form from 'next/form'
import { searchPosts } from '@/app/actions/search'

export default function SearchForm() {
  const [state, formAction, pending] = useActionState(searchPosts, {
    results: [],
    query: ''
  })

  return (
    <div className="space-y-4">
      <Form action={formAction} className="flex gap-2">
        <input
          name="query"
          placeholder="Search posts..."
          defaultValue={state.query}
          disabled={pending}
          className="flex-1 px-3 py-2 border rounded"
        />
        <button
          type="submit"
          disabled={pending}
          className="px-4 py-2 bg-blue-500 text-white rounded disabled:opacity-50"
        >
          {pending ? 'Searching...' : 'Search'}
        </button>
      </Form>

      {state.results.length > 0 && (
        <div className="space-y-2">
          <h3>Search Results ({state.results.length})</h3>
          {state.results.map(post => (
            <div key={post.id} className="p-3 border rounded">
              <h4 className="font-semibold">{post.title}</h4>
              <p className="text-gray-600">{post.excerpt}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
```

## エラーハンドリングのベストプラクティス

### 1. Server Actionでのエラーハンドリング
```typescript
// app/actions/user.ts
'use server'

import { z } from 'zod'

const userSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  email: z.string().email('Invalid email format'),
  age: z.number().min(18, 'Must be at least 18 years old')
})

export async function createUser(prevState: any, formData: FormData) {
  try {
    // バリデーション
    const validatedData = userSchema.parse({
      name: formData.get('name'),
      email: formData.get('email'),
      age: Number(formData.get('age'))
    })

    // データベース操作
    const user = await db.user.create({
      data: validatedData
    })

    return {
      success: true,
      data: user,
      message: 'User created successfully'
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        success: false,
        errors: error.flatten().fieldErrors,
        message: 'Validation failed'
      }
    }

    console.error('Failed to create user:', error)
    return {
      success: false,
      message: 'Failed to create user. Please try again.'
    }
  }
}
```

### 2. クライアントサイドでのエラー表示
```typescript
// app/components/UserForm.tsx
'use client'

import { useActionState } from 'react'
import { createUser } from '@/app/actions/user'

export default function UserForm() {
  const [state, formAction, pending] = useActionState(createUser, {
    success: false,
    errors: {},
    message: ''
  })

  return (
    <form action={formAction} className="space-y-4">
      <div>
        <label htmlFor="name">Name</label>
        <input
          id="name"
          name="name"
          disabled={pending}
          className={state.errors?.name ? 'border-red-500' : 'border-gray-300'}
        />
        {state.errors?.name && (
          <p className="text-red-500 text-sm">{state.errors.name[0]}</p>
        )}
      </div>

      <div>
        <label htmlFor="email">Email</label>
        <input
          id="email"
          name="email"
          type="email"
          disabled={pending}
          className={state.errors?.email ? 'border-red-500' : 'border-gray-300'}
        />
        {state.errors?.email && (
          <p className="text-red-500 text-sm">{state.errors.email[0]}</p>
        )}
      </div>

      <button
        type="submit"
        disabled={pending}
        className="bg-blue-500 text-white px-4 py-2 rounded disabled:opacity-50"
      >
        {pending ? 'Creating...' : 'Create User'}
      </button>

      {state.message && (
        <div className={`p-3 rounded ${
          state.success
            ? 'bg-green-100 text-green-700'
            : 'bg-red-100 text-red-700'
        }`}>
          {state.message}
        </div>
      )}
    </form>
  )
}
```

## パフォーマンス最適化

### 1. Server Actionの最適化
```typescript
// app/actions/optimized.ts
'use server'

import { unstable_cache } from 'next/cache'
import { revalidateTag } from 'next/cache'

// キャッシュされたデータ取得
const getCachedData = unstable_cache(
  async (id: string) => {
    return await db.data.findUnique({ where: { id } })
  },
  ['data'],
  { tags: ['data'] }
)

export async function updateData(prevState: any, formData: FormData) {
  const id = formData.get('id') as string
  const value = formData.get('value') as string

  try {
    await db.data.update({
      where: { id },
      data: { value }
    })

    // 特定のタグのキャッシュを無効化
    revalidateTag('data')

    return { success: true }
  } catch (error) {
    return { success: false, error: 'Update failed' }
  }
}
```

### 2. useOptimisticの最適化
```typescript
// app/components/OptimizedList.tsx
'use client'

import { useOptimistic, useMemo } from 'react'

export default function OptimizedList({ items }) {
  const [optimisticItems, addOptimistic] = useOptimistic(items)

  // 重い計算をメモ化
  const processedItems = useMemo(() => {
    return optimisticItems.map(item => ({
      ...item,
      processed: expensiveProcessing(item)
    }))
  }, [optimisticItems])

  return (
    <div>
      {processedItems.map(item => (
        <div key={item.id}>{item.processed}</div>
      ))}
    </div>
  )
}
```

## まとめ

1. **Server Actions**は'use server'ディレクティブで定義し、フォーム処理を簡素化
2. **useActionState**でフォームの状態（pending、エラー、結果）を自動管理
3. **useOptimistic**で楽観的UIを実装し、UX向上
4. **適切なエラーハンドリング**でユーザビリティを向上
5. **Next.js 15のFormコンポーネント**と組み合わせてパフォーマンス最適化
6. **キャッシュ戦略**を活用してサーバーサイドパフォーマンスを向上

これらの機能を適切に組み合わせることで、モダンで高性能なWebアプリケーションを構築できます。
