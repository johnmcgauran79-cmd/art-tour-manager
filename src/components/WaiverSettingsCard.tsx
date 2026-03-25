import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { FileText, Save, Eye, Plus, Loader2, CheckCircle, Shield, User } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";

export const WaiverSettingsCard = () => {
  const [waiverText, setWaiverText] = useState("");
  const [waiverVersion, setWaiverVersion] = useState(1);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [originalText, setOriginalText] = useState("");
  const [previewOpen, setPreviewOpen] = useState(false);
  const [bumpVersionOpen, setBumpVersionOpen] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    setLoading(true);
    try {
      const { data: textData } = await supabase
        .from("general_settings")
        .select("setting_value")
        .eq("setting_key", "waiver_form_text")
        .single();

      const { data: versionData } = await supabase
        .from("general_settings")
        .select("setting_value")
        .eq("setting_key", "waiver_form_version")
        .single();

      let parsedText = "";
      if (textData?.setting_value) {
        parsedText = typeof textData.setting_value === "string"
          ? textData.setting_value
          : JSON.stringify(textData.setting_value);
        // Handle double-JSON-encoded strings
        try {
          const inner = JSON.parse(parsedText);
          if (typeof inner === "string") parsedText = inner;
        } catch { /* already plain */ }
      }

      setWaiverText(parsedText);
      setOriginalText(parsedText);
      setWaiverVersion(
        typeof versionData?.setting_value === "number"
          ? versionData.setting_value
          : Number(versionData?.setting_value) || 1
      );
    } catch (err) {
      console.error("Failed to load waiver settings:", err);
    }
    setLoading(false);
  };

  const handleTextChange = (value: string) => {
    setWaiverText(value);
    setHasChanges(value !== originalText);
  };

  const handleSave = async (bumpVersion = false) => {
    setSaving(true);
    try {
      const newVersion = bumpVersion ? waiverVersion + 1 : waiverVersion;

      // Upsert waiver text
      const { error: textError } = await supabase
        .from("general_settings")
        .upsert(
          {
            setting_key: "waiver_form_text",
            setting_value: waiverText as any,
            description: "Waiver form text shown to customers",
          },
          { onConflict: "setting_key" }
        );

      if (textError) throw textError;

      // Upsert waiver version
      const { error: versionError } = await supabase
        .from("general_settings")
        .upsert(
          {
            setting_key: "waiver_form_version",
            setting_value: newVersion as any,
            description: "Current waiver form version number",
          },
          { onConflict: "setting_key" }
        );

      if (versionError) throw versionError;

      setWaiverVersion(newVersion);
      setOriginalText(waiverText);
      setHasChanges(false);
      setBumpVersionOpen(false);

      toast.success(
        bumpVersion
          ? `Waiver saved and version bumped to v${newVersion}`
          : "Waiver text saved successfully"
      );
    } catch (err: any) {
      console.error("Failed to save waiver settings:", err);
      toast.error("Failed to save waiver settings");
    }
    setSaving(false);
  };

  // Render waiver text with proper formatting (same as SignWaiver page)
  const renderWaiverText = (text: string) => {
    const lines = text.split("\\n").join("\n").split("\n");
    return lines.map((line, i) => {
      const trimmed = line.trim();
      if (!trimmed) return <br key={i} />;
      if (/^\d+\.\s+/.test(trimmed) && trimmed.endsWith(":")) {
        return (
          <h4 key={i} className="font-semibold text-base mt-4 mb-1">
            {trimmed}
          </h4>
        );
      }
      if (trimmed === "Acceptance of Terms:") {
        return (
          <h4 key={i} className="font-semibold text-base mt-4 mb-1">
            {trimmed}
          </h4>
        );
      }
      return (
        <p key={i} className="text-sm leading-relaxed mb-2">
          {trimmed}
        </p>
      );
    });
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Waiver Form Settings
            </div>
            <Badge variant="secondary">Version {waiverVersion}</Badge>
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Configure the waiver text that customers must review and sign before their tour. 
            Changes to the text require a version bump to track which version each customer signed.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="waiver-text" className="font-medium">
              Waiver Text
            </Label>
            <p className="text-xs text-muted-foreground">
              Use line breaks to separate paragraphs. Lines starting with a number and ending with ":" will render as section headers (e.g. "1. Release of Liability:").
            </p>
            <Textarea
              id="waiver-text"
              value={waiverText}
              onChange={(e) => handleTextChange(e.target.value)}
              className="min-h-[300px] font-mono text-sm"
              placeholder="Enter the waiver text that customers will see and agree to..."
            />
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPreviewOpen(true)}
            >
              <Eye className="mr-2 h-4 w-4" />
              Preview
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={() => handleSave(false)}
              disabled={!hasChanges || saving}
            >
              {saving ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Save className="mr-2 h-4 w-4" />
              )}
              Save Text Only
            </Button>

            <Button
              size="sm"
              onClick={() => setBumpVersionOpen(true)}
              disabled={!hasChanges || saving}
            >
              <Plus className="mr-2 h-4 w-4" />
              Save & Bump Version
            </Button>

            {hasChanges && (
              <span className="text-xs text-amber-600 font-medium">
                Unsaved changes
              </span>
            )}
          </div>

          <Separator />

          <div className="text-xs text-muted-foreground space-y-1">
            <p>
              <strong>Save Text Only:</strong> Updates the waiver text without changing the version number. Use for minor typo fixes.
            </p>
            <p>
              <strong>Save & Bump Version:</strong> Updates the text and increments the version number. Use when making meaningful changes — existing signed waivers will retain the version they were signed under.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Preview Dialog */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-3xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>Waiver Preview (v{waiverVersion})</DialogTitle>
            <DialogDescription>
              This is how the waiver will appear to customers on the signing page.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {/* Mock tour info */}
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <FileText className="h-5 w-5 text-green-600" />
                <h3 className="font-semibold text-green-800">Sample Tour Name</h3>
              </div>
              <p className="text-sm text-green-700">
                Monday, 1 January 2026 - Friday, 15 January 2026
              </p>
            </div>

            {/* Waiver text */}
            <div className="space-y-2">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Waiver & Release Form
              </h3>
              <ScrollArea className="h-[300px] border rounded-lg p-4 bg-white">
                <div className="pr-4">{renderWaiverText(waiverText)}</div>
              </ScrollArea>
            </div>

            {/* Mock signature section */}
            <div className="p-4 rounded-lg border bg-white space-y-4">
              <div className="flex items-center gap-2 border-b pb-2">
                <User className="h-5 w-5 text-primary" />
                <h3 className="font-semibold text-lg">Lead Passenger: John Smith</h3>
                <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded">You</span>
              </div>

              <div className="flex items-start gap-3">
                <Checkbox checked={false} disabled className="mt-1" />
                <p className="text-sm leading-relaxed">
                  I have carefully read and understood the terms of this waiver and release form...
                </p>
              </div>

              <div className="space-y-2">
                <Label className="font-medium">Type your full legal name as your digital signature *</Label>
                <Input
                  disabled
                  placeholder="John Smith"
                  className="text-lg font-medium italic"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPreviewOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bump Version Confirmation */}
      <AlertDialog open={bumpVersionOpen} onOpenChange={setBumpVersionOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Bump Waiver Version?</AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <p>
                This will save the updated waiver text and increment the version from <strong>v{waiverVersion}</strong> to <strong>v{waiverVersion + 1}</strong>.
              </p>
              <p>
                Existing signed waivers will retain the version they were signed under. New waivers will use v{waiverVersion + 1}.
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => handleSave(true)} disabled={saving}>
              {saving ? "Saving..." : "Save & Bump Version"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
