import { AlertTriangle } from 'lucide-react';

interface FitnessPassportCardProps {
  bio: string | null;
  fitnessGoals: string[];
  workoutTypes: string[];
  trainingFrequency: string | null;
  healthNotes: string | null;
  fitnessLevel: string | null;
}

function formatEnumLabel(value: string): string {
  return value
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

const LEVEL_STYLES: Record<string, string> = {
  beginner: 'bg-green-50 text-green-700 border-green-200',
  intermediate: 'bg-blue-50 text-blue-700 border-blue-200',
  advanced: 'bg-purple-50 text-purple-700 border-purple-200',
};

const FitnessPassportCard: React.FC<FitnessPassportCardProps> = ({
  bio,
  fitnessGoals,
  workoutTypes,
  trainingFrequency,
  healthNotes,
  fitnessLevel,
}) => {
  const hasAnyData =
    bio ||
    fitnessGoals.length > 0 ||
    workoutTypes.length > 0 ||
    trainingFrequency ||
    healthNotes ||
    fitnessLevel;

  if (!hasAnyData) return null;

  return (
    <details className="border border-ink/10 group">
      <summary className="flex items-center justify-between px-4 py-3 cursor-pointer select-none hover:bg-ink/3 transition-colors">
        <span className="text-[10px] uppercase tracking-[0.2em] font-medium text-ink/50">
          Fitness Passport
        </span>
        <span className="text-ink/30 text-xs transition-transform group-open:rotate-90">
          &#9654;
        </span>
      </summary>

      <div className="px-4 pb-4 space-y-3">
        {bio && (
          <div>
            <p className="text-[10px] uppercase tracking-[0.2em] text-ink/35 mb-1">Bio</p>
            <p className="text-sm font-light text-ink/60 italic line-clamp-2">{bio}</p>
          </div>
        )}

        {fitnessGoals.length > 0 && (
          <div>
            <p className="text-[10px] uppercase tracking-[0.2em] text-ink/35 mb-1.5">Goals</p>
            <div className="flex flex-wrap gap-1.5">
              {fitnessGoals.map((goal) => (
                <span
                  key={goal}
                  className="bg-accent/5 text-accent text-[10px] uppercase tracking-[0.2em] px-2 py-0.5"
                >
                  {formatEnumLabel(goal)}
                </span>
              ))}
            </div>
          </div>
        )}

        {workoutTypes.length > 0 && (
          <div>
            <p className="text-[10px] uppercase tracking-[0.2em] text-ink/35 mb-1.5">
              Workout Types
            </p>
            <div className="flex flex-wrap gap-1.5">
              {workoutTypes.map((type) => (
                <span
                  key={type}
                  className="bg-ink/5 text-ink/60 text-[10px] uppercase tracking-[0.2em] px-2 py-0.5"
                >
                  {formatEnumLabel(type)}
                </span>
              ))}
            </div>
          </div>
        )}

        {trainingFrequency && (
          <div>
            <p className="text-[10px] uppercase tracking-[0.2em] text-ink/35 mb-1">Frequency</p>
            <p className="text-sm font-light text-ink/60">
              Trains {trainingFrequency}x / week
            </p>
          </div>
        )}

        {fitnessLevel && (
          <div>
            <p className="text-[10px] uppercase tracking-[0.2em] text-ink/35 mb-1">Level</p>
            <span
              className={`inline-block text-[10px] uppercase tracking-[0.15em] font-semibold px-2.5 py-0.5 border ${
                LEVEL_STYLES[fitnessLevel] || 'bg-ink/5 text-ink/60 border-ink/10'
              }`}
            >
              {formatEnumLabel(fitnessLevel)}
            </span>
          </div>
        )}

        {healthNotes && (
          <div className="border border-amber-100 bg-amber-50/50 p-3 flex items-start gap-2">
            <AlertTriangle size={14} className="text-amber-500 mt-0.5 shrink-0" />
            <div>
              <p className="text-[10px] uppercase tracking-[0.2em] text-amber-700 mb-1">
                Health Notes / Limitations
              </p>
              <p className="text-sm font-light text-amber-800">{healthNotes}</p>
            </div>
          </div>
        )}
      </div>
    </details>
  );
};

export default FitnessPassportCard;
