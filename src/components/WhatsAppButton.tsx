import { Button } from "@/components/ui/button";
import { MessageCircle } from "lucide-react";
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

  // Remove the + prefix for wa.me links
  const cleanPhone = phone.replace(/^\+/, '');
  
  // Build the default message
  const defaultMessage = name 
    ? `Hi ${name}, this is regarding your booking...` 
    : "Hi, this is regarding your booking...";
  
  const finalMessage = message || defaultMessage;
  
  // Encode the message for URL
  const encodedMessage = encodeURIComponent(finalMessage);
  
  // Build the WhatsApp URL
  const whatsappUrl = `https://wa.me/${cleanPhone}?text=${encodedMessage}`;

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    window.open(whatsappUrl, '_blank', 'noopener,noreferrer');
  };

  return (
    <Button
      variant={variant}
      size={size}
      onClick={handleClick}
      className={className}
      title={`Send WhatsApp message to ${name || phone}`}
    >
      <MessageCircle className="h-4 w-4 text-green-600" />
      {showLabel && <span className="ml-2">WhatsApp</span>}
    </Button>
  );
};
