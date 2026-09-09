import { redirect } from 'next/navigation';
import { getDashboardSession } from '@/lib/dashboard/session';
export default async function Layout({ children }: {
    children: React.ReactNode;
}) {
    const session = await getDashboardSession();
    if (!session)
        redirect('/login');
    if (!session.permissions.includes('manage_booking_register'))
        return <div className="rounded-lg border p-6"><h1 className="text-xl font-semibold">Bookings & Settlements</h1><p className="mt-3 text-sm text-muted-foreground">Your account does not have access to the financial booking register. Access is managed by the platform administrator.</p></div>;
    return children;
}
