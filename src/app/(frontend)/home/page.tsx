import React from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Твоята София - Мобилно приложение за жителите на София',
  description:
    'Твоята София е мобилно приложение на Столична община. Достъп до градски услуги, докладване на проблеми и актуална информация за събитията в града.',
}

export default function HomePage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white">
      <div className="container mx-auto px-4 py-6 sm:py-10">
        <div className="max-w-4xl mx-auto text-center">
          {/* Logo */}
          <div className="mb-4 flex justify-center">
            <Image
              src="/sofia-gerb-transparent.png"
              alt="Герб на Столична община"
              width={100}
              height={100}
            />
          </div>

          {/* Title */}
          <h1 className="text-3xl sm:text-5xl font-bold text-gray-900 mb-2">Твоята София</h1>
          <h2 className="text-lg sm:text-2xl text-gray-600 pb-2">градът е твой</h2>

          {/* Beta Label */}
          <div className="inline-block mb-4">
            <span className="bg-yellow-300 text-yellow-900 px-4 py-2 rounded-full text-sm font-semibold shadow-md">
              Експериментална версия (Бета)
            </span>
          </div>

          {/* Main Content */}
          <div className="bg-white rounded-2xl shadow-xl p-4 sm:p-6 mb-6 text-left sm:text-center">
            <p className="text-base sm:text-lg text-gray-700 leading-relaxed">
              <strong>Твоята София</strong> е мобилно приложение, създадено да свърже жителите на
              Столична община с основните градски услуги. Докладвайте проблеми, проследявайте
              събирането на отпадъци, получавайте градска информация и бъдете в крак със събитията и
              новините - всичко на едно място.
            </p>
          </div>

          {/* Download Links */}
          <div className="mb-10">
            <h3 className="text-xl sm:text-2xl font-semibold text-gray-800 mb-4">
              Изтеглете приложението
            </h3>
            <div className="flex flex-row gap-3 justify-center items-center flex-wrap">
              <Link
                href="https://apps.apple.com/bg/app/your-sofia/id6753916395"
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
              </Link>
              <Link
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
              </Link>
            </div>
          </div>

          {/* Features */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 mt-4">
            <div className="bg-purple-50 p-5 rounded-xl text-left">
              <div className="text-3xl mb-2">📰</div>
              <h4 className="font-semibold text-gray-900 mb-1">Градски новини</h4>
              <p className="text-gray-600 text-sm">Бъдете в крак със събитията и обявленията</p>
            </div>
            <div className="bg-green-50 p-5 rounded-xl text-left">
              <div className="text-3xl mb-2">🗺️</div>
              <h4 className="font-semibold text-gray-900 mb-1">Интерактивна карта</h4>
              <p className="text-gray-600 text-sm">
                Намерете контейнери за отпадъци и градски услуги наблизо
              </p>
            </div>
            <div className="bg-blue-50 p-5 rounded-xl text-left sm:col-span-2 md:col-span-1">
              <div className="text-3xl mb-2">📱</div>
              <h4 className="font-semibold text-gray-900 mb-1">Докладвайте проблеми</h4>
              <p className="text-gray-600 text-sm">
                Сигнализирайте за градски проблеми и следете тяхното решаване
              </p>
            </div>
          </div>

          {/* Footer */}
          <div className="mt-12 pt-6 border-t border-gray-200 flex flex-col sm:flex-row justify-center items-center gap-2 sm:gap-6 text-sm">
            <p className="text-gray-500">© 2026 Столична община</p>
            <Link
              href="/terms-of-use"
              className="text-gray-500 hover:text-gray-700 transition-colors"
            >
              Политика за поверителност и условия за ползване
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
