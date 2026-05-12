'use client'

import React, { type ReactNode, useEffect, useRef } from 'react'

type FaqItem = { id: string; q: string; a: ReactNode }

export default function FaqList({ faqs }: { faqs: FaqItem[] }) {
  const refs = useRef<Record<string, HTMLDetailsElement | null>>({})

  useEffect(() => {
    const hash = window.location.hash.slice(1)
    if (!hash) return
    const el = refs.current[hash]
    if (!el) return
    el.open = true
    el.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [])

  return (
    <>
      {faqs.map(({ id, q, a }, idx) => (
        <details
          key={idx}
          id={id}
          ref={(el) => {
            refs.current[id] = el
          }}
          className="bg-white rounded-xl shadow-sm border border-gray-100 group"
        >
          <summary className="flex justify-between items-center cursor-pointer px-6 py-4 font-medium text-gray-900 list-none">
            {q}
            <span className="text-blue-600 text-lg group-open:rotate-45 transition-transform duration-150 ml-4 flex-shrink-0">
              +
            </span>
          </summary>
          <p className="px-6 pb-4 text-gray-600 leading-relaxed text-sm">{a}</p>
        </details>
      ))}
    </>
  )
}
