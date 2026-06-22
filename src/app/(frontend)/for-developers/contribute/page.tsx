import React, { type ReactNode } from 'react'
import Link from 'next/link'
import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Как да се включа – Твоята София',
  description:
    'Научете как да допринесете за „Твоята София" – отворен код, репорти на грешки, преводи и нови функционалности.',
}

const steps: { num: string; title: string; body: ReactNode }[] = [
  {
    num: '01',
    title: 'Запознайте се с кодовата база',
    body: (
      <>
        Проекта се състои от две хранилища - едното съдържа{' '}
        <a
          href="https://github.com/sofia-municipality/your-sofia-mobile"
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-600 hover:underline"
        >
          програмния код за мобилното приложение
        </a>{' '}
        с технологии (React Native / Expo), а другото хранилище съдържа{' '}
        <a
          href="https://github.com/sofia-municipality/your-sofia-api"
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-600 hover:underline"
        >
          програмния код за административния сайт и API / бекенд
        </a>
        <br />
        <br />
        Прочетете <u>CONTRIBUTING.md</u> файловете за съответното хранилище за конвенции и
        изисквания
      </>
    ),
  },
  {
    num: '02',
    title: 'Намерете тикет за оправяне или си напишете нов',
    body: (
      <>
        Потърсете{' '}
        <a
          href="https://github.com/sofia-municipality/your-sofia-mobile/issues?q=is%3Aopen+label%3A%22good+first+issue%22"
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-600 hover:underline"
        >
          отворени issues
        </a>{' '}
        с етикет „good first issue&ldquo; или „help wanted&ldquo;. Те са специално подбрани за нови
        участници.
      </>
    ),
  },
  {
    num: '03',
    title: 'Fork → Branch → Pull Request',
    body: 'Направете fork на хранилището, създайте feature branch, имплементирайте промяната и отворете Pull Request. Нашият екип ще прегледа кода в рамките на 5 работни дни.',
  },
  {
    num: '04',
    title: 'Присъединете се към общността',
    body: (
      <>
        Обсъждайте идеи, задавайте въпроси и следете развитието на проекта в{' '}
        <a
          href="https://github.com/orgs/sofia-municipality/discussions"
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-600 hover:underline"
        >
          GitHub Discussions
        </a>
        .
      </>
    ),
  },
]

const contributions: { icon: string; title: string; desc: ReactNode }[] = [
  {
    icon: '🐛',
    title: 'Докладване на грешки',
    desc: (
      <>
        Намерихте бъг? Отворете{' '}
        <a
          href="https://github.com/sofia-municipality/your-sofia-mobile/issues/new"
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-600 hover:underline"
        >
          issue в GitHub
        </a>{' '}
        с детайлно описание.
      </>
    ),
  },
  {
    icon: '🌐',
    title: 'Преводи',
    desc: 'Помогнете за подобряване на превода на български или добавете нов език.',
  },
  {
    icon: '📖',
    title: 'Документация',
    desc: 'Подобрете README, добавете примери или напишете ръководство.',
  },
  {
    icon: '🎨',
    title: 'Дизайн',
    desc: 'Предложете подобрения на UX/UI или помогнете с графични ресурси.',
  },
  {
    icon: '💻',
    title: 'Код',
    desc: 'Имплементирайте нова функционалност или оправете съществуващ бъг.',
  },
  {
    icon: '🧪',
    title: 'Тестване',
    desc: 'Напишете unit или e2e тестове за непокрити части от кода.',
  },
]

export default function ContributePage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white">
      <div className="container mx-auto px-4 py-12">
        <div className="max-w-3xl mx-auto">
          {/* Hero */}
          <div className="text-center mb-12">
            <div className="text-5xl mb-4">👋</div>
            <h1 className="text-4xl font-bold text-gray-900 mb-3">Как да се включа?</h1>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              „Твоята София&ldquo; е проект с отворен код. Всяко подобрение е добре дошло –
              независимо дали сте опитен разработчик или тепърва навлизате в разработката на софтуер
            </p>
          </div>

          {/* Steps */}
          <div className="bg-white rounded-2xl shadow-xl p-8 mb-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Стъпки за участие</h2>
            <div className="space-y-6">
              {steps.map(({ num, title, body }) => (
                <div key={num} className="flex gap-4">
                  <span className="text-3xl font-black text-blue-100 leading-none w-10 flex-shrink-0">
                    {num}
                  </span>
                  <div>
                    <h3 className="font-semibold text-gray-900 mb-1">{title}</h3>
                    <p className="text-gray-600 text-sm leading-relaxed">{body}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Ways to contribute */}
          <div className="bg-white rounded-2xl shadow-xl p-8 mb-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Начини да допринесете</h2>
            <div className="grid sm:grid-cols-2 gap-4">
              {contributions.map(({ icon, title, desc }) => (
                <div key={title} className="bg-gray-50 rounded-xl p-4">
                  <div className="text-2xl mb-2">{icon}</div>
                  <h3 className="font-semibold text-gray-900 text-sm mb-1">{title}</h3>
                  <p className="text-gray-600 text-xs leading-relaxed">{desc}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Tech requirements */}
          <div className="bg-white rounded-2xl shadow-xl p-8 mb-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Технически изисквания</h2>
            <div className="space-y-3 text-sm">
              {[
                { label: 'Пакетен мениджър', value: 'pnpm 10 (задължително)' },
                { label: 'Node.js', value: '^18.20.2 или ≥ 20.9.0' },
                { label: 'База данни (API)', value: 'PostgreSQL 17 + PostGIS (Docker)' },
                { label: 'Език', value: 'TypeScript навсякъде' },
                {
                  label: 'Форматиране',
                  value: 'Prettier (no semicolons, single quotes, 2-space indent)',
                },
              ].map(({ label, value }) => (
                <div
                  key={label}
                  className="flex justify-between items-center py-2 border-b border-gray-100 last:border-0"
                >
                  <span className="text-gray-500">{label}</span>
                  <span className="font-mono text-gray-900 text-xs bg-gray-100 px-2 py-1 rounded">
                    {value}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* GitHub CTA */}
          <div className="bg-gray-900 rounded-2xl p-8 text-center text-white mb-8">
            <svg className="w-10 h-10 mx-auto mb-4" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z" />
            </svg>
            <h2 className="text-2xl font-bold mb-2">Хранилища в GitHub</h2>
            <p className="text-gray-400 mb-6 text-sm">
              Изходният код е публично достъпен под лиценз EUPL-1.2
            </p>
            <div className="flex gap-4 justify-center flex-wrap">
              <a
                href="https://github.com/sofia-municipality/your-sofia-mobile"
                target="_blank"
                rel="noopener noreferrer"
                className="px-5 py-2.5 bg-white text-gray-900 rounded-xl font-medium text-sm hover:bg-gray-100 transition-colors"
              >
                📱 Мобилно приложение
              </a>
              <a
                href="https://github.com/sofia-municipality/your-sofia-api"
                target="_blank"
                rel="noopener noreferrer"
                className="px-5 py-2.5 bg-white text-gray-900 rounded-xl font-medium text-sm hover:bg-gray-100 transition-colors"
              >
                ⚙️ API / Бекенд
              </a>
            </div>
          </div>

          {/* Bottom nav */}
          <div className="text-center">
            <Link href="/about" className="text-blue-600 hover:underline text-sm">
              ← За проекта
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
