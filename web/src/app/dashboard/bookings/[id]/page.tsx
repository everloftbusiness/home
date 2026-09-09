import { BookingDetailPage } from '@/features/bookings';
export default async function Page({ params, searchParams }: {
    params: Promise<{
        id: string;
    }>;
    searchParams: Promise<{
        edit?: string;
    }>;
}) { return <BookingDetailPage id={(await params).id} edit={(await searchParams).edit === '1'}/>; }
