'use client'

import React, { type ReactNode, useEffect, useRef, useState } from 'react'

type FaqItem = { id: string; q: string; a: ReactNode }

function FaqItem({ id, q, a, defaultOpen }: FaqItem & { defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen ?? false)
  const bodyRef = useRef<HTMLDivElement>(null)
  const [measuredHeight, setMeasuredHeight] = useState<number | null>(null)

  useEffect(() => {
    if (open && bodyRef.current) {
      setMeasuredHeight(bodyRef.current.scrollHeight)
    }
  }, [open])

  return (
    <div id={id} className="bg-white rounded-xl shadow-sm border border-gray-100">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex justify-between items-center cursor-pointer px-6 py-4 font-medium text-gray-900 text-left"
        aria-expanded={open}
      >
        {q}
        <span
          className={`text-blue-600 text-lg ml-4 flex-shrink-0 transition-transform duration-200 ${open ? 'rotate-45' : ''}`}
        >
          +
        </span>
      </button>
      <div
        ref={bodyRef}
        className="overflow-hidden transition-all duration-300 ease-in-out"
        style={{ maxHeight: open ? (measuredHeight ?? 500) : 0 }}
      >
        <p className="px-6 pb-4 text-gray-600 leading-relaxed text-sm whitespace-pre-line">{a}</p>
      </div>
    </div>
  )
}

function getHash() {
  if (typeof window === 'undefined') return null
  return window.location.hash.slice(1) || null
}

export default function FaqList({ faqs }: { faqs: FaqItem[] }) {
  const [initialOpen] = useState(getHash)

  useEffect(() => {
    if (!initialOpen) return
    const timer = setTimeout(() => {
      document.getElementById(initialOpen)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 50)
    return () => clearTimeout(timer)
  }, [initialOpen])

  return (
    <>
      {faqs.map(({ id, q, a }) => (
        <FaqItem key={id} id={id} q={q} a={a} defaultOpen={initialOpen === id} />
      ))}
    </>
  )
}
