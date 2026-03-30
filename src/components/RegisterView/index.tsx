'use client'

import { MinimalTemplate } from '@payloadcms/next/templates'
import Link from 'next/link'
import React, { useState } from 'react'

type Status = 'idle' | 'loading' | 'success' | 'error'

const RegisterView: React.FC = () => {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [status, setStatus] = useState<Status>('idle')
  const [errorMessage, setErrorMessage] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (password !== confirmPassword) {
      setStatus('error')
      setErrorMessage('Паролите не съвпадат.')
      return
    }

    setStatus('loading')
    setErrorMessage('')

    try {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password, role: 'user' }),
      })
      const data = await res.json()

      if (!res.ok) {
        const message = data?.errors?.[0]?.message || data?.message || 'Грешка при регистрацията.'
        setErrorMessage(message)
        setStatus('error')
        return
      }

      setStatus('success')
    } catch {
      setErrorMessage('Грешка при свързване със сървъра.')
      setStatus('error')
    }
  }

  if (status === 'success') {
    return (
      <MinimalTemplate>
        <div className="register">
          <h1>Регистрацията е успешна!</h1>
          <p>
            Профилът ви е създаден. <Link href="/admin/login">Влезте в акаунта си</Link>
          </p>
        </div>
      </MinimalTemplate>
    )
  }

  return (
    <MinimalTemplate>
      <div className="register">
        <h1>Регистрация</h1>

        {status === 'error' && errorMessage && (
          <div className="banner banner--type-error" role="alert">
            <p>{errorMessage}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} noValidate>
          <div className="field-type text">
            <label className="field-label" htmlFor="register-name">
              Имена
            </label>
            <input
              id="register-name"
              type="text"
              name="name"
              value={name}
              autoComplete="name"
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div className="field-type email">
            <label className="field-label" htmlFor="register-email">
              Имейл <span className="required">*</span>
            </label>
            <input
              id="register-email"
              type="email"
              name="email"
              value={email}
              autoComplete="email"
              required
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div className="field-type text">
            <label className="field-label" htmlFor="register-password">
              Парола <span className="required">*</span>
            </label>
            <input
              id="register-password"
              type="password"
              name="password"
              value={password}
              autoComplete="new-password"
              required
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          <div className="field-type text">
            <label className="field-label" htmlFor="register-confirm-password">
              Потвърди парола <span className="required">*</span>
            </label>
            <input
              id="register-confirm-password"
              type="password"
              name="confirmPassword"
              value={confirmPassword}
              autoComplete="new-password"
              required
              onChange={(e) => setConfirmPassword(e.target.value)}
            />
          </div>

          <button
            type="submit"
            className="btn btn--style-primary btn--size-large"
            disabled={status === 'loading'}
          >
            {status === 'loading' ? 'Зареждане...' : 'Регистрирай се'}
          </button>
        </form>

        <p style={{ marginTop: '1rem' }}>
          Вече имате профил? <Link href="/admin/login">Влезте</Link>
        </p>
      </div>
    </MinimalTemplate>
  )
}

export default RegisterView
