'use client';
export default function ErrorPage({ reset }: {
    reset: () => void;
}) { return <div role="alert" className="rounded-lg border p-6"><h2 className="font-semibold">The booking register could not be loaded</h2><p className="my-3 text-sm text-muted-foreground">Check your access and database connection. A new installation requires the booking register migration.</p><button className="text-blue-600 underline" onClick={reset}>Try again</button></div>; }
