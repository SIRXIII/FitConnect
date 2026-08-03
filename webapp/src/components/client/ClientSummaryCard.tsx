import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { AlertTriangle } from 'lucide-react';
import { FITNESS_GOALS, HEALTH_CONDITIONS, INTENSITY_LEVELS, WORKOUT_TYPES } from '@/lib/profileConstants';

interface ClientSummaryCardProps {
  data: {
    fitness_level: string | null;
    primary_goal: string | null;
    health_conditions: string[];
    intensity_preference: string | null;
    // Expanded extras
    goals_ranked?: string[];
    health_notes?: string | null;
    age?: number | null;
    weight_lbs?: number | null;
    workout_types?: string[];
  } | null;
}

const ClientSummaryCard: React.FC<ClientSummaryCardProps> = ({ data }) => {
  const [expanded, setExpanded] = useState(false);

  if (!data) return null;

  const getGoalLabel = (value: string) =>
    FITNESS_GOALS.find(g => g.value === value)?.label ?? value;

  const getConditionLabel = (value: string) =>
    HEALTH_CONDITIONS.find(c => c.value === value)?.label ?? value;

  const getWorkoutLabel = (value: string) =>
    WORKOUT_TYPES.find(w => w.value === value)?.label ?? value;

  const intensityConfig = INTENSITY_LEVELS.find(l => l.value === data.intensity_preference);

  const intensityDotColor =
    data.intensity_preference === 'light'
      ? 'bg-green-500'
      : data.intensity_preference === 'moderate'
      ? 'bg-amber-500'
      : data.intensity_preference === 'intense'
      ? 'bg-red-500'
      : 'bg-ink/20';

  const conditions = data.health_conditions ?? [];
  const visibleConditions = conditions.slice(0, 2);
  const overflowCount = conditions.length - 2;

  const goalLabel = data.primary_goal ? getGoalLabel(data.primary_goal) : null;
  const fitnessLevelLabel = data.fitness_level
    ? data.fitness_level.charAt(0).toUpperCase() + data.fitness_level.slice(1)
    : null;

  const goalsRanked = data.goals_ranked ?? [];
  const workoutTypes = data.workout_types ?? [];

  return (
    <div className="mt-2">
      {/* Collapsed summary row */}
      <div className="flex flex-wrap items-center gap-1.5">
        {fitnessLevelLabel && (
          <span className="text-[9px] uppercase tracking-[0.1em] px-2 py-0.5 border border-ink/10 text-ink/60">
            {fitnessLevelLabel}
          </span>
        )}

        {goalLabel && (
          <span className="text-[9px] uppercase tracking-[0.1em] px-2 py-0.5 border border-ink/10 text-ink/60">
            {goalLabel}
          </span>
        )}

        {data.intensity_preference && intensityConfig && (
          <span className="flex items-center gap-1">
            <span className={`w-1.5 h-1.5 rounded-full ${intensityDotColor}`} />
            <span className="text-[9px] uppercase tracking-[0.1em] text-ink/60">
              {intensityConfig.label}
            </span>
          </span>
        )}

        {visibleConditions.map(condition => (
          <span
            key={condition}
            data-testid="health-badge"
            aria-label={getConditionLabel(condition)}
            title={getConditionLabel(condition)}
          >
            <AlertTriangle
              size={10}
              className="text-amber-500"
            />
          </span>
        ))}

        {overflowCount > 0 && (
          <span className="text-[9px] text-ink/40">+{overflowCount}</span>
        )}
      </div>

      {/* Toggle */}
      <div className="flex justify-end mt-1">
        <button
          onClick={() => setExpanded(prev => !prev)}
          className="text-[9px] text-ink/40 underline"
        >
          {expanded ? 'Hide' : 'Details'}
        </button>
      </div>

      {/* Expanded view */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            key="expanded"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="overflow-hidden"
          >
            <div className="space-y-2 pt-3 border-t border-ink/5 mt-2">
              {goalsRanked.length > 0 && (
                <div>
                  <p className="text-[9px] uppercase tracking-[0.1em] text-ink/40 mb-1">Goals</p>
                  <div className="space-y-0.5">
                    {goalsRanked.map((goal, idx) => (
                      <p key={goal} className="text-[10px] text-ink/60">
                        {idx + 1}. {getGoalLabel(goal)}
                      </p>
                    ))}
                  </div>
                </div>
              )}

              {(data.age != null || data.weight_lbs != null) && (
                <p className="text-[10px] text-ink/60">
                  {data.age != null && `Age: ${data.age}`}
                  {data.age != null && data.weight_lbs != null && ' \u2013 '}
                  {data.weight_lbs != null && `${data.weight_lbs} lbs`}
                </p>
              )}

              {data.health_notes && (
                <div>
                  <p className="text-[9px] uppercase tracking-[0.1em] text-ink/40 mb-0.5">Health Notes</p>
                  <p className="text-[10px] text-ink/60">{data.health_notes}</p>
                </div>
              )}

              {workoutTypes.length > 0 && (
                <div>
                  <p className="text-[9px] uppercase tracking-[0.1em] text-ink/40 mb-0.5">Workout Types</p>
                  <p className="text-[10px] text-ink/60">
                    {workoutTypes.map(getWorkoutLabel).join(', ')}
                  </p>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default ClientSummaryCard;
