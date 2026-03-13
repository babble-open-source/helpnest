'use client';
import Link from 'next/link';
export function DefaultPasswordBanner() {
    return (<div className="bg-amber-50 border-b border-amber-200 px-6 py-3 flex items-center justify-between gap-4">
      <p className="text-sm text-amber-800">
        <span className="font-medium">Security notice:</span> You&apos;re using the default password.
        Please change it to secure your account.
      </p>
      <Link href="/dashboard/settings" className="shrink-0 text-sm font-medium text-amber-900 underline underline-offset-2 hover:text-amber-700">
        Change password →
      </Link>
    </div>);
}
