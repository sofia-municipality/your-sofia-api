import React from 'react'
import Image from 'next/image'
import Link from 'next/link'
import {Metadata} from 'next'

export const metadata: Metadata = {
  title: 'Your Sofia - Mobile App for Sofia Citizens',
  description:
    'Your Sofia is a mobile application for Sofia Municipality citizens. Access city services, report issues, and stay informed about city events.',
}

export default function HomePage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white">
      <div className="container mx-auto px-4 py-4">
        <div className="max-w-4xl mx-auto text-center">
          {/* Logo */}
          <div className="mb-4 flex justify-center">
            <Image
              src="/sofia-gerb.png"
              alt="Sofia Municipality Coat of Arms"
              width={120}
              height={120}
              className="rounded-full shadow-lg"
            />
          </div>

          {/* Title */}
          <h1 className="text-5xl font-bold text-gray-900 mb-2">Твоята София</h1>
          <h2 className="text-2xl text-gray-600 mb-2">градът е твой</h2>

          {/* Main Content */}
          <div className="bg-white rounded-2xl shadow-xl p-4 md:p-4 mb-4">
            <p className="text-lg text-gray-700 leading-relaxed mb-4">
              <strong>Твоята София</strong> е мобилно приложение, създадено да свърже жителите на
              Столична община с основните градски услуги. Докладвайте проблеми, проследявайте
              събирането на отпадъци, получавайте градска информация и бъдете в крак със
              събитията и новините - всичко на едно място.
            </p>
          </div>

          {/* Download Links */}
          <div className="space-y-6 mb-12">
            <h3 className="text-2xl font-semibold text-gray-800 mb-6">Download the App</h3>
            <div className="flex flex-col md:flex-row gap-4 justify-center items-center">
              {/* iOS App Store */}
              <Link
                href="https://apps.apple.com/app/your-sofia"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-3 bg-black text-white px-8 py-4 rounded-xl hover:bg-gray-800 transition-colors shadow-lg w-full md:w-auto"
              >
                <svg className="w-8 h-8" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
                </svg>
                <div className="text-left">
                  <div className="text-xs">Download on the</div>
                  <div className="text-xl font-semibold">App Store</div>
                </div>
              </Link>

              {/* Google Play Store */}
              <Link
                href="https://play.google.com/store/apps/details?id=bg.sofia.your_sofia"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-3 bg-black text-white px-8 py-4 rounded-xl hover:bg-gray-800 transition-colors shadow-lg w-full md:w-auto"
              >
                <svg className="w-8 h-8" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M3,20.5V3.5C3,2.91 3.34,2.39 3.84,2.15L13.69,12L3.84,21.85C3.34,21.6 3,21.09 3,20.5M16.81,15.12L6.05,21.34L14.54,12.85L16.81,15.12M20.16,10.81C20.5,11.08 20.75,11.5 20.75,12C20.75,12.5 20.53,12.9 20.18,13.18L17.89,14.5L15.39,12L17.89,9.5L20.16,10.81M6.05,2.66L16.81,8.88L14.54,11.15L6.05,2.66Z" />
                </svg>
                <div className="text-left">
                  <div className="text-xs">GET IT ON</div>
                  <div className="text-xl font-semibold">Google Play</div>
                </div>
              </Link>
            </div>
          </div>

          {/* Features */}
          <div className="grid md:grid-cols-3 gap-6 mt-12">
            <div className="bg-purple-50 p-6 rounded-xl">
              <div className="text-4xl mb-3">📰</div>
              <h4 className="font-semibold text-gray-900 mb-2">City News</h4>
              <p className="text-gray-600">Stay informed about events and announcements</p>
            </div>
            <div className="bg-green-50 p-6 rounded-xl">
              <div className="text-4xl mb-3">🗺️</div>
              <h4 className="font-semibold text-gray-900 mb-2">Interactive Map</h4>
              <p className="text-gray-600">Find waste containers and city services nearby</p>
            </div>
            <div className="bg-blue-50 p-6 rounded-xl">
              <div className="text-4xl mb-3">📱</div>
              <h4 className="font-semibold text-gray-900 mb-2">Report Issues</h4>
              <p className="text-gray-600">Report city problems and track their resolution</p>
            </div>
          </div>

          {/* Footer */}
          <div className="mt-16 pt-8 border-t border-gray-200">
            <p className="text-gray-500">
              © 2025 Sofia Municipality | Столична община
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
