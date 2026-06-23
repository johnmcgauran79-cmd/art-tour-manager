import { useEffect, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { ImagePlus, Trash2, Save, Loader2, UserRound } from "lucide-react";
import { useTourWelcomeMessage } from "@/hooks/useTourWelcomeMessage";

interface TourWelcomeMessageTabProps {
  tourId: string;
  tourName: string;
}

const NAVY = "#232628";
const GOLD = "#c79a2e";

export const TourWelcomeMessageTab = ({ tourId, tourName }: TourWelcomeMessageTabProps) => {
  const { data, isLoading, update, uploadImage, removeImage } = useTourWelcomeMessage(tourId);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [enabled, setEnabled] = useState(false);
  const [heading, setHeading] = useState("Welcome");
  const [body, setBody] = useState("");
  const [signoff, setSignoff] = useState("");

  useEffect(() => {
    if (data) {
      setEnabled(data.enabled);
      setHeading(data.heading || "Welcome");
      setBody(data.body || "");
      setSignoff(data.signoff || "");
    }
  }, [data]);

  const handleSave = () => {
    update.mutate({ enabled, heading, body, signoff });
  };

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) uploadImage.mutate(file);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  if (isLoading) {
    return <div className="text-muted-foreground p-4">Loading welcome message...</div>;
  }

  const bodyParagraphs = body.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-lg font-semibold">Welcome Message</h3>
          <p className="text-sm text-muted-foreground">
            A personal welcome from the tour host, shown under the main header of the guest
            document &mdash; before the list of tour inclusions.
          </p>
        </div>
        <Button onClick={handleSave} disabled={update.isPending} className="gap-2">
          {update.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Save
        </Button>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Editor */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Content</CardTitle>
              <div className="flex items-center gap-2">
                <Label htmlFor="welcome-enabled" className="text-sm">Include in document</Label>
                <Switch id="welcome-enabled" checked={enabled} onCheckedChange={setEnabled} />
              </div>
            </div>
            <CardDescription>
              When enabled, this can be selected when generating the guest document.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Heading</Label>
              <Input value={heading} onChange={(e) => setHeading(e.target.value)} placeholder="Welcome" />
            </div>
            <div className="space-y-2">
              <Label>Message</Label>
              <p className="text-xs text-muted-foreground">Separate paragraphs with a blank line.</p>
              <Textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={10}
                placeholder="Welcome to the tour..."
              />
            </div>
            <div className="space-y-2">
              <Label>Autograph / Sign-off</Label>
              <Input
                value={signoff}
                onChange={(e) => setSignoff(e.target.value)}
                placeholder="e.g. Belinda"
              />
            </div>
            <div className="space-y-2">
              <Label>Host Photo</Label>
              <div className="flex items-center gap-3">
                {data?.imageUrl ? (
                  <img
                    src={data.imageUrl}
                    alt="Host"
                    className="h-20 w-20 rounded-full object-cover border"
                  />
                ) : (
                  <div className="h-20 w-20 rounded-full bg-muted flex items-center justify-center">
                    <UserRound className="h-8 w-8 text-muted-foreground" />
                  </div>
                )}
                <div className="flex flex-col gap-2">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleFile}
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-2"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploadImage.isPending}
                  >
                    {uploadImage.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <ImagePlus className="h-4 w-4" />
                    )}
                    {data?.imageUrl ? "Replace Photo" : "Upload Photo"}
                  </Button>
                  {data?.imageUrl && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="gap-2 text-destructive hover:text-destructive"
                      onClick={() => removeImage.mutate()}
                      disabled={removeImage.isPending}
                    >
                      <Trash2 className="h-4 w-4" /> Remove
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Live preview */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Document Preview</CardTitle>
            <CardDescription>How it will appear in the guest document.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="rounded-lg border overflow-hidden bg-white">
              <div style={{ background: NAVY, height: 8 }} />
              {data?.imageUrl && (
                <img
                  src={data.imageUrl}
                  alt="Host"
                  className="block w-full object-cover"
                  style={{ maxHeight: 220 }}
                />
              )}
              <div className="p-6 text-center" style={{ color: "#2b2b2b" }}>
                <h2
                  className="uppercase"
                  style={{
                    color: NAVY,
                    fontFamily: "Georgia, serif",
                    fontSize: "20px",
                    letterSpacing: "1px",
                    margin: "0 0 10px",
                  }}
                >
                  {heading || "Welcome"}
                </h2>
                <div
                  style={{ width: 60, height: 2, background: GOLD, margin: "0 auto 16px" }}
                />
                {bodyParagraphs.length > 0 ? (
                  bodyParagraphs.map((p, i) => (
                    <p key={i} style={{ fontSize: "13px", lineHeight: 1.6, margin: "0 0 10px" }}>
                      {p}
                    </p>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground italic">
                    Your welcome message will appear here.
                  </p>
                )}
                {signoff && (
                  <p
                    style={{
                      fontFamily:
                        "'Dancing Script', 'Snell Roundhand', 'Segoe Script', cursive",
                      fontSize: "30px",
                      fontWeight: 600,
                      color: NAVY,
                      marginTop: 18,
                    }}
                  >
                    {signoff}
                  </p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};