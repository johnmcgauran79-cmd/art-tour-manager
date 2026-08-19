import { Button } from "@/components/ui/button";
import { MessageCircle } from "lucide-react";
import type { MouseEvent } from "react";
import { isValidWhatsAppPhone } from "@/utils/phoneFormatter";

interface WhatsAppButtonProps {
  phone: string | null | undefined;
  name?: string;
  message?: string;
  variant?: "default" | "outline" | "ghost" | "link";
  size?: "default" | "sm" | "lg" | "icon";
  className?: string;
  showLabel?: boolean;
}

export const WhatsAppButton = ({
  phone,
  name,
  message,
  variant = "outline",
  size = "sm",
  className,
  showLabel = true,
}: WhatsAppButtonProps) => {
  if (!phone || !isValidWhatsAppPhone(phone)) {
    return null;
  }

  // Remove the + prefix for URLs
  const cleanPhone = phone.replace(/^\+/, "");

  // Build the default message
  const defaultMessage = name
    ? `Hi ${name}, this is regarding your booking...`
    : "Hi, this is regarding your booking...";

  // Safety: trim + cap length before we send to an external URL
  const finalMessageRaw = (message ?? defaultMessage).trim();
  const finalMessage = finalMessageRaw.slice(0, 500);

  // Encode the message for URL
  const encodedMessage = encodeURIComponent(finalMessage);

  // Prefer non-wa.me URLs (some networks/proxies block wa.me)
  const webUrl = `https://web.whatsapp.com/send?phone=${cleanPhone}&text=${encodedMessage}`;
  const apiUrl = `https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encodedMessage}`;
  const appUrl = `whatsapp://send?phone=${cleanPhone}&text=${encodedMessage}`;

  const handleClick = (e: MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();

    const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

    if (isMobile) {
      // Try native app first; fall back to web.
      window.location.href = appUrl;
      window.setTimeout(() => {
        window.open(apiUrl, "_blank", "noopener,noreferrer");
      }, 600);
      return;
    }

    // Desktop: use WhatsApp Web
    window.open(webUrl, "_blank", "noopener,noreferrer");
  };

  return (
    <Button
      variant={variant}
      size={size}
      onClick={handleClick}
      className={className}
      title={`Send WhatsApp message to ${name || phone}`}
    >
      <MessageCircle className="h-4 w-4 text-primary" />
      {showLabel && <span className="ml-2">WhatsApp</span>}
    </Button>
  );
};
