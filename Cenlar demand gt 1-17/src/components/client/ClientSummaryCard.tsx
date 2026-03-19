import { HEALTH_CONDITIONS } from '@/lib/profileConstants';

interface ClientSummaryData {
  fitness_level: string | null;
  primary_goal: string | null;
  health_conditions: string[];
  intensity_preference: string | null;
}

interface ClientSummaryCardProps {
  data: ClientSummaryData | null;
}

const ClientSummaryCard: React.FC<ClientSummaryCardProps> = ({ data }) => {
  if (!data) return null;

  const getConditionLabel = (value: string) =>
    HEALTH_CONDITIONS.find(c => c.value === value)?.label ?? value;

  return (
    <div className="space-y-3 p-4 border border-ink/10 bg-ink/2">
      {data.fitness_level && (
        <span className="inline-block text-[10px] uppercase tracking-[0.15em] border border-accent text-accent px-2 py-1">
          {data.fitness_level}
        </span>
      )}

      {data.health_conditions.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {data.health_conditions.map((condition) => (
            <span
              key={condition}
              data-testid="health-badge"
              className="text-[10px] uppercase tracking-[0.1em] border border-amber-400 text-amber-600 bg-amber-50 px-2 py-0.5"
            >
              {getConditionLabel(condition)}
            </span>
          ))}
        </div>
      )}

      {data.intensity_preference && (
        <p className="text-[11px] uppercase tracking-[0.1em] text-ink/50">
          {data.intensity_preference} intensity
        </p>
      )}
    </div>
  );
};

export default ClientSummaryCard;
