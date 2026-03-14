import { useState, useMemo } from 'react';
import { ChevronLeft, ChevronRight, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { useAvailability, type AvailabilitySlot } from '@/hooks/useAvailability';

const HOURS = Array.from({ length: 14 }, (_, i) => i + 6); // 6am to 7pm
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function getWeekStart(date: Date): Date {
  const d = new Date(date);
  d.setDate(d.getDate() - d.getDay());
  d.setHours(0, 0, 0, 0);
  return d;
}

function formatDate(date: Date): string {
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

const AvailabilityManager: React.FC = () => {
  const { slots, loading, addSlot, removeSlot } = useAvailability();
  const [currentWeek, setCurrentWeek] = useState(() => getWeekStart(new Date()));
  const [adding, setAdding] = useState(false);

  const weekDays = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(currentWeek);
      d.setDate(d.getDate() + i);
      return d;
    });
  }, [currentWeek]);

  // Map slots to grid positions
  const slotsByDayHour = useMemo(() => {
    const map: Record<string, AvailabilitySlot> = {};
    slots.forEach((slot) => {
      const start = new Date(slot.start_time);
      const day = start.getDay();
      const hour = start.getHours();
      const weekStart = getWeekStart(start);
      if (weekStart.getTime() === currentWeek.getTime()) {
        map[`${day}-${hour}`] = slot;
      }
    });
    return map;
  }, [slots, currentWeek]);

  const prevWeek = () => {
    const d = new Date(currentWeek);
    d.setDate(d.getDate() - 7);
    setCurrentWeek(d);
  };

  const nextWeek = () => {
    const d = new Date(currentWeek);
    d.setDate(d.getDate() + 7);
    setCurrentWeek(d);
  };

  const handleCellClick = async (dayIndex: number, hour: number) => {
    const key = `${dayIndex}-${hour}`;
    const existing = slotsByDayHour[key];

    try {
      if (existing) {
        if (existing.is_booked) return; // Can't remove booked slots
        await removeSlot(existing.id);
      } else {
        setAdding(true);
        const slotDate = new Date(currentWeek);
        slotDate.setDate(slotDate.getDate() + dayIndex);

        const startTime = new Date(slotDate);
        startTime.setHours(hour, 0, 0, 0);

        const endTime = new Date(slotDate);
        endTime.setHours(hour + 1, 0, 0, 0);

        await addSlot(startTime, endTime);
      }
    } catch {
      toast.error('Failed to update availability. Please try again.');
    } finally {
      setAdding(false);
    }
  };

  const isPast = (dayIndex: number, hour: number) => {
    const d = new Date(currentWeek);
    d.setDate(d.getDate() + dayIndex);
    d.setHours(hour, 0, 0, 0);
    return d < new Date();
  };

  return (
    <div className="space-y-8">
      {/* Week navigation */}
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h2 className="text-2xl serif font-light italic text-ink">Availability</h2>
          <p className="text-xs text-ink/40 uppercase tracking-[0.2em]">
            Click cells to toggle your available hours
          </p>
        </div>
        <div className="flex items-center gap-4">
          <button
            onClick={prevWeek}
            className="p-2 border border-ink/10 hover:bg-ink hover:text-white transition-all"
          >
            <ChevronLeft size={16} strokeWidth={1.5} />
          </button>
          <span className="text-sm font-medium min-w-[160px] text-center">
            {formatDate(weekDays[0])} — {formatDate(weekDays[6])}
          </span>
          <button
            onClick={nextWeek}
            className="p-2 border border-ink/10 hover:bg-ink hover:text-white transition-all"
          >
            <ChevronRight size={16} strokeWidth={1.5} />
          </button>
        </div>
      </div>

      {/* Calendar grid */}
      {loading ? (
        <div className="flex justify-center py-20">
          <div className="w-5 h-5 border border-accent border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="overflow-x-auto">
          <div className="min-w-[700px]">
            {/* Day headers */}
            <div className="grid grid-cols-[60px_repeat(7,1fr)] border-b border-ink/10">
              <div />
              {weekDays.map((day, i) => (
                <div key={i} className="text-center py-3 space-y-1">
                  <p className="text-[10px] uppercase tracking-[0.2em] text-ink/40">{DAYS[i]}</p>
                  <p className="text-sm font-medium">{day.getDate()}</p>
                </div>
              ))}
            </div>

            {/* Hour rows */}
            {HOURS.map((hour) => (
              <div key={hour} className="grid grid-cols-[60px_repeat(7,1fr)] border-b border-ink/5">
                <div className="py-3 pr-3 text-right text-[10px] text-ink/30 uppercase tracking-wider">
                  {hour === 0 ? '12am' : hour < 12 ? `${hour}am` : hour === 12 ? '12pm' : `${hour - 12}pm`}
                </div>
                {weekDays.map((_, dayIndex) => {
                  const key = `${dayIndex}-${hour}`;
                  const slot = slotsByDayHour[key];
                  const past = isPast(dayIndex, hour);

                  return (
                    <button
                      key={key}
                      onClick={() => !past && handleCellClick(dayIndex, hour)}
                      disabled={past || adding}
                      className={`
                        h-10 border-l border-ink/5 transition-all duration-200
                        ${past ? 'bg-ink/3 cursor-not-allowed' : 'cursor-pointer hover:bg-accent/10'}
                        ${slot?.is_booked ? 'bg-accent/20' : ''}
                        ${slot && !slot.is_booked ? 'bg-accent/10 border-l-2 border-l-accent' : ''}
                      `}
                      title={
                        slot?.is_booked
                          ? 'Booked — cannot modify'
                          : slot
                          ? 'Click to remove availability'
                          : past
                          ? 'Past time'
                          : 'Click to add availability'
                      }
                    >
                      {slot?.is_booked && (
                        <span className="text-[9px] uppercase tracking-wider text-accent font-semibold">
                          Booked
                        </span>
                      )}
                      {slot && !slot.is_booked && (
                        <span className="text-[9px] uppercase tracking-wider text-accent/60">
                          Available
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Legend */}
      <div className="flex items-center gap-8 text-[10px] uppercase tracking-[0.2em] text-ink/40">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-accent/10 border-l-2 border-l-accent" />
          Available
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-accent/20" />
          Booked
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-ink/3" />
          Past
        </div>
      </div>
    </div>
  );
};

export default AvailabilityManager;
