import { RegisterPage, type RegisterFilters } from '@/features/bookings';
export const dynamic = 'force-dynamic';
export default async function Page({ searchParams }: {
    searchParams: Promise<RegisterFilters>;
}) { return <RegisterPage filters={await searchParams}/>; }
