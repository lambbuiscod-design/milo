import type { SVGProps } from "react";
import {
  AlertCircle,
  AlertTriangle,
  AppWindow,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Check,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Compass,
  Copy,
  ExternalLink,
  Eye,
  EyeOff,
  Feather,
  Flame,
  Heart,
  Lightbulb,
  Lock,
  LogOut,
  Maximize2,
  MessageSquare,
  MessageSquarePlus,
  MessageSquareQuote,
  MessageSquareText,
  Minimize2,
  Minus,
  MoreHorizontal,
  Pause,
  Play,
  RotateCcw,
  Pin,
  Send,
  Settings,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Sliders,
  Smile,
  Sparkles,
  User,
  Volume2,
  VolumeX,
  Wand2,
  X,
  Zap,
} from "lucide-react";

export type IconProps = SVGProps<SVGSVGElement> & {
  size?: number | string;
};

// Re-export core Lucide icon components
export {
  AlertCircle,
  AlertTriangle,
  AppWindow,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Check,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Compass,
  Copy,
  ExternalLink,
  Eye,
  EyeOff,
  Feather,
  Flame,
  Heart,
  Lightbulb,
  Lock,
  LogOut,
  Maximize2,
  MessageSquare,
  MessageSquarePlus,
  MessageSquareQuote,
  MessageSquareText,
  Minimize2,
  Minus,
  MoreHorizontal,
  Pause,
  Play,
  RotateCcw,
  Send,
  Settings,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Sliders,
  Smile,
  Sparkles,
  User,
  Wand2,
  X,
  Zap,
};

// Named icon components with refined stroke widths for desktop UI
export const CloseIcon = (props: IconProps) => <X aria-hidden="true" strokeWidth={1.75} {...props} />;
export const MoreIcon = (props: IconProps) => <MoreHorizontal aria-hidden="true" strokeWidth={1.75} {...props} />;
export const SparkIcon = (props: IconProps) => <MessageSquareText aria-hidden="true" strokeWidth={1.75} {...props} />;
export const PauseIcon = (props: IconProps) => <Pause aria-hidden="true" strokeWidth={1.75} {...props} />;
export const PlayIcon = (props: IconProps) => <Play aria-hidden="true" strokeWidth={1.75} {...props} />;
export const CopyIcon = (props: IconProps) => <Copy aria-hidden="true" strokeWidth={1.75} {...props} />;
export const CheckIcon = (props: IconProps) => <Check aria-hidden="true" strokeWidth={2} {...props} />;
export const EyeIcon = (props: IconProps) => <Eye aria-hidden="true" strokeWidth={1.75} {...props} />;
export const EyeOffIcon = (props: IconProps) => <EyeOff aria-hidden="true" strokeWidth={1.75} {...props} />;
export const ResetIcon = (props: IconProps) => <RotateCcw aria-hidden="true" strokeWidth={1.75} {...props} />;
export const AlertIcon = (props: IconProps) => <AlertTriangle aria-hidden="true" strokeWidth={1.75} {...props} />;
export const ShieldIcon = (props: IconProps) => <ShieldCheck aria-hidden="true" strokeWidth={1.75} {...props} />;
export const WindowIcon = (props: IconProps) => <AppWindow aria-hidden="true" strokeWidth={1.75} {...props} />;
export const MessageIcon = (props: IconProps) => <MessageSquare aria-hidden="true" strokeWidth={1.75} {...props} />;
export const SettingsIcon = (props: IconProps) => <Settings aria-hidden="true" strokeWidth={1.75} {...props} />;
export const SendIcon = (props: IconProps) => <Send aria-hidden="true" strokeWidth={1.75} {...props} />;
export const ChevronIcon = (props: IconProps) => <ChevronDown aria-hidden="true" strokeWidth={1.75} {...props} />;

export const VolumeIcon = (props: IconProps) => <Volume2 aria-hidden="true" strokeWidth={1.75} {...props} />;
export const VolumeMuteIcon = (props: IconProps) => <VolumeX aria-hidden="true" strokeWidth={1.75} {...props} />;
export const PinIcon = (props: IconProps) => <Pin aria-hidden="true" strokeWidth={1.75} {...props} />;

export const ArrowIcon = ({
  direction = "up",
  style,
  ...props
}: IconProps & { direction?: "up" | "right" | "down" | "left" }) => {
  const rotation = ({ up: 0, right: 90, down: 180, left: -90 } as const)[direction];
  return (
    <ArrowUp
      aria-hidden="true"
      strokeWidth={1.75}
      {...props}
      style={{
        ...style,
        transform: style?.transform ? `${style.transform} rotate(${rotation}deg)` : `rotate(${rotation}deg)`,
      }}
    />
  );
};
