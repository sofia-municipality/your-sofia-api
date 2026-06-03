import configPromise from '@payload-config'
import { getPayload } from 'payload'

interface Props {
  searchParams: Promise<{ token?: string }>
}

export default async function VerifyEmailPage({ searchParams }: Props) {
  const { token } = await searchParams
  let verified = false
  let error = false

  if (!token) {
    console.log('[verify-email] No token in query params')
    error = true
  } else {
    console.log(`[verify-email] Verifying token via local API: ${token}`)
    try {
      const payload = await getPayload({ config: configPromise })
      verified = await payload.verifyEmail({ collection: 'users', token })
      error = !verified
    } catch (err) {
      console.error('[verify-email] Verify error:', err)
      error = true
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 via-white to-slate-100 py-16">
      <div className="container mx-auto px-4">
        <div className="max-w-2xl mx-auto bg-white border border-slate-200 shadow-xl rounded-[2rem] p-10 text-center">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-blue-100 text-blue-700 text-3xl mb-6">
            {verified ? '✅' : '⚠️'}
          </div>

          <h1 className="text-4xl font-semibold text-slate-900 mb-4">
            {verified ? 'Акаунтът ви е потвърден успешно!' : 'Неуспешна верификация'}
          </h1>

          <p className="text-lg text-slate-600 mb-6 leading-8">
            {verified ? (
              <>
                Вашият имейл беше потвърден успешно. Върнете се в мобилното приложение „Твоята
                София“ и влезте в профила си.
              </>
            ) : (
              <>
                Възможно е линкът да е изтекъл, вече да е използван или да е неправилен. Върнете се
                в мобилното приложение и от екрана за вход изберете „Забравена парола“, за да
                поискате нов линк за потвърждение и да опитате отново.
              </>
            )}
          </p>

          {error && (
            <div className="rounded-3xl bg-slate-50 border border-slate-200 p-6 text-left text-slate-700">
              <p className="font-semibold text-slate-900 mb-2">Какво можете да направите:</p>
              <ul className="list-disc list-inside space-y-2">
                <li>Отворете мобилното приложение „Твоята София“.</li>
                <li>
                  Изберете бутона Вход от екрана Профил и след това „Забравена парола“ за да
                  поискате нов линк за потвърждение.
                </li>
                <li>
                  Ако проблемът продължава, проверете папката за спам или се свържете с поддръжката.
                </li>
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
