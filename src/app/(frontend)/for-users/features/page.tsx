import React from 'react'
import Link from 'next/link'
import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Основни функционалности – Твоята София',
  description:
    'Разгледайте всички функционалности на мобилното приложение „Твоята София" – новини, карта, сигнали, въздух и транспорт.',
}

const features = [
  {
    icon: '📰',
    title: 'Градски новини',
    description:
      'Получавате новини и известия в реално време от Столична община и районните администрации – за събития, ремонти, инициативи и др.',
    color: 'bg-purple-50',
  },
  {
    icon: '🗺️',
    title: 'Интерактивна карта',
    description:
      'Разгледайте интерактивна карта на Sofia с точки на събития, ремонти, контейнери за отпадъци и рециклиране в близост до вас.',
    color: 'bg-green-50',
  },
  {
    icon: '♻️',
    title: 'Събиране на отпадъци',
    description:
      'Вижте честота и история на обслужване на контейнерите до вас. Подавайте сигнали за пълни контейнери.',
    color: 'bg-teal-50',
  },
  {
    icon: '🔔',
    title: 'Абонамент за известия',
    description:
      'Абонирайте се за персонализирани известия за избрани от вас категории, локация или зона от картата.',
    color: 'bg-orange-50',
  },

  {
    icon: '💨',
    title: 'Качество на въздуха',
    description:
      '(скоро) Данни за качеството на въздуха в реално време от официалните станции на ИАОС в различни части на София.',
    color: 'bg-blue-50',
  },
  {
    icon: '⚙️',
    title: 'Оперативни метрики',
    description:
      'Системата активно следи и събира данни за ефективността на обслужване на контейнерите, времето за реакция при сигнали и други метрики, които ще споделяме прозрачно.',
    color: 'bg-yellow-50',
  },
]

export default function FeaturesPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white">
      <div className="container mx-auto px-4 py-12">
        <div className="max-w-4xl mx-auto">
          {/* Hero */}
          <div className="text-center mb-12">
            <h1 className="text-4xl font-bold text-gray-900 mb-3">Основни функционалности</h1>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              Всичко, от което се нуждаете, за да сте в крак с живота в София – на едно място.
            </p>
          </div>

          {/* Features grid */}
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
            {features.map(({ icon, title, description, color }) => (
              <div key={title} className={`${color} rounded-2xl p-6 text-center`}>
                <div className="text-4xl mb-4 flex justify-center">{icon}</div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">{title}</h3>
                <p className="text-gray-600 text-sm leading-relaxed">{description}</p>
              </div>
            ))}
          </div>

          {/* Download CTA */}
          <div className="bg-white rounded-2xl shadow-xl p-8 text-center">
            <h2 className="text-2xl font-bold text-gray-900 mb-3">Изтеглете приложението</h2>
            <p className="text-gray-600 mb-6">
              Достъпно безплатно за iOS и Android. Не се изисква регистрация за основните
              функционалности.
            </p>
            <div className="flex gap-4 justify-center flex-wrap">
              <a
                href="https://apps.apple.com/app/your-sofia"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-3 bg-black text-white px-6 py-3 rounded-xl hover:bg-gray-800 transition-colors"
              >
                <svg className="w-7 h-7" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
                </svg>
                <div className="text-left">
                  <div className="text-xs leading-none mb-0.5">Изтеглете от</div>
                  <div className="text-lg font-semibold leading-none">App Store</div>
                </div>
              </a>
              <a
                href="https://play.google.com/store/apps/details?id=bg.sofia.yoursofia"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-3 bg-black text-white px-6 py-3 rounded-xl hover:bg-gray-800 transition-colors"
              >
                <svg className="w-7 h-7" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M3,20.5V3.5C3,2.91 3.34,2.39 3.84,2.15L13.69,12L3.84,21.85C3.34,21.6 3,21.09 3,20.5M16.81,15.12L6.05,21.34L14.54,12.85L16.81,15.12M20.16,10.81C20.5,11.08 20.75,11.5 20.75,12C20.75,12.5 20.53,12.9 20.18,13.18L17.89,14.5L15.39,12L17.89,9.5L20.16,10.81M6.05,2.66L16.81,8.88L14.54,11.15L6.05,2.66Z" />
                </svg>
                <div className="text-left">
                  <div className="text-xs leading-none mb-0.5">НАМЕРЕТЕ В</div>
                  <div className="text-lg font-semibold leading-none">Google Play</div>
                </div>
              </a>
            </div>
          </div>

          {/* Bottom nav */}
          <div className="mt-8 flex justify-center gap-6 text-sm">
            <Link href="/for-users/faq" className="text-blue-600 hover:underline">
              Често задавани въпроси →
            </Link>
            <Link href="/terms-of-use" className="text-blue-600 hover:underline">
              Условия за ползване →
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
