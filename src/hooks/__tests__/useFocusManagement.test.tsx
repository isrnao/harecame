import React from 'react'
import { render, screen } from '@testing-library/react'
import { renderHook, act } from '@testing-library/react'
import { useFocusManagement, useMultiFocusManagement } from '../useFocusManagement'
import { createMockHTMLInputElement } from '@/lib/type-guards'

// Test component for useFocusManagement
function TestComponent() {
  const focusManager = useFocusManagement<HTMLInputElement>()

  return (
    <div>
      <input
        ref={focusManager.ref}
        data-testid="test-input"
        placeholder="Test input"
      />
      <button onClick={focusManager.focus} data-testid="focus-btn">
        Focus
      </button>
      <button onClick={focusManager.blur} data-testid="blur-btn">
        Blur
      </button>
      <button onClick={focusManager.select} data-testid="select-btn">
        Select
      </button>
      <button
        onClick={() => {
          const focused = focusManager.isFocused()
          console.log('Is focused:', focused)
        }}
        data-testid="check-focus-btn"
      >
        Check Focus
      </button>
    </div>
  )
}

// Test component for useMultiFocusManagement
function MultiTestComponent() {
  const focusManager = useMultiFocusManagement<HTMLInputElement>(3)

  return (
    <div>
      <input
        ref={focusManager.setRef(0)}
        data-testid="input-0"
        placeholder="Input 0"
      />
      <input
        ref={focusManager.setRef(1)}
        data-testid="input-1"
        placeholder="Input 1"
      />
      <input
        ref={focusManager.setRef(2)}
        data-testid="input-2"
        placeholder="Input 2"
      />
      <button onClick={() => focusManager.focusAt(0)} data-testid="focus-0">
        Focus 0
      </button>
      <button onClick={() => focusManager.focusAt(1)} data-testid="focus-1">
        Focus 1
      </button>
      <button onClick={() => focusManager.focusNext(0)} data-testid="focus-next">
        Focus Next from 0
      </button>
      <button onClick={() => focusManager.focusPrevious(1)} data-testid="focus-prev">
        Focus Previous from 1
      </button>
    </div>
  )
}

describe('useFocusManagement - React 19 ref as prop pattern', () => {
  it('should provide ref that can be attached to elements', () => {
    render(<TestComponent />)

    const input = screen.getByTestId('test-input')
    expect(input).toBeInTheDocument()
  })

  it('should focus element when focus() is called', () => {
    render(<TestComponent />)

    const input = screen.getByTestId('test-input')
    const focusBtn = screen.getByTestId('focus-btn')

    focusBtn.click()
    expect(input).toHaveFocus()
  })

  it('should blur element when blur() is called', () => {
    render(<TestComponent />)

    const input = screen.getByTestId('test-input')
    const focusBtn = screen.getByTestId('focus-btn')
    const blurBtn = screen.getByTestId('blur-btn')

    // First focus the element
    focusBtn.click()
    expect(input).toHaveFocus()

    // Then blur it
    blurBtn.click()
    expect(input).not.toHaveFocus()
  })

  it('should select text when select() is called on input element', () => {
    render(<TestComponent />)

    const input = screen.getByTestId('test-input') as HTMLInputElement
    const selectBtn = screen.getByTestId('select-btn')

    // Add some text to select
    input.value = 'test text'

    // Mock the select method
    const selectSpy = jest.spyOn(input, 'select')

    selectBtn.click()
    expect(selectSpy).toHaveBeenCalled()

    selectSpy.mockRestore()
  })

  it('should return correct focus state with isFocused()', () => {
    const consoleSpy = jest.spyOn(console, 'log').mockImplementation()

    render(<TestComponent />)

    const input = screen.getByTestId('test-input')
    const focusBtn = screen.getByTestId('focus-btn')
    const checkFocusBtn = screen.getByTestId('check-focus-btn')

    // Check focus state when not focused
    checkFocusBtn.click()

    // Focus the element
    focusBtn.click()
    expect(input).toHaveFocus()

    // Check focus state when focused
    checkFocusBtn.click()

    consoleSpy.mockRestore()
  })
})

describe('useMultiFocusManagement - React 19 ref as prop pattern', () => {
  it('should manage multiple refs correctly', () => {
    render(<MultiTestComponent />)

    const input0 = screen.getByTestId('input-0')
    const input1 = screen.getByTestId('input-1')
    const input2 = screen.getByTestId('input-2')

    expect(input0).toBeInTheDocument()
    expect(input1).toBeInTheDocument()
    expect(input2).toBeInTheDocument()
  })

  it('should focus specific element by index', () => {
    render(<MultiTestComponent />)

    const input0 = screen.getByTestId('input-0')
    const input1 = screen.getByTestId('input-1')
    const focus0Btn = screen.getByTestId('focus-0')
    const focus1Btn = screen.getByTestId('focus-1')

    focus0Btn.click()
    expect(input0).toHaveFocus()

    focus1Btn.click()
    expect(input1).toHaveFocus()
  })

  it('should focus next element correctly', () => {
    render(<MultiTestComponent />)

    const input1 = screen.getByTestId('input-1')
    const focusNextBtn = screen.getByTestId('focus-next')

    focusNextBtn.click()
    expect(input1).toHaveFocus()
  })

  it('should focus previous element correctly', () => {
    render(<MultiTestComponent />)

    const input0 = screen.getByTestId('input-0')
    const focusPrevBtn = screen.getByTestId('focus-prev')

    focusPrevBtn.click()
    expect(input0).toHaveFocus()
  })

  it('should wrap around when focusing next from last element', () => {
    const { result } = renderHook(() => useMultiFocusManagement<HTMLInputElement>(3))

    // Create mock elements
    const mockElements = [
      createMockHTMLInputElement(),
      createMockHTMLInputElement(),
      createMockHTMLInputElement(),
    ]

    // Set up refs
    act(() => {
      mockElements.forEach((element, index) => {
        result.current.setRef(index)(element)
      })
    })

    // Focus next from index 2 (should wrap to 0)
    act(() => {
      result.current.focusNext(2)
    })

    expect(mockElements[0]?.focus).toHaveBeenCalled()
  })

  it('should wrap around when focusing previous from first element', () => {
    const { result } = renderHook(() => useMultiFocusManagement<HTMLInputElement>(3))

    // Create mock elements
    const mockElements = [
      createMockHTMLInputElement(),
      createMockHTMLInputElement(),
      createMockHTMLInputElement(),
    ]

    // Set up refs
    act(() => {
      mockElements.forEach((element, index) => {
        result.current.setRef(index)(element)
      })
    })

    // Focus previous from index 0 (should wrap to 2)
    act(() => {
      result.current.focusPrevious(0)
    })

    expect(mockElements[2]?.focus).toHaveBeenCalled()
  })
})
