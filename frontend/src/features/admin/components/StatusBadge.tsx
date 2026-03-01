import { Badge } from '@/components/ui/badge';

const STATUS_STYLES: Record<string, string> = {
  completed: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  failed: 'bg-red-500/15 text-red-400 border-red-500/30',
  refresh_data: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
  preprocess_description: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
  create_embedding: 'bg-purple-500/15 text-purple-400 border-purple-500/30',
  active: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  disabled: 'bg-red-500/15 text-red-400 border-red-500/30',
};

const STATUS_LABELS: Record<string, string> = {
  refresh_data: 'Refresh Data',
  preprocess_description: 'Preprocess',
  create_embedding: 'Embedding',
  completed: 'Completed',
  failed: 'Failed',
};

interface Props {
  status: string;
  label?: string;
}

export default function StatusBadge({ status, label }: Props) {
  const style = STATUS_STYLES[status] ?? 'bg-muted text-muted-foreground border-border';
  const text = label ?? STATUS_LABELS[status] ?? status;

  return (
    <Badge variant="outline" className={`text-xs font-medium ${style}`}>
      {text}
    </Badge>
  );
}
