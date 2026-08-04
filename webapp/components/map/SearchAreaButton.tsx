import { motion, AnimatePresence } from 'framer-motion';

interface SearchAreaButtonProps {
  visible: boolean;
  loading: boolean;
  onClick: () => void;
}

export function SearchAreaButton({ visible, loading, onClick }: SearchAreaButtonProps) {
  return (
    <AnimatePresence>
      {visible && (
        <motion.button
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.2 }}
          onClick={onClick}
          disabled={loading}
          className={`
            absolute top-4 left-1/2 -translate-x-1/2 z-10
            bg-paper shadow-lg border border-ink/10 px-6 py-3 rounded-full
            text-[10px] uppercase tracking-[0.2em] font-semibold text-ink
            hover:bg-ink hover:text-white transition-all cursor-pointer
            ${loading ? 'opacity-60 cursor-not-allowed' : ''}
          `}
        >
          {loading ? 'Searching...' : 'Search this area'}
        </motion.button>
      )}
    </AnimatePresence>
  );
}
