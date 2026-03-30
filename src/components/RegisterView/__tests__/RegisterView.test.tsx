/**
 * @jest-environment jsdom
 */
import '@testing-library/jest-dom'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import React from 'react'
import RegisterView from '../index'

jest.mock('@payloadcms/next/templates', () => ({
  MinimalTemplate: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))

jest.mock('next/link', () => {
  const Link = ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  )
  Link.displayName = 'Link'
  return Link
})

const fillForm = (email: string, password: string, confirmPassword: string, name = '') => {
  if (name) fireEvent.change(screen.getByLabelText(/имена/i), { target: { value: name } })
  fireEvent.change(screen.getByLabelText(/имейл/i), { target: { value: email } })
  fireEvent.change(screen.getByLabelText(/^парола/i), { target: { value: password } })
  fireEvent.change(screen.getByLabelText(/потвърди парола/i), {
    target: { value: confirmPassword },
  })
}

describe('RegisterView', () => {
  beforeEach(() => {
    jest.resetAllMocks()
  })

  it('renders name, email, password, confirm password fields and submit button', () => {
    render(<RegisterView />)

    expect(screen.getByLabelText(/имена/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/имейл/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/^парола/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/потвърди парола/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /регистрирай се/i })).toBeInTheDocument()
  })

  it('renders a link to the login page', () => {
    render(<RegisterView />)
    const loginLink = screen.getByRole('link', { name: /влезте/i })
    expect(loginLink).toHaveAttribute('href', '/admin/login')
  })

  it('shows an error when passwords do not match', async () => {
    render(<RegisterView />)
    fillForm('test@sofia.bg', 'password123', 'different')
    fireEvent.click(screen.getByRole('button', { name: /регистрирай се/i }))

    expect(await screen.findByRole('alert')).toHaveTextContent(/паролите не съвпадат/i)
  })

  it('calls POST /api/users with email, password and role=user on valid submit', async () => {
    const mockFetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ doc: { id: '1', email: 'test@sofia.bg' } }),
    })
    global.fetch = mockFetch

    render(<RegisterView />)
    fillForm('test@sofia.bg', 'password123', 'password123', 'Иван Иванов')
    fireEvent.click(screen.getByRole('button', { name: /регистрирай се/i }))

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/users',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            name: 'Иван Иванов',
            email: 'test@sofia.bg',
            password: 'password123',
            role: 'user',
          }),
        })
      )
    })
  })

  it('shows success message and login link after successful registration', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ doc: { id: '1' } }),
    })

    render(<RegisterView />)
    fillForm('test@sofia.bg', 'password123', 'password123')
    fireEvent.click(screen.getByRole('button', { name: /регистрирай се/i }))

    expect(await screen.findByText(/регистрацията е успешна/i)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /влезте в акаунта си/i })).toHaveAttribute(
      'href',
      '/admin/login'
    )
  })

  it('shows API error message on failed registration', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ errors: [{ message: 'Имейлът вече е зает.' }] }),
    })

    render(<RegisterView />)
    fillForm('taken@sofia.bg', 'password123', 'password123')
    fireEvent.click(screen.getByRole('button', { name: /регистрирай се/i }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Имейлът вече е зает.')
  })

  it('shows fallback error message when API returns no specific error', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      json: async () => ({}),
    })

    render(<RegisterView />)
    fillForm('test@sofia.bg', 'password123', 'password123')
    fireEvent.click(screen.getByRole('button', { name: /регистрирай се/i }))

    expect(await screen.findByRole('alert')).toHaveTextContent(/грешка при регистрацията/i)
  })
})
