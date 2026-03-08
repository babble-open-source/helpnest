export default function LoginPage() {
  return (
    <main className="min-h-screen bg-cream flex items-center justify-center">
      <div className="w-full max-w-sm px-6">
        <h1 className="font-serif text-3xl text-ink mb-2 text-center">Sign in</h1>
        <p className="text-muted text-sm text-center mb-8">to your HelpNest workspace</p>
        <form action="/api/auth/signin/credentials" method="POST" className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-ink mb-1">Email</label>
            <input
              type="email"
              name="email"
              required
              className="w-full px-3 py-2 border border-border rounded-lg bg-white text-ink placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent"
              placeholder="you@example.com"
            />
          </div>
          <button
            type="submit"
            className="w-full bg-ink text-cream py-2 px-4 rounded-lg hover:bg-ink/90 transition-colors font-medium"
          >
            Continue with Email
          </button>
        </form>
      </div>
    </main>
  )
}
