import { useRef, useCallback } from 'react'
import { isSelectableInputElement } from '@/lib/type-guards'

/**
 * React 19: ref as propパターンを活用したフォーカス管理フック
 * forwardRefを使用せずに、refを直接管理する
 */
export function useFocusManagement<T extends HTMLElement>() {
  const elementRef = useRef<T>(null)

  // 要素にフォーカスを設定
  const focus = useCallback(() => {
    if (elementRef.current) {
      elementRef.current.focus()
    }
  }, [])

  // 要素からフォーカスを削除
  const blur = useCallback(() => {
    if (elementRef.current) {
      elementRef.current.blur()
    }
  }, [])

  // 要素を選択（input/textareaの場合）
  const select = useCallback(() => {
    if (elementRef.current && isSelectableInputElement(elementRef.current)) {
      elementRef.current.select()
    }
  }, [])

  // フォーカス状態を確認
  const isFocused = useCallback(() => {
    return document.activeElement === elementRef.current
  }, [])

  return {
    ref: elementRef,
    focus,
    blur,
    select,
    isFocused,
  }
}

/**
 * React 19: 複数要素のフォーカス管理フック
 * タブナビゲーションやフォーム内でのフォーカス移動に使用
 */
export function useMultiFocusManagement<T extends HTMLElement>(count: number) {
  const refs = useRef<(T | null)[]>(Array(count).fill(null))

  // 指定されたインデックスの要素にフォーカス
  const focusAt = useCallback((index: number) => {
    if (refs.current[index]) {
      refs.current[index]?.focus()
    }
  }, [])

  // 次の要素にフォーカス
  const focusNext = useCallback((currentIndex: number) => {
    const nextIndex = (currentIndex + 1) % count
    focusAt(nextIndex)
  }, [count, focusAt])

  // 前の要素にフォーカス
  const focusPrevious = useCallback((currentIndex: number) => {
    const prevIndex = currentIndex === 0 ? count - 1 : currentIndex - 1
    focusAt(prevIndex)
  }, [count, focusAt])

  // ref設定用のコールバック
  const setRef = useCallback((index: number) => (element: T | null) => {
    refs.current[index] = element
  }, [])

  return {
    setRef,
    focusAt,
    focusNext,
    focusPrevious,
  }
}
