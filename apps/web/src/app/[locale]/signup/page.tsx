import { auth, resolveSessionUserId } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { SignupForm } from './SignupForm'

export const dynamic = 'force-dynamic'

export default async function SignupPage() {
  const session = await auth()
  const userId = await resolveSessionUserId(session)
  if (session?.user && userId) redirect('/dashboard')

  return (
    <main className="min-h-screen bg-cream flex items-center justify-center">
      <div className="w-full max-w-sm px-6 py-10">
        <h1 className="font-serif text-3xl text-ink mb-2 text-center">
          HelpNest
        </h1>
        <p className="text-muted text-sm text-center mb-8">
          Create your account
        </p>
        <SignupForm />
      </div>
    </main>
  )
}
