import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

interface UseSignedUrlOptions {
  bucket: string;
  path: string | null;
  expiresIn?: number; // seconds, default 1 hour
}

export const useSignedUrl = ({ bucket, path, expiresIn = 3600 }: UseSignedUrlOptions) => {
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!path) {
      setSignedUrl(null);
      return;
    }

    const getSignedUrl = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const { data, error: signedUrlError } = await supabase.storage
          .from(bucket)
          .createSignedUrl(path, expiresIn);

        if (signedUrlError) {
          console.error('Error creating signed URL:', signedUrlError);
          setError(signedUrlError.message);
          setSignedUrl(null);
        } else {
          setSignedUrl(data.signedUrl);
        }
      } catch (err) {
        console.error('Error creating signed URL:', err);
        setError('Failed to create signed URL');
        setSignedUrl(null);
      } finally {
        setIsLoading(false);
      }
    };

    getSignedUrl();
  }, [bucket, path, expiresIn]);

  return { signedUrl, isLoading, error };
};

// Helper function to extract file path from a stored URL
export const extractPathFromStorageUrl = (url: string | null, bucket: string): string | null => {
  if (!url) return null;
  
  // Check if it's already just a path (not a full URL)
  if (!url.startsWith('http')) {
    return url;
  }

  // Extract the path from the full Supabase storage URL
  // URL format: https://<project>.supabase.co/storage/v1/object/public/<bucket>/<path>
  // or: https://<project>.supabase.co/storage/v1/object/sign/<bucket>/<path>?token=...
  const patterns = [
    `/storage/v1/object/public/${bucket}/`,
    `/storage/v1/object/sign/${bucket}/`,
  ];

  for (const pattern of patterns) {
    const index = url.indexOf(pattern);
    if (index !== -1) {
      let path = url.substring(index + pattern.length);
      // Remove query parameters (like ?token=...)
      const queryIndex = path.indexOf('?');
      if (queryIndex !== -1) {
        path = path.substring(0, queryIndex);
      }
      return decodeURIComponent(path);
    }
  }

  // If we can't parse the URL, return the original value
  // This handles cases where the stored value is already just the path
  return url;
};

// Hook specifically for avatar URLs that handles both old public URLs and paths
export const useAvatarUrl = (storedUrl: string | null) => {
  const path = extractPathFromStorageUrl(storedUrl, 'contact-avatars');
  return useSignedUrl({ bucket: 'contact-avatars', path });
};
