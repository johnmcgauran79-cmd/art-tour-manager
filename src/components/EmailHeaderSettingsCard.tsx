import { useState, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Mail, Upload, Trash2, Loader2 } from "lucide-react";
import { useGeneralSettings, useUpdateGeneralSetting } from "@/hooks/useGeneralSettings";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export const EmailHeaderSettingsCard = () => {
  const { data: settings } = useGeneralSettings();
  const updateSetting = useUpdateGeneralSetting();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const headerImageUrl = settings?.find(s => s.setting_key === 'email_header_image_url')?.setting_value as string || '';

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast({ title: "Invalid file", description: "Please upload an image file.", variant: "destructive" });
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast({ title: "File too large", description: "Maximum file size is 5MB.", variant: "destructive" });
      return;
    }

    setUploading(true);
    try {
      const fileName = `email-header-${Date.now()}.${file.name.split('.').pop()}`;
      const { error: uploadError } = await supabase.storage
        .from('email-assets')
        .upload(fileName, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from('email-assets')
        .getPublicUrl(fileName);

      await updateSetting.mutateAsync({
        settingKey: 'email_header_image_url',
        value: urlData.publicUrl,
      });
    } catch (error: any) {
      toast({ title: "Upload failed", description: error.message, variant: "destructive" });
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleUrlChange = async (url: string) => {
    await updateSetting.mutateAsync({
      settingKey: 'email_header_image_url',
      value: url,
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Mail className="h-5 w-5" />
          Email Header Image
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="text-sm text-muted-foreground">
          Default header image displayed at the top of all system emails. Individual email templates can override this.
        </div>

        {headerImageUrl && (
          <div className="border rounded-md p-4 bg-[#232628] flex justify-center">
            <img
              src={headerImageUrl}
              alt="Email header preview"
              className="max-h-24 max-w-full object-contain"
            />
          </div>
        )}

        <div className="space-y-2">
          <Label>Image URL</Label>
          <Input
            value={headerImageUrl}
            onChange={(e) => handleUrlChange(e.target.value)}
            placeholder="https://..."
            className="text-xs"
          />
        </div>

        <div className="flex items-center gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileUpload}
            className="hidden"
          />
          <Button
            variant="outline"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
          >
            {uploading ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Upload className="h-4 w-4 mr-1" />}
            Upload New Image
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
