import { motion } from 'framer-motion';

interface ProfileProgressRingProps {
  completionPct: number; // 0-100
  missingFields: string[]; // e.g. ["age", "intensity preference"]
}

const CIRCUMFERENCE = 2 * Math.PI * 36; // ~226.2

const ProfileProgressRing: React.FC<ProfileProgressRingProps> = ({ completionPct, missingFields }) => {
  const strokeDashoffset = CIRCUMFERENCE - (completionPct / 100) * CIRCUMFERENCE;

  return (
    <motion.div
      className="flex flex-col items-center gap-2 shrink-0"
      initial={{ scale: 0.9, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
    >
      <svg
        viewBox="0 0 88 88"
        width="88"
        height="88"
        className="block"
      >
        {/* Background track */}
        <circle
          cx="44"
          cy="44"
          r="36"
          fill="none"
          stroke="currentColor"
          strokeWidth="6"
          className="text-ink/10"
        />
        {/* Progress arc */}
        <circle
          cx="44"
          cy="44"
          r="36"
          fill="none"
          stroke="currentColor"
          strokeWidth="6"
          strokeDasharray={CIRCUMFERENCE}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          className="text-accent transition-all duration-700"
          style={{ transform: 'rotate(-90deg)', transformOrigin: '44px 44px' }}
        />
        {/* Center text */}
        <text
          x="44"
          y="49"
          textAnchor="middle"
          fontSize="16"
          fontWeight="300"
          fill="currentColor"
          className="text-ink"
        >
          {completionPct}%
        </text>
      </svg>

      {missingFields.length > 0 && (
        <p className="text-center text-[10px] uppercase tracking-[0.15em] text-ink/40 max-w-[100px]">
          Add {missingFields[0]}
        </p>
      )}
    </motion.div>
  );
};

export default ProfileProgressRing;
