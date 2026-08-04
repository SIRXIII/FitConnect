import { AlertTriangle, RefreshCw, ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';

interface ErrorStateProps {
  title?: string;
  message: string;
  onRetry?: () => void;
  backTo?: { label: string; path: string };
  icon?: React.ReactNode;
}

export const ErrorState: React.FC<ErrorStateProps> = ({
  title = 'Something went wrong',
  message,
  onRetry,
  backTo,
  icon,
}) => (
  <div className="flex flex-col items-center justify-center py-16 px-6 text-center space-y-6">
    <div className="w-14 h-14 rounded-full bg-red-50 flex items-center justify-center">
      {icon || <AlertTriangle size={24} className="text-red-400" />}
    </div>
    <div className="space-y-2">
      <h3 className="text-xl serif font-light italic text-ink">{title}</h3>
      <p className="text-sm text-ink/50 max-w-md">{message}</p>
    </div>
    <div className="flex gap-4">
      {onRetry && (
        <button
          onClick={onRetry}
          className="flex items-center gap-2 border border-ink/20 px-6 py-3 text-[11px] uppercase tracking-[0.2em] font-medium hover:bg-ink hover:text-white transition-all duration-300"
        >
          <RefreshCw size={14} />
          Try Again
        </button>
      )}
      {backTo && (
        <Link
          to={backTo.path}
          className="flex items-center gap-2 border border-ink/20 px-6 py-3 text-[11px] uppercase tracking-[0.2em] font-medium hover:bg-ink hover:text-white transition-all duration-300"
        >
          <ArrowLeft size={14} />
          {backTo.label}
        </Link>
      )}
    </div>
  </div>
);
