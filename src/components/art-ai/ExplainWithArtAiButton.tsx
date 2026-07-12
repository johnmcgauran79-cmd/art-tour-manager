import { Button } from "@/components/ui/button";
import artAiLogo from "@/assets/art-ai-logo.png";
import { useLaunchArtAiSkill } from "@/hooks/useLaunchArtAiSkill";
import type { AiConversationContext } from "@/hooks/useAiChat";
import { cn } from "@/lib/utils";

interface Props {
  skillId: "explain_booking" | "explain_client";
  entryPoint: string;
  context: AiConversationContext;
  label?: string;
  /** Icon-only rendering for tight mobile toolbars. */
  iconOnly?: boolean;
  size?: "default" | "sm" | "icon";
  variant?: "default" | "outline" | "secondary" | "ghost";
  className?: string;
}

/**
 * Launches a deterministic ART AI skill with the current page's ID-based
 * context. Uses the ART AI logo and the shared Button system.
 */
export const ExplainWithArtAiButton = ({
  skillId,
  entryPoint,
  context,
  label = "Explain with ART AI",
  iconOnly = false,
  size = "sm",
  variant = "outline",
  className,
}: Props) => {
  const launch = useLaunchArtAiSkill();
  return (
    <Button
      type="button"
      variant={variant}
      size={iconOnly ? "icon" : size}
      className={cn("gap-2", className)}
      title={label}
      aria-label={label}
      onClick={() => launch({ skillId, entryPoint, context })}
    >
      <img src={artAiLogo} alt="" width={16} height={16} className="h-4 w-4 rounded" />
      {!iconOnly && <span>{label}</span>}
    </Button>
  );
};