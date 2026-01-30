'use client'

import React, { useState } from 'react'
import { Metadata } from 'next'
import Link from 'next/link'

export default function TermsOfUsePage() {
  const [language, setLanguage] = useState<'bg' | 'en'>('bg')

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white">
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold text-gray-900 mb-2">
              {language === 'bg' ? 'Общи условия' : 'Terms of Use'}
            </h1>
            <p className="text-lg text-gray-600">
              {language === 'bg'
                ? 'Мобилно приложение "Твоята София"'
                : 'Mobile Application "Your Sofia"'}
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
            {/* Bulgarian Version */}
            {language === 'bg' && (
              <div className="prose prose-lg max-w-none">
                <section>
                  <h2 className="text-2xl font-bold text-gray-900 mb-4">1. Общи положения</h2>
                  <p className="text-gray-700 mb-4">
                    Мобилното приложение &quot;Твоята София&quot; е собственост на Столична община и
                    е предназначено за предоставяне на информация и услуги на жителите на град
                    София.
                  </p>
                  <p className="text-gray-700 mb-4">
                    Осъществявайки достъп и използвайки мобилното приложение &quot;Твоята
                    София&quot;, Вие приемате настоящите Общи условия за ползване. Ако не сте
                    съгласни с тези условия, моля не използвайте приложението.
                  </p>
                </section>

                <section>
                  <h2 className="text-2xl font-bold text-gray-900 mb-4">2. Описание на услугите</h2>
                  <p className="text-gray-700 mb-4">
                    Мобилното приложение &quot;Твоята София&quot; предоставя следните основни
                    функционалности:
                  </p>
                  <ul className="list-disc pl-6 text-gray-700 space-y-2 mb-4">
                    <li>Достъп до актуални новини и съобщения от Столична община</li>
                    <li>Информация за качеството на въздуха в София в реално време</li>
                    <li>
                      Навигиране на карта с градски обекти и възможност за подаване на сигнали за
                      тяхното състояние
                    </li>
                    <li>Достъп до общински услуги и информация</li>
                    <li>Персонализирани известия и уведомления</li>
                  </ul>
                  <p className="text-gray-700 mb-4">
                    Столична община си запазва правото да актуализира списъка на предоставяните
                    услуги чрез публикуване на съобщение в приложението.
                  </p>
                </section>

                <section>
                  <h2 className="text-2xl font-bold text-gray-900 mb-4">3. Регистрация и достъп</h2>
                  <p className="text-gray-700 mb-4">
                    Достъпът до основните функционалности на приложението е безплатен и не изисква
                    регистрация. Някои разширени услуги могат да изискват създаване на потребителски
                    профил чрез удостоверени електронни средства (например е-Автентикация,
                    КЕП/КУКЕП).
                  </p>
                  <p className="text-gray-700 mb-4">
                    При регистрация, потребителите се задължават да предоставят вярна, истинска и
                    точна информация. При въвеждането на некоректна или подвеждаща информация,
                    потребителят може да бъде лишен от правото на достъп до услугите на
                    приложението.
                  </p>
                  <p className="text-gray-700 mb-4">
                    Регистрираните потребители са отговорни за всички действия, които се извършват
                    от името на техния профил и са длъжни да не предоставят на трети лица паролата
                    за достъп до профила им.
                  </p>
                </section>

                <section>
                  <h2 className="text-2xl font-bold text-gray-900 mb-4">
                    4. Авторско право и интелектуална собственост
                  </h2>
                  <p className="text-gray-700 mb-4">
                    Дизайнът, структурата и съдържанието на мобилното приложение &quot;Твоята
                    София&quot; са предмет на авторско право, което принадлежи на Столична община.
                  </p>
                  <p className="text-gray-700 mb-4">
                    Представената в приложението информация е свободно достъпна и е предназначена за
                    лична, обществена и некомерсиална употреба. Позволено е запазване на информация
                    единствено за лични нетърговски цели.
                  </p>
                  <p className="text-gray-700 mb-4">
                    Забранено е копирането, предаването, разпространението и съхраняването на част
                    или на цялото съдържание в каквато и да е форма без предварителното писмено
                    съгласие на Столична община, освен в случаите изрично посочени в настоящите
                    условия.
                  </p>
                </section>

                <section>
                  <h2 className="text-2xl font-bold text-gray-900 mb-4">
                    5. Отговорности и ограничения
                  </h2>
                  <p className="text-gray-700 mb-4">
                    Предлаганата информация е коректна и актуална към момента на публикуване, но
                    Столична община не гарантира, че приложението не съдържа неточности и пропуски,
                    както и закъснения в обновяването на данните и че достъпът до тях е
                    непрекъсваем.
                  </p>
                  <p className="text-gray-700 mb-4">
                    Столична община не носи отговорност за последствия, предизвикани от действия на
                    потребители на приложението, както и щети, пропуснати ползи или прекъсване на
                    дейността, които са произтекли от употреба или невъзможност за употреба на
                    съдържащите се в него информационни материали.
                  </p>
                  <p className="text-gray-700 mb-4">
                    Като условие за ползване на приложението, се смята, че потребителят приема да не
                    ползва предоставената му информация за каквато и да е дейност, забранена от
                    закона, нарушаваща добрите практики или неотговаряща на тези правила.
                  </p>
                </section>

                <section>
                  <h2 className="text-2xl font-bold text-gray-900 mb-4">
                    6. Сигурност и защита на данните
                  </h2>
                  <p className="text-gray-700 mb-4">
                    Приложението използва криптиране и други технологии за осигуряване на
                    сигурността на данните.
                  </p>
                  <p className="text-gray-700 mb-4">
                    Потребителите са длъжни да използват приложението само за разрешените цели и да
                    не се опитват да пробиват сигурността или да манипулират функционалността му.
                  </p>
                  <p className="text-gray-700 mb-4">
                    Всеки потребител, който забележи нередности или има съмнения за нарушения на
                    сигурността, е длъжен незабавно да уведоми Столична община.
                  </p>
                </section>

                <section>
                  <h2 className="text-2xl font-bold text-gray-900 mb-4">
                    7. Политика за поверителност
                  </h2>
                  <h3 className="text-xl font-bold text-gray-800 mb-3">
                    7.1. Събиране на лични данни
                  </h3>
                  <p className="text-gray-700 mb-4">
                    Столична община има право да събира и съхранява доброволно предоставени от
                    потребителите лични данни. Личните данни се събират, обработват и съхраняват
                    съгласно изискванията на Общия регламент за защита на данните (GDPR) и
                    законодателството на Република България за защита на личните данни.
                  </p>
                  <p className="text-gray-700 mb-4">Събираните данни могат да включват:</p>
                  <ul className="list-disc pl-6 text-gray-700 space-y-2 mb-4">
                    <li>Имена и данни за идентификация (при регистрация чрез е-Автентикация)</li>
                    <li>Адрес (постоянен или настоящ)</li>
                    <li>Електронен адрес и телефонен номер</li>
                    <li>Данни за местоположение (при използване на картата)</li>
                    <li>Информация за използваното устройство и операционна система</li>
                    <li>Настройки на известия и предпочитания</li>
                  </ul>

                  <h3 className="text-xl font-bold text-gray-800 mb-3">
                    7.2. Цели на обработка на данните
                  </h3>
                  <p className="text-gray-700 mb-4">
                    Личните данни се обработват за следните цели:
                  </p>
                  <ul className="list-disc pl-6 text-gray-700 space-y-2 mb-4">
                    <li>Предоставяне на услугите в приложението</li>
                    <li>Персонализиране на съдържанието и известията</li>
                    <li>Подобряване на функционалността на приложението</li>
                    <li>Комуникация с потребителите</li>
                    <li>Спазване на законови изисквания</li>
                    <li>Защита срещу злоупотреби и измами</li>
                  </ul>

                  <h3 className="text-xl font-bold text-gray-800 mb-3">
                    7.3. Права на потребителите
                  </h3>
                  <p className="text-gray-700 mb-4">
                    Потребителите имат следните права относно техните лични данни:
                  </p>
                  <ul className="list-disc pl-6 text-gray-700 space-y-2 mb-4">
                    <li>Право на достъп до личните данни</li>
                    <li>Право на коригиране на неточни данни</li>
                    <li>Право на изтриване на данни (&quot;право да бъдеш забравен&quot;)</li>
                    <li>Право на ограничаване на обработката</li>
                    <li>Право на преносимост на данните</li>
                    <li>Право на възражение срещу обработката</li>
                  </ul>
                  <p className="text-gray-700 mb-4">
                    Приложението дава възможност на регистриран потребител да изтегли файл, съдържащ
                    цялата информация, свързана със създадения акаунт, както и да заяви изтриване на
                    данните си.
                  </p>
                  <p className="text-gray-700 mb-4">
                    Повече информация за правата на потребителите можете да намерите на{' '}
                    <a
                      href="https://www.sofia.bg/en/protection-of-personal-data"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:underline"
                    >
                      https://www.sofia.bg/en/protection-of-personal-data
                    </a>
                    .
                  </p>

                  <h3 className="text-xl font-bold text-gray-800 mb-3">7.4. Съхранение на данни</h3>
                  <p className="text-gray-700 mb-4">
                    Личните данни се съхраняват толкова дълго, колкото е необходимо за постигане на
                    целите, за които са събрани, или докато потребителят не поиска тяхното
                    изтриване.
                  </p>
                  <p className="text-gray-700 mb-4">
                    Потребителски акаунти, които не са използвани повече от 90 дни, могат да бъдат
                    изтрити. Потребителите могат да регистрират нов акаунт по всяко време.
                  </p>

                  <h3 className="text-xl font-bold text-gray-800 mb-3">
                    7.5. Споделяне на данни с трети страни
                  </h3>
                  <p className="text-gray-700 mb-4">
                    Столична община не споделя личните данни на потребителите с трети страни, освен
                    в следните случаи:
                  </p>
                  <ul className="list-disc pl-6 text-gray-700 space-y-2 mb-4">
                    <li>При изрично съгласие от страна на потребителя</li>
                    <li>За спазване на законови изисквания</li>
                    <li>
                      За защита на правата и сигурността на Столична община и други потребители
                    </li>
                    <li>
                      С доставчици на услуги, които обработват данни от наше име (например хостинг
                      услуги)
                    </li>
                  </ul>

                  <h3 className="text-xl font-bold text-gray-800 mb-3">7.6. Бисквитки</h3>
                  <p className="text-gray-700 mb-4">
                    Мобилното приложение използва технологии за локално съхранение на данни (подобни
                    на бисквитки в уеб браузърите) за подобряване на потребителското изживяване и за
                    запазване на предпочитания като избран език и настройки за известия.
                  </p>
                  <p className="text-gray-700 mb-4">
                    Потребителите могат да управляват тези настройки чрез менюто на приложението.
                  </p>
                </section>

                <section>
                  <h2 className="text-2xl font-bold text-gray-900 mb-4">8. Известия</h2>
                  <p className="text-gray-700 mb-4">
                    При регистрация за получаване на известия (push notifications), свързани с
                    градски новини, събития и важни съобщения, Вие се съгласявате да получавате
                    такива.
                  </p>
                  <p className="text-gray-700 mb-4">
                    Потребителите могат по всяко време да управляват настройките за известия или да
                    ги деактивират напълно чрез настройките на приложението или на устройството.
                  </p>
                </section>

                <section>
                  <h2 className="text-2xl font-bold text-gray-900 mb-4">
                    9. Връзки към външни сайтове
                  </h2>
                  <p className="text-gray-700 mb-4">
                    С цел да улесни достъпа до информация, приложението може да съдържа връзки към
                    външни уебсайтове, които са притежание или се управляват от трети страни.
                  </p>
                  <p className="text-gray-700 mb-4">
                    При свързването си с такъв сайт, Вие трябва да приемете неговите изисквания за
                    ползване. Столична община няма контрол върху съдържанието на тези сайтове и не
                    може да поеме отговорност за материали, създадени или публикувани от такива
                    сайтове. Връзката към външен сайт не предполага, че Столична община одобрява
                    сайта или продуктите и услугите, за които се отнася той.
                  </p>
                </section>

                <section>
                  <h2 className="text-2xl font-bold text-gray-900 mb-4">
                    10. Модификации и актуализации
                  </h2>
                  <p className="text-gray-700 mb-4">
                    Столична община си запазва правото да модифицира тези условия по всяко време,
                    без предварително известяване. Направените промени влизат в сила в момента на
                    публикуването им в приложението.
                  </p>
                  <p className="text-gray-700 mb-4">
                    Столична община има право да добавя и спира услуги в приложението, да променя
                    структурата и начина за достъп, както и да прекрати използването им от страна на
                    отделни или всички свои потребители.
                  </p>
                  <p className="text-gray-700 mb-4">
                    Желателно е периодично да проверявате тази страница за извършени корекции и
                    допълнения. Продължаващото използване на приложението след промени в условията
                    се счита за приемане на новите условия.
                  </p>
                </section>

                <section>
                  <h2 className="text-2xl font-bold text-gray-900 mb-4">
                    11. Прекратяване на достъп
                  </h2>
                  <p className="text-gray-700 mb-4">
                    Столична община има право да прекрати едностранно и без предизвестие достъпа до
                    предоставените услуги, ако потребителят с действията си накърнява доброто име на
                    Столична община, нарушава действащото законодателство в Република България,
                    международните актове или застрашава функционалността на приложението, както и
                    ако застрашава или препятства използването му от страна на други потребители.
                  </p>
                  <p className="text-gray-700 mb-4">
                    Вие можете да прекратите използването на приложението по всяко време като го
                    деинсталирате от устройството си и заявите изтриване на Вашия профил (ако имате
                    такъв).
                  </p>
                </section>

                <section>
                  <h2 className="text-2xl font-bold text-gray-900 mb-4">
                    12. Приложимо законодателство
                  </h2>
                  <p className="text-gray-700 mb-4">
                    Настоящите условия се дефинират и тълкуват в съответствие със законите на
                    Република България.
                  </p>
                  <p className="text-gray-700 mb-4">
                    За всички неуредени в тези общи условия въпроси се прилагат разпоредбите на
                    действащото в Република България законодателство.
                  </p>
                </section>

                <section>
                  <h2 className="text-2xl font-bold text-gray-900 mb-4">13. Контакти</h2>
                  <p className="text-gray-700 mb-4">
                    Ако имате въпроси, коментари и предложения относно условията за ползване или
                    проблеми при работата с приложението, можете да се свържете с нас:
                  </p>
                  <ul className="list-none pl-0 text-gray-700 space-y-2 mb-4">
                    <li>
                      <strong>Уебсайт:</strong>{' '}
                      <a
                        href="https://call.sofia.bg"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:underline"
                      >
                        call.sofia.bg
                      </a>
                    </li>
                  </ul>
                </section>

                <section>
                  <h2 className="text-2xl font-bold text-gray-900 mb-4">
                    14. Приемане на условията
                  </h2>
                  <p className="text-gray-700 mb-4">
                    С използването на мобилното приложение &quot;Твоята София&quot;, Вие
                    декларирате, че сте прочели, разбрали и приемате настоящите Общи условия и
                    Политика за поверителност.
                  </p>
                  <p className="text-gray-700 mb-4">
                    Настоящите условия гарантират прозрачност, сигурност и защита на правата на
                    всички потребители на приложението.
                  </p>
                </section>

                <div className="mt-8 pt-6 border-t border-gray-200 text-sm text-gray-600">
                  <p>Последна актуализация: Януари 2026</p>
                  <p className="mt-2">© 2026 Столична община. Всички права запазени.</p>
                </div>
              </div>
            )}

            {/* English Version */}
            {language === 'en' && (
              <div className="prose prose-lg max-w-none">
                <section>
                  <h2 className="text-2xl font-bold text-gray-900 mb-4">1. General Provisions</h2>
                  <p className="text-gray-700 mb-4">
                    The mobile application &quot;Your Sofia&quot; is owned by Sofia Municipality and
                    is intended to provide information and services to the residents of Sofia.
                  </p>
                  <p className="text-gray-700 mb-4">
                    By accessing and using the mobile application &quot;Your Sofia&quot;, you accept
                    these Terms of Use. If you do not agree with these terms, please do not use the
                    application.
                  </p>
                </section>

                <section>
                  <h2 className="text-2xl font-bold text-gray-900 mb-4">
                    2. Description of Services
                  </h2>
                  <p className="text-gray-700 mb-4">
                    The mobile application &quot;Your Sofia&quot; provides the following main
                    functionalities:
                  </p>
                  <ul className="list-disc pl-6 text-gray-700 space-y-2 mb-4">
                    <li>News and notifications from Sofia Municipality</li>
                    <li>Realtime air quality information in Sofia</li>
                    <li>
                      Navigate a map with city objects and submit reports about their condition
                    </li>
                    <li>Access to municipal services and information</li>
                    <li>Personalized alerts and notifications</li>
                  </ul>
                  <p className="text-gray-700 mb-4">
                    Sofia Municipality reserves the right to update the list of provided services by
                    publishing a notice in the application.
                  </p>
                </section>

                <section>
                  <h2 className="text-2xl font-bold text-gray-900 mb-4">
                    3. Registration and Access
                  </h2>
                  <p className="text-gray-700 mb-4">
                    Access to the basic functionalities of the application is free and does not
                    require registration. Some advanced services may require creating a user profile
                    through certified electronic means (e.g., eAuthentication, qualified electronic
                    signature).
                  </p>
                  <p className="text-gray-700 mb-4">
                    Upon registration, users undertake to provide true, genuine and accurate
                    information. In case of entering incorrect or misleading information, the user
                    may be deprived of the right to access the application&apos;s services.
                  </p>
                  <p className="text-gray-700 mb-4">
                    Registered users are responsible for all actions performed on behalf of their
                    profile and must not provide third parties with the password to access their
                    profile.
                  </p>
                </section>

                <section>
                  <h2 className="text-2xl font-bold text-gray-900 mb-4">
                    4. Copyright and Intellectual Property
                  </h2>
                  <p className="text-gray-700 mb-4">
                    The design, structure and content of the mobile application &quot;Your
                    Sofia&quot; are subject to copyright owned by Sofia Municipality.
                  </p>
                  <p className="text-gray-700 mb-4">
                    The information presented in the application is freely accessible and is
                    intended for personal, public and non-commercial use. Saving information is
                    permitted only for personal non-commercial purposes.
                  </p>
                  <p className="text-gray-700 mb-4">
                    Copying, transmitting, distributing and storing part or all of the content in
                    any form without prior written consent from Sofia Municipality is prohibited,
                    except in cases explicitly stated in these terms.
                  </p>
                </section>

                <section>
                  <h2 className="text-2xl font-bold text-gray-900 mb-4">
                    5. Responsibilities and Limitations
                  </h2>
                  <p className="text-gray-700 mb-4">
                    The information provided is correct and up-to-date at the time of publication,
                    but Sofia Municipality does not guarantee that the application does not contain
                    inaccuracies and omissions, as well as delays in data updates and that access to
                    them is uninterrupted.
                  </p>
                  <p className="text-gray-700 mb-4">
                    Sofia Municipality is not responsible for consequences caused by actions of
                    application users, as well as damages, lost profits or business interruption
                    resulting from use or inability to use the information materials contained
                    therein.
                  </p>
                  <p className="text-gray-700 mb-4">
                    As a condition for using the application, it is considered that the user agrees
                    not to use the information provided to them for any activity prohibited by law,
                    violating good practices or inconsistent with these rules.
                  </p>
                </section>

                <section>
                  <h2 className="text-2xl font-bold text-gray-900 mb-4">
                    6. Security and Data Protection
                  </h2>
                  <p className="text-gray-700 mb-4">
                    The application uses encryption and other technologies to ensure data security.
                  </p>
                  <p className="text-gray-700 mb-4">
                    Users must use the application only for permitted purposes and must not attempt
                    to breach security or manipulate its functionality.
                  </p>
                  <p className="text-gray-700 mb-4">
                    Any user who notices irregularities or has suspicions of security breaches must
                    immediately notify Sofia Municipality.
                  </p>
                </section>

                <section>
                  <h2 className="text-2xl font-bold text-gray-900 mb-4">7. Privacy Policy</h2>
                  <h3 className="text-xl font-bold text-gray-800 mb-3">
                    7.1. Collection of Personal Data
                  </h3>
                  <p className="text-gray-700 mb-4">
                    Sofia Municipality has the right to collect and store voluntarily provided
                    personal data from users. Personal data is collected, processed and stored in
                    accordance with the requirements of the General Data Protection Regulation
                    (GDPR) and the legislation of the Republic of Bulgaria on personal data
                    protection.
                  </p>
                  <p className="text-gray-700 mb-4">Collected data may include:</p>
                  <ul className="list-disc pl-6 text-gray-700 space-y-2 mb-4">
                    <li>Names and identification data (when registering via eAuthentication)</li>
                    <li>Address (permanent or current)</li>
                    <li>Email address and phone number</li>
                    <li>Location data (when using the map)</li>
                    <li>Information about the device used and operating system</li>
                    <li>Notification settings and preferences</li>
                  </ul>

                  <h3 className="text-xl font-bold text-gray-800 mb-3">
                    7.2. Purposes of Data Processing
                  </h3>
                  <p className="text-gray-700 mb-4">
                    Personal data is processed for the following purposes:
                  </p>
                  <ul className="list-disc pl-6 text-gray-700 space-y-2 mb-4">
                    <li>Providing services in the application</li>
                    <li>Personalizing content and notifications</li>
                    <li>Improving application functionality</li>
                    <li>Communicating with users</li>
                    <li>Compliance with legal requirements</li>
                    <li>Protection against abuse and fraud</li>
                  </ul>

                  <h3 className="text-xl font-bold text-gray-800 mb-3">7.3. User Rights</h3>
                  <p className="text-gray-700 mb-4">
                    Users have the following rights regarding their personal data:
                  </p>
                  <ul className="list-disc pl-6 text-gray-700 space-y-2 mb-4">
                    <li>Right of access to personal data</li>
                    <li>Right to correct inaccurate data</li>
                    <li>Right to deletion of data (&quot;right to be forgotten&quot;)</li>
                    <li>Right to restriction of processing</li>
                    <li>Right to data portability</li>
                    <li>Right to object to processing</li>
                  </ul>
                  <p className="text-gray-700 mb-4">
                    The application allows a registered user to download a file containing all
                    information related to the created account, as well as to request deletion of
                    their data.
                  </p>
                  <p className="text-gray-700 mb-4">
                    More information about user rights can be found at{' '}
                    <a
                      href="https://www.sofia.bg/en/protection-of-personal-data"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:underline"
                    >
                      https://www.sofia.bg/en/protection-of-personal-data
                    </a>
                    .
                  </p>

                  <h3 className="text-xl font-bold text-gray-800 mb-3">7.4. Data Storage</h3>
                  <p className="text-gray-700 mb-4">
                    Personal data is stored for as long as necessary to achieve the purposes for
                    which it was collected, or until the user requests its deletion.
                  </p>
                  <p className="text-gray-700 mb-4">
                    User accounts that have not been used for more than 90 days may be deleted.
                    Users can register a new account at any time.
                  </p>

                  <h3 className="text-xl font-bold text-gray-800 mb-3">
                    7.5. Sharing Data with Third Parties
                  </h3>
                  <p className="text-gray-700 mb-4">
                    Sofia Municipality does not share users&apos; personal data with third parties,
                    except in the following cases:
                  </p>
                  <ul className="list-disc pl-6 text-gray-700 space-y-2 mb-4">
                    <li>With express consent from the user</li>
                    <li>To comply with legal requirements</li>
                    <li>
                      To protect the rights and security of Sofia Municipality and other users
                    </li>
                    <li>
                      With service providers who process data on our behalf (e.g., hosting services)
                    </li>
                  </ul>

                  <h3 className="text-xl font-bold text-gray-800 mb-3">7.6. Cookies</h3>
                  <p className="text-gray-700 mb-4">
                    The mobile application uses local data storage technologies (similar to cookies
                    in web browsers) to improve user experience and to save preferences such as
                    language selection and notification settings.
                  </p>
                  <p className="text-gray-700 mb-4">
                    Users can manage these settings through the application menu.
                  </p>
                </section>

                <section>
                  <h2 className="text-2xl font-bold text-gray-900 mb-4">8. Notifications</h2>
                  <p className="text-gray-700 mb-4">
                    By registering to receive notifications (push notifications) related to city
                    news, events and important messages, you agree to receive them.
                  </p>
                  <p className="text-gray-700 mb-4">
                    Users can manage notification settings or deactivate them completely at any time
                    through the application or device settings.
                  </p>
                </section>

                <section>
                  <h2 className="text-2xl font-bold text-gray-900 mb-4">
                    9. Links to External Sites
                  </h2>
                  <p className="text-gray-700 mb-4">
                    To facilitate access to information, the application may contain links to
                    external websites owned or managed by third parties.
                  </p>
                  <p className="text-gray-700 mb-4">
                    When connecting to such a site, you must accept its terms of use. Sofia
                    Municipality has no control over the content of these sites and cannot assume
                    responsibility for materials created or published by such sites. A link to an
                    external site does not imply that Sofia Municipality approves the site or the
                    products and services it relates to.
                  </p>
                </section>

                <section>
                  <h2 className="text-2xl font-bold text-gray-900 mb-4">
                    10. Modifications and Updates
                  </h2>
                  <p className="text-gray-700 mb-4">
                    Sofia Municipality reserves the right to modify these terms at any time without
                    prior notice. Changes made take effect at the time of their publication in the
                    application.
                  </p>
                  <p className="text-gray-700 mb-4">
                    Sofia Municipality has the right to add and remove services in the application,
                    to change the structure and access method, as well as to terminate their use by
                    individual or all users.
                  </p>
                  <p className="text-gray-700 mb-4">
                    It is advisable to periodically check this page for corrections and additions.
                    Continued use of the application after changes to the terms is considered
                    acceptance of the new terms.
                  </p>
                </section>

                <section>
                  <h2 className="text-2xl font-bold text-gray-900 mb-4">
                    11. Termination of Access
                  </h2>
                  <p className="text-gray-700 mb-4">
                    Sofia Municipality has the right to unilaterally and without notice terminate
                    access to the provided services if the user&apos;s actions damage the reputation
                    of Sofia Municipality, violate the current legislation of the Republic of
                    Bulgaria, international acts or threaten the functionality of the application,
                    as well as if they threaten or prevent its use by other users.
                  </p>
                  <p className="text-gray-700 mb-4">
                    You can terminate your use of the application at any time by uninstalling it
                    from your device and requesting deletion of your profile (if you have one).
                  </p>
                </section>

                <section>
                  <h2 className="text-2xl font-bold text-gray-900 mb-4">12. Applicable Law</h2>
                  <p className="text-gray-700 mb-4">
                    These terms are defined and interpreted in accordance with the laws of the
                    Republic of Bulgaria.
                  </p>
                  <p className="text-gray-700 mb-4">
                    For all matters not covered in these general terms, the provisions of the
                    current legislation of the Republic of Bulgaria shall apply.
                  </p>
                </section>

                <section>
                  <h2 className="text-2xl font-bold text-gray-900 mb-4">13. Contact</h2>
                  <p className="text-gray-700 mb-4">
                    If you have questions, comments and suggestions regarding the terms of use or
                    problems with the application, you can contact us:
                  </p>
                  <ul className="list-none pl-0 text-gray-700 space-y-2 mb-4">
                    <li>
                      <strong>Website:</strong>{' '}
                      <a
                        href="https://call.sofia.bg"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:underline"
                      >
                        call.sofia.bg
                      </a>
                    </li>
                  </ul>
                </section>

                <section>
                  <h2 className="text-2xl font-bold text-gray-900 mb-4">14. Acceptance of Terms</h2>
                  <p className="text-gray-700 mb-4">
                    By using the mobile application &quot;Your Sofia&quot;, you declare that you
                    have read, understood and accept these Terms of Use and Privacy Policy.
                  </p>
                  <p className="text-gray-700 mb-4">
                    These terms guarantee transparency, security and protection of the rights of all
                    application users.
                  </p>
                </section>

                <div className="mt-8 pt-6 border-t border-gray-200 text-sm text-gray-600">
                  <p>Last updated: January 2026</p>
                  <p className="mt-2">© 2026 Sofia Municipality. All rights reserved.</p>
                </div>
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
