import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Share2, Copy, Mail, MessageSquare, Check } from "lucide-react";
import { toast } from "sonner";

interface ShareButtonProps {
  /** Title describing what is being shared (e.g. "Melbourne Cup Tour"). */
  title: string;
  /** Optional explicit URL. Defaults to current page URL. */
  url?: string;
  /** Short context line included in messages (e.g. "Tour", "Booking"). */
  context?: string;
  variant?: "outline" | "ghost" | "secondary" | "default";
  size?: "sm" | "icon" | "default";
  className?: string;
  /** Hide the text label (icon only). */
  iconOnly?: boolean;
}

/**
 * Internal share helper. Recipients must be logged-in users — the link
 * deep-links into the admin app and is gated by normal auth/permissions.
 */
export const ShareButton = ({
  title,
  url,
  context,
  variant = "outline",
  size = "sm",
  className,
  iconOnly = false,
}: ShareButtonProps) => {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const shareUrl =
    url ??
    (typeof window !== "undefined" ? window.location.href : "");
  const label = context ? `${context}: ${title}` : title;
  const messageBody = `${label}\n${shareUrl}`;

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      toast.success("Link copied to clipboard");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Could not copy link");
    }
  };

  const openEmail = () => {
    const subject = encodeURIComponent(label);
    const body = encodeURIComponent(messageBody);
    window.open(`mailto:?subject=${subject}&body=${body}`);
  };

  const openTeams = () => {
    // Microsoft Teams "share to Teams" deep link – opens a chat picker.
    const href = encodeURIComponent(shareUrl);
    const msg = encodeURIComponent(label);
    window.open(
      `https://teams.microsoft.com/share?href=${href}&msgText=${msg}`,
      "_blank",
      "noopener,noreferrer"
    );
  };

  return (
    <>
      <Button
        type="button"
        variant={variant}
        size={size}
        className={className}
        onClick={(e) => {
          e.stopPropagation();
          setOpen(true);
        }}
      >
        <Share2 className="h-4 w-4 sm:mr-2" />
        {!iconOnly && <span className="hidden sm:inline">Share</span>}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Share link</DialogTitle>
            <DialogDescription>
              Send this link to a teammate. They'll need to be signed in to view it.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div>
              <Label className="text-xs text-muted-foreground">{context || "Item"}</Label>
              <p className="text-sm font-medium truncate">{title}</p>
            </div>
            <div className="flex items-center gap-2">
              <Input value={shareUrl} readOnly className="text-xs" onFocus={(e) => e.currentTarget.select()} />
              <Button type="button" variant="outline" size="icon" onClick={copyLink} aria-label="Copy link">
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
            <div className="grid grid-cols-2 gap-2 pt-1">
              <Button type="button" variant="outline" onClick={openTeams}>
                <MessageSquare className="h-4 w-4 mr-2" /> Teams
              </Button>
              <Button type="button" variant="outline" onClick={openEmail}>
                <Mail className="h-4 w-4 mr-2" /> Email
              </Button>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default ShareButton;