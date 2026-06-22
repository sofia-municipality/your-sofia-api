import React from 'react'
import Image from 'next/image'
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
      <div className="container mx-auto px-4 py-8 sm:py-12">
        <div className="max-w-4xl mx-auto">
          {/* Hero */}
          <div className="text-center mb-8 sm:mb-12">
            <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-3">
              Основни функционалности
            </h1>
            <p className="text-lg sm:text-xl text-gray-600 max-w-2xl mx-auto">
              Всичко, от което се нуждаете, за да сте в крак с живота в София – на едно място.
            </p>
          </div>

          {/* Features grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 mb-8 sm:mb-12">
            {features.map(({ icon, title, description, color }) => (
              <div
                key={title}
                className={`${color} rounded-2xl p-5 sm:p-6 flex gap-4 sm:flex-col sm:gap-0 sm:text-center`}
              >
                <div className="text-3xl sm:text-4xl sm:mb-4 flex-shrink-0 flex items-start sm:justify-center">
                  {icon}
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-1 sm:mb-2">
                    {title}
                  </h3>
                  <p className="text-gray-600 text-sm leading-relaxed">{description}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Download CTA */}
          <div className="bg-white rounded-2xl shadow-xl p-6 sm:p-8 text-center">
            <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-3">
              Изтеглете приложението
            </h2>
            <p className="text-gray-600 mb-6 text-sm sm:text-base">
              Достъпно безплатно за iOS и Android. Не се изисква регистрация за основните
              функционалности.
            </p>
            <div className="flex flex-row gap-3 justify-center items-center flex-wrap">
              <a
                href="https://apps.apple.com/app/your-sofia"
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-xl overflow-hidden transition-all hover:shadow-md hover:scale-105"
              >
                <Image
                  src="/appstore-get.png"
                  alt="Изтеглете от App Store"
                  width={160}
                  height={53}
                  className="h-10 sm:h-14 w-auto"
                />
              </a>
              <a
                href="https://play.google.com/store/apps/details?id=bg.sofia.yoursofia"
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-xl overflow-hidden transition-all hover:shadow-md hover:scale-105"
              >
                <Image
                  src="/googleplay-get.png"
                  alt="Изтеглете от Google Play"
                  width={160}
                  height={53}
                  className="h-10 sm:h-14 w-auto"
                />
              </a>
            </div>
          </div>

          {/* Bottom nav */}
          <div className="mt-6 sm:mt-8 flex flex-wrap justify-center gap-4 sm:gap-6 text-sm">
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
