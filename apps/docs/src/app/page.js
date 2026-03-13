import { redirect } from 'next/navigation';
export default function DocsHome() {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
    redirect(`${appUrl}/helpnest/help`);
}
