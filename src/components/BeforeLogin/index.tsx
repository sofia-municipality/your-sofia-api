import Link from 'next/link'
import React from 'react'

const BeforeLogin: React.FC = () => {
  return (
    <div>
      <p>
        Добре дошли в административния панел на <b>Твоята София</b>.
      </p>
      <p>
        Нямате профил? <Link href="/admin/register">Регистрирайте се</Link>
      </p>
    </div>
  )
}

export default BeforeLogin
