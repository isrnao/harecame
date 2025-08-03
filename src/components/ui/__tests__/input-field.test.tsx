import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { InputField } from '../input-field'

describe('InputField - React 19 ref as prop pattern', () => {
  it('should handle ref correctly without forwardRef', () => {
    const ref = React.createRef<HTMLInputElement>()

    render(
      <InputField
        ref={ref}
        label="Test Input"
        placeholder="Enter text"
        data-testid="input-field"
      />
    )

    const input = screen.getByTestId('input-field')
    expect(input).toBeInTheDocument()
    expect(ref.current).toBe(input)
  })

  it('should focus input when ref.focus() is called', () => {
    const ref = React.createRef<HTMLInputElement>()

    render(
      <InputField
        ref={ref}
        label="Test Input"
        placeholder="Enter text"
        data-testid="input-field"
      />
    )

    // Focus using ref
    ref.current?.focus()

    const input = screen.getByTestId('input-field')
    expect(input).toHaveFocus()
  })

  it('should display error message when error prop is provided', () => {
    render(
      <InputField
        label="Test Input"
        error="This field is required"
        data-testid="input-field"
      />
    )

    expect(screen.getByText('This field is required')).toBeInTheDocument()
    expect(screen.getByRole('alert')).toBeInTheDocument()
  })

  it('should display helper text when provided', () => {
    render(
      <InputField
        label="Test Input"
        helperText="This is a helper text"
        data-testid="input-field"
      />
    )

    expect(screen.getByText('This is a helper text')).toBeInTheDocument()
  })

  it('should generate unique id when not provided', () => {
    render(
      <InputField
        label="Test Input"
        data-testid="input-field"
      />
    )

    const input = screen.getByTestId('input-field')
    const label = screen.getByText('Test Input')

    expect(input.id).toBeTruthy()
    expect(label.getAttribute('for')).toBe(input.id)
  })

  it('should use provided id when specified', () => {
    render(
      <InputField
        id="custom-id"
        label="Test Input"
        data-testid="input-field"
      />
    )

    const input = screen.getByTestId('input-field')
    const label = screen.getByText('Test Input')

    expect(input.id).toBe('custom-id')
    expect(label.getAttribute('for')).toBe('custom-id')
  })

  it('should handle React node as label', () => {
    render(
      <InputField
        label={
          <span className="flex items-center gap-2">
            <span>📧</span>
            Email Address
          </span>
        }
        data-testid="input-field"
      />
    )

    expect(screen.getByText('📧')).toBeInTheDocument()
    expect(screen.getByText('Email Address')).toBeInTheDocument()
  })
})
