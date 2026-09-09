import { NewBookingPage } from '@/features/bookings';
export default async function Page({ searchParams }: {
    searchParams: Promise<{
        property?: string;
    }>;
}) { return <NewBookingPage propertyId={(await searchParams).property}/>; }
