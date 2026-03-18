import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";

const ViewItinerary = () => {
  const { token } = useParams<{ token: string }>();
  const [html, setHtml] = useState<string>("");
  const [tourName, setTourName] = useState<string>("");
  const [error, setError] = useState<string>("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const validateAndLoad = async () => {
      if (!token) {
        setError("No token provided");
        setLoading(false);
        return;
      }

      try {
        const { data, error: fnError } = await supabase.functions.invoke(
          "validate-itinerary-token",
          { body: { token } }
        );

        if (fnError) {
          setError("Failed to load itinerary. Please try again later.");
          setLoading(false);
          return;
        }

        if (!data.valid) {
          setError(data.error || "Invalid or expired link");
          setLoading(false);
          return;
        }

        setHtml(data.html);
        setTourName(data.tourName || "Tour Itinerary");
      } catch (err) {
        setError("Failed to load itinerary. Please try again later.");
      } finally {
        setLoading(false);
      }
    };

    validateAndLoad();
  }, [token]);

  useEffect(() => {
    if (tourName) {
      document.title = `${tourName} - Itinerary`;
    }
  }, [tourName]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-gray-500" />
          <p className="text-gray-600">Loading itinerary...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center max-w-md mx-auto p-8">
          <div className="bg-white rounded-lg shadow-sm border p-8">
            <h1 className="text-xl font-semibold text-gray-800 mb-2">Unable to Load Itinerary</h1>
            <p className="text-gray-600">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      <div
        dangerouslySetInnerHTML={{ __html: html }}
        className="max-w-4xl mx-auto"
      />
    </div>
  );
};

export default ViewItinerary;
