import { Badge } from "@/components/ui/badge";
import { Loader2, CheckCircle2, XCircle, Clock } from "lucide-react";

interface StatusBadgeProps {
  status: string;
}

export const StatusBadge = ({ status }: StatusBadgeProps) => {
  const getStatusConfig = () => {
    switch (status) {
      case 'PENDING':
        return {
          icon: Clock,
          label: 'Queued',
          className: 'bg-muted text-muted-foreground border-muted-foreground/20'
        };
      case 'PROCESSING':
        return {
          icon: Loader2,
          label: 'Processing',
          className: 'bg-accent/20 text-accent border-accent/50 animate-pulse'
        };
      case 'COMPLETED':
        return {
          icon: CheckCircle2,
          label: 'Completed',
          className: 'bg-green-500/20 text-green-400 border-green-500/50'
        };
      case 'FAILED':
        return {
          icon: XCircle,
          label: 'Failed',
          className: 'bg-destructive/20 text-destructive border-destructive/50'
        };
      default:
        return {
          icon: Clock,
          label: status,
          className: 'bg-muted text-muted-foreground'
        };
    }
  };

  const { icon: Icon, label, className } = getStatusConfig();

  return (
    <Badge className={`${className} flex items-center gap-1.5 px-3 py-1`}>
      <Icon className={`w-3.5 h-3.5 ${status === 'PROCESSING' ? 'animate-spin' : ''}`} />
      {label}
    </Badge>
  );
};