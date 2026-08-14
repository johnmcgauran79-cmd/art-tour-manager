import { useEffect, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { RichTextEditor } from "@/components/ui/rich-text-editor";
import { ConfirmDeleteFileDialog } from "@/components/ConfirmDeleteFileDialog";
import { ImagePlus, Trash2, Save, Loader2, UserRound, FileUp, Link2, Copy, FileText } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useTourWelcomeMessage } from "@/hooks/useTourWelcomeMessage";

interface TourWelcomeMessageTabProps {
  tourId: string;
  tourName: string;
}

const NAVY = "#232628";
const GOLD = "#c79a2e";

export const TourWelcomeMessageTab = ({ tourId, tourName }: TourWelcomeMessageTabProps) => {
  const { data, isLoading, update, uploadImage, removeImage, uploadPickupDoc, removePickupDoc } =
    useTourWelcomeMessage(tourId);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const docInputRef = useRef<HTMLInputElement>(null);
  const [confirmTarget, setConfirm] = useState<"photo" | "doc" | null>(null);
  const { toast } = useToast();

  const [enabled, setEnabled] = useState(false);
  const [heading, setHeading] = useState("Welcome");
  const [body, setBody] = useState("");
  const [signoff, setSignoff] = useState("");
  const [pickupArrival, setPickupArrival] = useState("");
  const [welcomeDrinks, setWelcomeDrinks] = useState("");

  useEffect(() => {
    if (data) {
      setEnabled(data.enabled);
      setHeading(data.heading || "Welcome");
      setBody(data.body || "");
      setSignoff(data.signoff || "");
      setPickupArrival(data.pickupArrivalMessage || "");
      setWelcomeDrinks(data.welcomeDrinksMessage || "");
    }
  }, [data]);

  const handleSave = () => {
    update.mutate({
      enabled,
      heading,
      body,
      signoff,
      pickupArrivalMessage: pickupArrival,
      welcomeDrinksMessage: welcomeDrinks,
    });
  };

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) uploadImage.mutate(file);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleDocFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) uploadPickupDoc.mutate(file);
    if (docInputRef.current) docInputRef.current.value = "";
  };

  const insertDocLink = () => {
    if (!data?.pickupDocUrl) return;
    const link = `<p>For further details, see map <a href="${data.pickupDocUrl}" target="_blank" rel="noopener noreferrer">here</a>.</p>`;
    setPickupArrival((prev) => (prev ? `${prev}${link}` : link));
  };

  const copyDocLink = async () => {
    if (!data?.pickupDocUrl) return;
    await navigator.clipboard.writeText(data.pickupDocUrl);
    toast({ title: "Link copied", description: "Paste it into any message using the link tool." });
  };

  if (isLoading) {
    return <div className="text-muted-foreground p-4">Loading messages...</div>;
  }

  // Body may be rich-text HTML (new) or legacy plain text. Build preview markup accordingly.
  const isHtmlBody = /<[a-z][\s\S]*>/i.test(body);
  const bodyHtml = isHtmlBody
    ? body
    : body
        .split(/\n\s*\n/)
        .map((p) => p.trim())
        .filter(Boolean)
        .map((p) => `<p>${p.replace(/\n/g, "<br>")}</p>`)
        .join("");

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-lg font-semibold">Messages</h3>
          <p className="text-sm text-muted-foreground">
            Reusable tour messages &mdash; the host welcome shown in the guest document, plus
            pickup/arrival and welcome drinks details available to email templates.
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
              <CardTitle className="text-base">Welcome Message</CardTitle>
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
              <p className="text-xs text-muted-foreground">Use the toolbar to format text with bold, italics, lists and line breaks.</p>
              <RichTextEditor
                value={body}
                onChange={setBody}
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
                      onClick={() => setConfirm("photo")}
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
                {bodyHtml ? (
                  <div
                    style={{ fontSize: "13px", lineHeight: 1.6 }}
                    dangerouslySetInnerHTML={{ __html: bodyHtml }}
                  />
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

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Pickup / Arrival Message</CardTitle>
          <CardDescription>
            Where guests should meet if a pickup or arrival transfer is organised. Available in
            email templates as <code>{"{{tour_pickup_arrival_message}}"}</code>.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <RichTextEditor
            value={pickupArrival}
            onChange={setPickupArrival}
            placeholder="e.g. Your driver will meet you in the arrivals hall holding an ART sign..."
          />

          <div className="rounded-md border p-3 space-y-2">
            <Label className="text-sm">Attached Document (e.g. arrivals map PDF)</Label>
            {data?.pickupDocUrl ? (
              <div className="flex flex-wrap items-center gap-2">
                <a
                  href={data.pickupDocUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 text-sm text-primary underline"
                >
                  <FileText className="h-4 w-4" />
                  {data.pickupDocName || "View document"}
                </a>
                <Button variant="outline" size="sm" className="gap-1.5" onClick={insertDocLink}>
                  <Link2 className="h-3.5 w-3.5" /> Insert link in message
                </Button>
                <Button variant="outline" size="sm" className="gap-1.5" onClick={copyDocLink}>
                  <Copy className="h-3.5 w-3.5" /> Copy link
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                  onClick={() => docInputRef.current?.click()}
                  disabled={uploadPickupDoc.isPending}
                >
                  {uploadPickupDoc.isPending ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <FileUp className="h-3.5 w-3.5" />
                  )}
                  Replace
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="gap-1.5 text-destructive hover:text-destructive"
                  onClick={() => setConfirm("doc")}
                  disabled={removePickupDoc.isPending}
                >
                  <Trash2 className="h-3.5 w-3.5" /> Remove
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                  onClick={() => docInputRef.current?.click()}
                  disabled={uploadPickupDoc.isPending}
                >
                  {uploadPickupDoc.isPending ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <FileUp className="h-3.5 w-3.5" />
                  )}
                  Upload Document
                </Button>
                <p className="text-xs text-muted-foreground">
                  PDF, image or document. Once uploaded you can hyperlink it in the message above.
                </p>
              </div>
            )}
            <input
              ref={docInputRef}
              type="file"
              accept=".pdf,.doc,.docx,image/*"
              className="hidden"
              onChange={handleDocFile}
            />
            <p className="text-xs text-muted-foreground">
              Remember to press Save after inserting the link.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Welcome Drinks</CardTitle>
          <CardDescription>
            Where and when guests first meet for welcome drinks or the group gathering. Available
            in email templates as <code>{"{{tour_welcome_drinks_message}}"}</code>.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <RichTextEditor
            value={welcomeDrinks}
            onChange={setWelcomeDrinks}
            placeholder="e.g. Join us in the hotel lobby bar at 6:00pm for welcome drinks..."
          />
        </CardContent>
      </Card>

      <ConfirmDeleteFileDialog
        open={!!confirmTarget}
        onOpenChange={(open) => !open && setConfirm(null)}
        fileName={confirmTarget === "doc" ? (data?.pickupDocName || undefined) : undefined}
        itemLabel={confirmTarget === "doc" ? "document" : "photo"}
        isPending={confirmTarget === "doc" ? removePickupDoc.isPending : removeImage.isPending}
        onConfirm={() => {
          const target = confirmTarget;
          setConfirm(null);
          if (target === "doc") removePickupDoc.mutate();
          else if (target === "photo") removeImage.mutate();
        }}
      />
    </div>
  );
};
