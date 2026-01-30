'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { Trash2, AlertTriangle, Smartphone, Info } from 'lucide-react'

export default function ForgetMePage() {
  const [language, setLanguage] = useState<'bg' | 'en'>('bg')

  return (
    <div className="min-h-screen bg-gradient-to-b from-red-50 to-white">
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-20 h-20 bg-red-100 rounded-full mb-4">
              <Trash2 size={48} className="text-red-600" />
            </div>
            <h1 className="text-4xl font-bold text-gray-900 mb-2">
              {language === 'bg' ? 'Изтриване на акаунт' : 'Account Deletion'}
            </h1>
            <p className="text-lg text-gray-600">
              {language === 'bg'
                ? 'Информация за изтриване на вашия акаунт в "Твоята София"'
                : 'Information about deleting your account in "Your Sofia"'}
            </p>
          </div>

          {/* Language Tabs */}
          <div className="flex justify-center mb-6">
            <div className="inline-flex rounded-lg shadow-md overflow-hidden">
              <button
                onClick={() => setLanguage('bg')}
                className={`px-6 py-3 font-semibold transition-colors ${
                  language === 'bg'
                    ? 'bg-blue-600 text-white'
                    : 'bg-white text-gray-700 hover:bg-gray-50'
                }`}
              >
                Български
              </button>
              <button
                onClick={() => setLanguage('en')}
                className={`px-6 py-3 font-semibold transition-colors ${
                  language === 'en'
                    ? 'bg-blue-600 text-white'
                    : 'bg-white text-gray-700 hover:bg-gray-50'
                }`}
              >
                English
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="bg-white rounded-2xl shadow-xl p-8 space-y-8">
            {language === 'bg' ? (
              <div className="prose prose-lg max-w-none">
                {/* Warning Banner */}
                <div className="bg-red-50 border-l-4 border-red-600 p-6 rounded-r-lg mb-8">
                  <div className="flex items-start gap-4">
                    <AlertTriangle size={24} className="text-red-600 flex-shrink-0 mt-1" />
                    <div>
                      <h3 className="text-xl font-bold text-red-900 mb-2">Важно предупреждение</h3>
                      <p className="text-red-800 mb-0">
                        Изтриването на акаунт е необратима операция. След изтриване, всички ваши
                        данни ще бъдат премахнати завинаги и не могат да бъдат възстановени.
                      </p>
                    </div>
                  </div>
                </div>

                <section>
                  <h2 className="text-2xl font-bold text-gray-900 mb-4">Какво ще бъде изтрито?</h2>
                  <p className="text-gray-700 mb-4">
                    При изтриване на вашия акаунт, следната информация ще бъде окончателно
                    премахната от нашите системи:
                  </p>
                  <ul className="list-disc pl-6 text-gray-700 space-y-2 mb-4">
                    <li>
                      <strong>Лични данни:</strong> Име, имейл адрес, телефонен номер и всяка друга
                      лична информация, която сте предоставили
                    </li>
                    <li>
                      <strong>Профилни настройки:</strong> Предпочитания за език, известия и други
                      персонализирани настройки
                    </li>
                    <li>
                      <strong>История на сигнали:</strong> Всички сигнали, които сте подали за
                      градски проблеми
                    </li>
                    <li>
                      <strong>История на плащания:</strong> Записи за извършени плащания (ако сте
                      използвали такава функционалност)
                    </li>
                    <li>
                      <strong>Акаунт данни:</strong> Парола, данни за вход и всички свързани с
                      акаунта информация
                    </li>
                  </ul>
                </section>

                <section>
                  <h2 className="text-2xl font-bold text-gray-900 mb-4">
                    Как да изтриете акаунта си?
                  </h2>
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-4">
                    <div className="flex items-start gap-4">
                      <div className="flex-1">
                        <h3 className="text-lg font-bold text-blue-900 mb-3">
                          Стъпки в мобилното приложение:
                        </h3>
                        <ol className="list-decimal pl-5 text-gray-700 space-y-3">
                          <li>
                            Отворете мобилното приложение <strong>&quot;Твоята София&quot;</strong>
                          </li>
                          <li>
                            Отидете на раздел <strong>&quot;Профил&quot;</strong> (долната дясна
                            икона в навигацията)
                          </li>
                          <li>
                            Влезте във вашия акаунт, ако още не сте го направили (бутон{' '}
                            <strong>&quot;Вход&quot;</strong>)
                          </li>
                          <li>
                            Под бутона за изход ще намерите бутон{' '}
                            <strong>&quot;Забрави ме&quot;</strong>
                          </li>
                          <li>Натиснете бутона и прочетете тази информация отново</li>
                          <li>Ще бъдете помолени да потвърдите решението си</li>
                          <li>
                            След потвърждение, акаунтът ще бъде изтрит автоматично и няма да можете
                            да влезете отново
                          </li>
                        </ol>
                      </div>
                    </div>
                  </div>
                </section>

                <section>
                  <h2 className="text-2xl font-bold text-gray-900 mb-4">
                    Какво става след изтриването?
                  </h2>
                  <ul className="list-disc pl-6 text-gray-700 space-y-2 mb-4">
                    <li>Вашият акаунт ще бъде деактивиран незабавно и няма да можете да влезете</li>
                    <li>Личните ви данни ще бъдат изтрити от нашите системи</li>
                    <li>Няма да получавате известия или комуникация от приложението</li>
                    <li>Няма да можете да възстановите данните или историята си</li>
                    <li>
                      Ако решите да използвате приложението отново, ще трябва да създадете нов
                      акаунт
                    </li>
                  </ul>
                </section>

                <section>
                  <h2 className="text-2xl font-bold text-gray-900 mb-4">Алтернативи</h2>
                  <p className="text-gray-700 mb-4">
                    Ако не искате да изтриете напълно акаунта си, можете да разгледате следните
                    опции:
                  </p>
                  <ul className="list-disc pl-6 text-gray-700 space-y-2 mb-4">
                    <li>
                      <strong>Деактивиране на известията:</strong> Можете да изключите всички
                      известия без да изтривате акаунта си
                    </li>
                    <li>
                      <strong>Актуализиране на личните данни:</strong> Можете да редактирате или
                      премахнете определени лични данни от профила си
                    </li>
                    <li>
                      <strong>Временна неактивност:</strong> Можете просто да спрете да използвате
                      приложението, без да изтривате акаунта
                    </li>
                  </ul>
                </section>

                <section>
                  <h2 className="text-2xl font-bold text-gray-900 mb-4">
                    Правна информация (GDPR)
                  </h2>
                  <div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
                    <div className="flex items-start gap-4">
                      <Info size={24} className="text-gray-600 flex-shrink-0 mt-1" />
                      <div>
                        <p className="text-gray-700 mb-4">
                          Съгласно Общия регламент за защита на данните (GDPR), вие имате право да
                          поискате изтриване на вашите лични данни (&quot;правото да бъдете
                          забравен&quot;).
                        </p>
                        <p className="text-gray-700 mb-4">
                          Столична община се ангажира да защитава вашите лични данни и да спазва
                          всички приложими законови изисквания. За повече информация относно нашата
                          политика за поверителност, моля посетете:
                        </p>
                        <ul className="list-none pl-0 text-gray-700 space-y-2">
                          <li>
                            <Link
                              href="/terms-of-use"
                              className="text-blue-600 hover:underline inline-flex items-center gap-2"
                            >
                              Общи условия и Политика за поверителност
                            </Link>
                          </li>
                          <li>
                            <Link
                              href="https://www.sofia.bg/en/protection-of-personal-data"
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-600 hover:underline inline-flex items-center gap-2"
                            >
                              Защита на личните данни - София.бг
                            </Link>
                          </li>
                        </ul>
                      </div>
                    </div>
                  </div>
                </section>

                <section>
                  <h2 className="text-2xl font-bold text-gray-900 mb-4">Нуждаете се от помощ?</h2>
                  <p className="text-gray-700 mb-4">
                    Ако имате въпроси относно изтриването на акаунт или нуждата от помощ, можете да
                    се свържете с нас, като посетите:&nbsp;
                    <a
                      href="https://call.sofia.bg"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:underline"
                    >
                      call.sofia.bg
                    </a>
                  </p>
                </section>
              </div>
            ) : (
              <div className="prose prose-lg max-w-none">
                {/* Warning Banner */}
                <div className="bg-red-50 border-l-4 border-red-600 p-6 rounded-r-lg mb-8">
                  <div className="flex items-start gap-4">
                    <AlertTriangle size={24} className="text-red-600 flex-shrink-0 mt-1" />
                    <div>
                      <h3 className="text-xl font-bold text-red-900 mb-2">Important Warning</h3>
                      <p className="text-red-800 mb-0">
                        Account deletion is an irreversible operation. After deletion, all your data
                        will be permanently removed and cannot be recovered.
                      </p>
                    </div>
                  </div>
                </div>

                <section>
                  <h2 className="text-2xl font-bold text-gray-900 mb-4">What Will Be Deleted?</h2>
                  <p className="text-gray-700 mb-4">
                    When you delete your account, the following information will be permanently
                    removed from our systems:
                  </p>
                  <ul className="list-disc pl-6 text-gray-700 space-y-2 mb-4">
                    <li>
                      <strong>Personal data:</strong> Name, email address, phone number, and any
                      other personal information you provided
                    </li>
                    <li>
                      <strong>Profile settings:</strong> Language preferences, notifications, and
                      other personalized settings
                    </li>
                    <li>
                      <strong>Signal history:</strong> All signals you have submitted for city
                      issues
                    </li>
                    <li>
                      <strong>Payment history:</strong> Records of payments made (if you used this
                      functionality)
                    </li>
                    <li>
                      <strong>Account data:</strong> Password, login credentials, and all
                      account-related information
                    </li>
                  </ul>
                </section>

                <section>
                  <h2 className="text-2xl font-bold text-gray-900 mb-4">
                    How to Delete Your Account?
                  </h2>
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-4">
                    <div className="flex items-start gap-4">
                      <div className="flex-1">
                        <h3 className="text-lg font-bold text-blue-900 mb-3">
                          Steps in the mobile app:
                        </h3>
                        <ol className="list-decimal pl-5 text-gray-700 space-y-3">
                          <li>
                            Open the mobile application <strong>&quot;Your Sofia&quot;</strong>
                          </li>
                          <li>
                            Go to the <strong>&quot;Profile&quot;</strong> section (bottom right
                            icon in navigation)
                          </li>
                          <li>
                            Log in to your account if you haven&apos;t already (
                            <strong>&quot;Sign In&quot;</strong> button)
                          </li>
                          <li>
                            Below the logout button you will find the{' '}
                            <strong>&quot;Forget Me&quot;</strong> button
                          </li>
                          <li>Press the button and read this information again</li>
                          <li>You will be asked to confirm your decision</li>
                          <li>
                            After confirming, the account will be deleted automatically and you will
                            not be able to login again
                          </li>
                        </ol>
                      </div>
                    </div>
                  </div>
                </section>

                <section>
                  <h2 className="text-2xl font-bold text-gray-900 mb-4">
                    What Happens After Deletion?
                  </h2>
                  <ul className="list-disc pl-6 text-gray-700 space-y-2 mb-4">
                    <li>
                      Your account will be deactivated immediately and you won&apos;t be able to log
                      in
                    </li>
                    <li>Your personal data will be deleted from our systems</li>
                    <li>You will not receive notifications or communication from the app</li>
                    <li>You will not be able to recover your data or history</li>
                    <li>
                      If you decide to use the app again, you will need to create a new account
                    </li>
                  </ul>
                </section>

                <section>
                  <h2 className="text-2xl font-bold text-gray-900 mb-4">Alternatives</h2>
                  <p className="text-gray-700 mb-4">
                    If you don&apos;t want to completely delete your account, you can consider the
                    following options:
                  </p>
                  <ul className="list-disc pl-6 text-gray-700 space-y-2 mb-4">
                    <li>
                      <strong>Disable notifications:</strong> You can turn off all notifications
                      without deleting your account
                    </li>
                    <li>
                      <strong>Update personal data:</strong> You can edit or remove certain personal
                      data from your profile
                    </li>
                    <li>
                      <strong>Temporary inactivity:</strong> You can simply stop using the app
                      without deleting your account
                    </li>
                  </ul>
                </section>

                <section>
                  <h2 className="text-2xl font-bold text-gray-900 mb-4">
                    Legal Information (GDPR)
                  </h2>
                  <div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
                    <div className="flex items-start gap-4">
                      <Info size={24} className="text-gray-600 flex-shrink-0 mt-1" />
                      <div>
                        <p className="text-gray-700 mb-4">
                          According to the General Data Protection Regulation (GDPR), you have the
                          right to request deletion of your personal data (&quot;right to be
                          forgotten&quot;).
                        </p>
                        <p className="text-gray-700 mb-4">
                          Sofia Municipality is committed to protecting your personal data and
                          complying with all applicable legal requirements. For more information
                          about our privacy policy, please visit:
                        </p>
                        <ul className="list-none pl-0 text-gray-700 space-y-2">
                          <li>
                            <Link
                              href="/terms-of-use"
                              className="text-blue-600 hover:underline inline-flex items-center gap-2"
                            >
                              Terms of Use and Privacy Policy
                            </Link>
                          </li>
                          <li>
                            <Link
                              href="https://www.sofia.bg/en/protection-of-personal-data"
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-600 hover:underline inline-flex items-center gap-2"
                            >
                              Personal Data Protection - Sofia.bg
                            </Link>
                          </li>
                        </ul>
                      </div>
                    </div>
                  </div>
                </section>

                <section>
                  <h2 className="text-2xl font-bold text-gray-900 mb-4">Need Help?</h2>
                  <p className="text-gray-700 mb-4">
                    If you have questions about account deletion or need assistance, you can contact
                    us by visiting:&nbsp;
                    <a
                      href="https://call.sofia.bg"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:underline"
                    >
                      call.sofia.bg
                    </a>
                  </p>
                </section>
              </div>
            )}
          </div>

          {/* Back Link */}
          <div className="text-center mt-8">
            <Link
              href="/"
              className="inline-block px-6 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors shadow-md"
            >
              {language === 'bg' ? 'Към началната страница' : 'Back to Home'}
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
