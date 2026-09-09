import Link from "next/link";
import { notFound, redirect } from "next/navigation";

export const dynamic = "force-dynamic";
export const revalidate = 0;
import { getDashboardSession } from "@/lib/dashboard/session";
import { getProperty, getPropertyLookups, getOwnerOptions } from "@/features/properties/services/properties.service";
import { updatePropertyAction } from "@/features/properties/actions/property.actions";
import { DashboardHero, DashboardSection } from "@/components/dashboard/dashboard-ui";
import { PropertyForm } from "@/components/dashboard/properties/property-form";
import { DeletePropertyButton } from "@/components/dashboard/properties/delete-property-button";
import { Button } from "@/components/ui/button";

import { PropertyCalendarManager } from "@/components/dashboard/properties/property-calendar-manager";

export default async function PropertyDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getDashboardSession();
  if (!session) redirect("/login");
  if (!session.permissions.includes("view_properties") && !session.permissions.includes("manage_properties")) {
    redirect("/dashboard/properties");
  }

  const { id } = await params;
  const [property, lookups, owners] = await Promise.all([getProperty(id), getPropertyLookups(), getOwnerOptions()]);
  if (!property) notFound();

  const canEdit = session.permissions.includes("edit_property") || session.permissions.includes("manage_properties");
  const canDelete = session.permissions.includes("delete_property") || session.permissions.includes("manage_properties");

  return (
    <>
      <DashboardHero
        eyebrow={property.internalCode ?? "Property"}
        userName={property.name}
        description={`${property.typeName ?? "Property"} in ${property.city ?? property.country} — ${property.statusName ?? "no status"}.`}
      />

      {canEdit && (
        <div className="-mt-4 mb-8">
          <Button asChild variant="gold">
            <Link href={`/dashboard/properties/${property.id}/setup`}>Open Setup Dashboard</Link>
          </Button>
        </div>
      )}

      {session.permissions.includes("manage_booking_register") && <div className="mb-6"><Link className="text-sm font-medium text-blue-600 hover:underline" href={`/dashboard/bookings?property=${property.id}`}>View bookings & settlements for this property →</Link></div>}
      <DashboardSection title="Calendar & Airbnb Sync">
        <PropertyCalendarManager
          propertyId={property.id}
          propertySlug={property.slug}
          propertyName={property.name}
        />
      </DashboardSection>

      <DashboardSection title="Property Details">
        {canEdit ? (
          <PropertyForm
            action={updatePropertyAction.bind(null, id)}
            lookups={lookups}
            owners={owners}
            submitLabel="Save Changes"
            initialValues={property}
          />
        ) : (
          <dl className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <dt className="text-muted-foreground">Type</dt>
              <dd className="font-medium">{property.typeName ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Status</dt>
              <dd className="font-medium">{property.statusName ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">City</dt>
              <dd className="font-medium">{property.city ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Owner</dt>
              <dd className="font-medium">{property.ownerName ?? "—"}</dd>
            </div>
          </dl>
        )}

        {canDelete && (
          <div className="mt-8 border-t border-border pt-6">
            <DeletePropertyButton propertyId={property.id} propertyName={property.name} />
          </div>
        )}
      </DashboardSection>
    </>
  );
}
