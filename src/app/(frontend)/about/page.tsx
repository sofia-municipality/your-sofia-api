import React from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'За проекта – Твоята София',
  description:
    'Твоята София е гражданска платформа с отворен код, разработена от Столична община. Научете повече за целите, технологиите и екипа зад проекта.',
}

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white">
      <div className="container mx-auto px-4 py-12">
        <div className="max-w-3xl mx-auto">
          {/* Hero */}
          <div className="text-center mb-12">
            <div className="mb-6 flex justify-center">
              <Image
                src="/sofia-gerb.png"
                alt="Герб на Столична община"
                width={80}
                height={80}
                className="rounded-full shadow"
              />
            </div>
            <h1 className="text-4xl font-bold text-gray-900 mb-3">За проекта</h1>
            <p className="text-xl text-gray-600">Дигитален мост между жителите и Столична община</p>
          </div>

          {/* What is it */}
          <div className="bg-white rounded-2xl shadow-xl p-8 mb-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Какво е „Твоята София&ldquo;?</h2>
            <p className="text-gray-700 leading-relaxed mb-4">
              <strong>Твоята София</strong> е мобилно приложение и платформа с отворен код,
              създадена от Столична община, която свързва жителите на София с реалното състояние на
              градската среда. Проектът е разработен в духа на гражданската технология – прозрачно,
              публично и в партньорство с местната общност.
            </p>
            <p className="text-gray-700 leading-relaxed">
              Чрез приложението всеки гражданин може да следи новини от Общината, да докладва
              проблеми в градската среда, да проследява графиците за събиране на отпадъци и да
              получава информация за качеството на въздуха в реално време.
            </p>
          </div>

          {/* Goals */}
          <div className="bg-white rounded-2xl shadow-xl p-8 mb-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Цели на проекта</h2>
            <div className="space-y-4">
              {[
                {
                  icon: '📰',
                  title: 'Информираност',
                  desc: 'Достъп до актуална информация за случващото се в София – новини, ремонти и събития в града.',
                },
                {
                  icon: '🤝',
                  title: 'Гражданско участие и контрол',
                  desc: 'Всеки жител може да сигнализира за проблем и да следи как той бива решен. Подпомагане на по-ефективното управление на отпадъците и градската инфраструктура чрез GPS данни в реално време.',
                },
                {
                  icon: '💻',
                  title: 'Отворен код и данни',
                  desc: 'Целият програмен код и данни са публично достъпни и отворени за приноси от разработчици и граждански организации.',
                },
              ].map(({ icon, title, desc }) => (
                <div key={title} className="flex gap-4 items-start">
                  <span className="text-2xl mt-0.5">{icon}</span>
                  <div>
                    <h3 className="font-semibold text-gray-900">{title}</h3>
                    <p className="text-gray-600 text-sm">{desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Tech stack */}
          <div className="bg-white rounded-2xl shadow-xl p-8 mb-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Основни компоненти</h2>
            <div className="grid sm:grid-cols-2 gap-4">
              {[
                { label: 'Мобилно приложение', value: 'Android и iPhone' },
                { label: 'Административен сайт', value: 'your.sofia.bg' },
                { label: 'Лиценз', value: 'EUPL-1.2 (отворен код)' },
                { label: 'Поддържани езици', value: 'Български и Английски' },
              ].map(({ label, value }) => (
                <div key={label} className="bg-gray-50 rounded-lg p-4">
                  <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">{label}</p>
                  <p className="font-medium text-gray-900">{value}</p>
                </div>
              ))}
            </div>
          </div>

          {/* CTA */}
          <div className="text-center">
            <div className="flex gap-6 justify-center flex-wrap">
              <Link
                href="/for-users/features"
                className="text-blue-600 hover:underline font-medium"
              >
                Разгледайте функционалностите →
              </Link>
              <Link
                href="/for-developers/contribute"
                className="text-blue-600 hover:underline font-medium"
              >
                Включете се в разработката →
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
