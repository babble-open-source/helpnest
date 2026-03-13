import Link from 'next/link';
export default function NotFound() {
    return (<div className="min-h-screen bg-cream flex items-center justify-center">
      <div className="text-center">
        <p className="text-6xl mb-4">🪹</p>
        <h1 className="font-serif text-3xl text-ink mb-2">Workspace not found</h1>
        <p className="text-muted mb-6">This help center doesn&apos;t exist or has been removed.</p>
        <Link href="/" className="text-accent hover:underline">Go home</Link>
      </div>
    </div>);
}
