import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FolderOpen, Plus } from "lucide-react";
import { useItinerary, useCreateItinerary } from "@/hooks/useItinerary";
import { ItinerarySnapshotSection } from "@/components/itinerary/ItinerarySnapshotSection";
import { useAuth } from "@/hooks/useAuth";

interface TourFilesTabProps {
  tour: {
    id: string;
    startDate: string;
    endDate: string;
  };
}

export const TourFilesTab = ({ tour }: TourFilesTabProps) => {
  const { data: itinerary, isLoading } = useItinerary(tour.id);
  const createItinerary = useCreateItinerary();
  const { userRole } = useAuth();
  const isAgent = userRole === "agent";

  if (isLoading) {
    return (
      <div className="space-y-3 animate-pulse">
        <div className="h-20 bg-muted rounded" />
        <div className="h-20 bg-muted rounded" />
      </div>
    );
  }

  if (!itinerary) {
    return (
      <div className="text-center py-12 border-2 border-dashed rounded-lg">
        <FolderOpen className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
        <h3 className="text-lg font-medium mb-2">No Itinerary Created</h3>
        <p className="text-muted-foreground mb-6">
          Files are stored against this tour's itinerary. Create the itinerary first to upload files.
        </p>
        {!isAgent && (
          <Button
            onClick={() =>
              createItinerary.mutate({
                tourId: tour.id,
                startDate: tour.startDate,
                endDate: tour.endDate,
              })
            }
            disabled={createItinerary.isPending}
          >
            <Plus className="h-4 w-4 mr-2" />
            {createItinerary.isPending ? "Creating..." : "Create Itinerary"}
          </Button>
        )}
      </div>
    );
  }

  const record = itinerary as unknown as Record<string, string | null>;

  const slots = [
    {
      title: "Itinerary Snapshot",
      folder: "itinerary-snapshots",
      pathColumn: "snapshot_file_path",
      nameColumn: "snapshot_file_name",
    },
    {
      title: "Guest Document",
      folder: "guest-documents",
      pathColumn: "guest_document_file_path",
      nameColumn: "guest_document_file_name",
    },
    {
      title: "Brochure",
      folder: "tour-brochures",
      pathColumn: "brochure_file_path",
      nameColumn: "brochure_file_name",
    },
    {
      title: "Tour Itinerary",
      folder: "tour-itinerary-documents",
      pathColumn: "tour_itinerary_file_path",
      nameColumn: "tour_itinerary_file_name",
    },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FolderOpen className="h-5 w-5" />
          Files
        </CardTitle>
        <CardDescription>
          Documents held for this tour. Upload, replace, view or download each file.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4 md:grid-cols-2">
          {slots.map((slot) => (
            <ItinerarySnapshotSection
              key={slot.pathColumn}
              tourId={tour.id}
              itineraryId={itinerary.id}
              snapshotFilePath={record[slot.pathColumn] ?? null}
              snapshotFileName={record[slot.nameColumn] ?? null}
              readOnly={isAgent}
              title={slot.title}
              folder={slot.folder}
              pathColumn={slot.pathColumn}
              nameColumn={slot.nameColumn}
            />
          ))}
        </div>
      </CardContent>
    </Card>
  );
};
