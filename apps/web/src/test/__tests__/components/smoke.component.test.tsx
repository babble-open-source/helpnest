// @vitest-environment jsdom
/**
 * Component test infra smoke test (Task 25).
 *
 * Proves that:
 *  - The jsdom environment is active (@testing-library/react renders without error)
 *  - @testing-library/jest-dom matchers are registered (toBeInTheDocument etc.)
 *  - @testing-library/user-event works for interaction
 *
 * This test has NO server-only imports. It renders a pure client component
 * inline — no @/lib/db, no prisma, no next-auth.
 */

import React, { useState } from 'react'
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

/** Minimal client component — no server-only imports. */
function Counter({ label }: { label: string }) {
  const [count, setCount] = useState(0)
  return (
    <div>
      <span data-testid="label">{label}</span>
      <span data-testid="count">{count}</span>
      <button onClick={() => setCount((c) => c + 1)}>Increment</button>
    </div>
  )
}

describe('component test infra smoke', () => {
  it('renders a React component in the jsdom environment', () => {
    render(<Counter label="Test counter" />)
    expect(screen.getByTestId('label')).toBeInTheDocument()
    expect(screen.getByTestId('label')).toHaveTextContent('Test counter')
  })

  it('reflects initial count of zero', () => {
    render(<Counter label="Zero test" />)
    expect(screen.getByTestId('count')).toHaveTextContent('0')
  })

  it('increments count on button click via userEvent', async () => {
    const user = userEvent.setup()
    render(<Counter label="Click test" />)
    const button = screen.getByRole('button', { name: /increment/i })
    await user.click(button)
    expect(screen.getByTestId('count')).toHaveTextContent('1')
  })

  it('jest-dom matchers are available: toBeVisible, toHaveTextContent', () => {
    render(<Counter label="Matcher test" />)
    const label = screen.getByTestId('label')
    expect(label).toBeVisible()
    expect(label).toHaveTextContent('Matcher test')
    expect(label).not.toHaveTextContent('wrong text')
  })
})
