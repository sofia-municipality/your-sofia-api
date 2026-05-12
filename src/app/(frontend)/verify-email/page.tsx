import { redirect } from 'next/navigation'
import { getServerSideURL } from '@/utilities/getURL'

interface Props {
  searchParams: Promise<{ token?: string }>
}

export default async function VerifyEmailPage({ searchParams }: Props) {
  const { token } = await searchParams

  if (!token) {
    redirect('/for-users/faq#registration')
  }

  try {
    const res = await fetch(`${getServerSideURL()}/api/users/verify/${token}`, {
      method: 'GET',
      cache: 'no-store',
    })

    if (!res.ok) {
      redirect('/for-users/faq#registration')
    }
  } catch {
    redirect('/for-users/faq#registration')
  }

  redirect('/for-users/faq#registration')
}
