import { useState, useMemo } from 'react';
import { ChevronLeft, ChevronRight, Plus, Trash2, Users } from 'lucide-react';
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

  // Group slot creation form state
  const [showGroupForm, setShowGroupForm] = useState(false);
  const [groupFormDate, setGroupFormDate] = useState('');
  const [groupFormStartHour, setGroupFormStartHour] = useState('9');
  const [groupFormEndHour, setGroupFormEndHour] = useState('10');
  const [groupMaxCapacity, setGroupMaxCapacity] = useState(5);
  const [groupRate, setGroupRate] = useState<number | ''>('');
  const [addingGroup, setAddingGroup] = useState(false);

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

  const handleAddGroupSlot = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!groupFormDate || groupRate === '' || groupRate <= 0) {
      toast.error('Please fill in all group session fields.');
      return;
    }
    const startH = parseInt(groupFormStartHour, 10);
    const endH = parseInt(groupFormEndHour, 10);
    if (endH <= startH) {
      toast.error('End time must be after start time.');
      return;
    }
    setAddingGroup(true);
    try {
      const slotDate = new Date(groupFormDate + 'T00:00:00');
      const startTime = new Date(slotDate);
      startTime.setHours(startH, 0, 0, 0);
      const endTime = new Date(slotDate);
      endTime.setHours(endH, 0, 0, 0);

      await addSlot(startTime, endTime, {
        slot_type: 'group',
        max_capacity: groupMaxCapacity,
        group_rate: Number(groupRate),
      });

      toast.success('Group session slot created.');
      setShowGroupForm(false);
      setGroupFormDate('');
      setGroupRate('');
      setGroupMaxCapacity(5);
    } catch {
      toast.error('Failed to create group slot. Please try again.');
    } finally {
      setAddingGroup(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Week navigation */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="space-y-1">
          <h2 className="text-2xl serif font-light italic text-ink">Availability</h2>
          <p className="text-xs text-ink/40 uppercase tracking-[0.2em]">
            Click cells to toggle 1-on-1 slots — or add a group session below
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
          <div className="min-w-[520px] sm:min-w-[700px]">
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
                      onClick={() => !past && slot?.slot_type !== 'group' && handleCellClick(dayIndex, hour)}
                      disabled={past || adding || slot?.slot_type === 'group'}
                      className={`
                        h-12 sm:h-10 border-l border-ink/5 transition-all duration-200
                        ${past ? 'bg-ink/3 cursor-not-allowed' : slot?.slot_type === 'group' ? 'cursor-default' : 'cursor-pointer hover:bg-accent/10'}
                        ${slot?.is_booked && slot?.slot_type !== 'group' ? 'bg-accent/20' : ''}
                        ${slot && !slot.is_booked && slot?.slot_type !== 'group' ? 'bg-accent/10 border-l-2 border-l-accent' : ''}
                        ${slot?.slot_type === 'group' ? 'bg-blue-500/15 border-l-2 border-l-blue-400' : ''}
                      `}
                      title={
                        slot?.slot_type === 'group'
                          ? `Group session (${slot.max_capacity} capacity)`
                          : slot?.is_booked
                          ? 'Booked — cannot modify'
                          : slot
                          ? 'Click to remove availability'
                          : past
                          ? 'Past time'
                          : 'Click to add 1-on-1 availability'
                      }
                    >
                      {slot?.slot_type === 'group' && (
                        <span className="text-[9px] uppercase tracking-wider text-blue-400 font-semibold">
                          Group
                        </span>
                      )}
                      {slot?.is_booked && slot?.slot_type !== 'group' && (
                        <span className="text-[9px] uppercase tracking-wider text-accent font-semibold">
                          Booked
                        </span>
                      )}
                      {slot && !slot.is_booked && slot?.slot_type !== 'group' && (
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

      {/* Group session creation */}
      <div className="border border-ink/10">
        <button
          type="button"
          onClick={() => setShowGroupForm(v => !v)}
          className="w-full flex items-center justify-between px-6 py-4 hover:bg-ink/3 transition-colors"
        >
          <div className="flex items-center gap-3">
            <Users size={16} className="text-blue-400" />
            <span className="text-[11px] uppercase tracking-[0.2em] font-medium text-ink/70">
              Add Group Session
            </span>
          </div>
          <Plus
            size={14}
            className={`text-ink/40 transition-transform ${showGroupForm ? 'rotate-45' : ''}`}
          />
        </button>

        {showGroupForm && (
          <form onSubmit={handleAddGroupSlot} className="border-t border-ink/10 px-6 py-6 space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-[10px] uppercase tracking-[0.2em] text-ink/40 font-medium">Date</label>
                <input
                  type="date"
                  required
                  value={groupFormDate}
                  min={new Date().toISOString().split('T')[0]}
                  onChange={e => setGroupFormDate(e.target.value)}
                  className="w-full border border-ink/20 px-3 py-2 text-sm focus:outline-none focus:border-accent/40 bg-transparent"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] uppercase tracking-[0.2em] text-ink/40 font-medium">Time</label>
                <div className="flex items-center gap-2">
                  <select
                    value={groupFormStartHour}
                    onChange={e => setGroupFormStartHour(e.target.value)}
                    className="flex-1 border border-ink/20 px-2 py-2 text-sm focus:outline-none focus:border-accent/40 bg-transparent"
                  >
                    {HOURS.map(h => (
                      <option key={h} value={h}>
                        {h === 12 ? '12pm' : h < 12 ? `${h}am` : `${h - 12}pm`}
                      </option>
                    ))}
                  </select>
                  <span className="text-ink/30 text-sm">to</span>
                  <select
                    value={groupFormEndHour}
                    onChange={e => setGroupFormEndHour(e.target.value)}
                    className="flex-1 border border-ink/20 px-2 py-2 text-sm focus:outline-none focus:border-accent/40 bg-transparent"
                  >
                    {HOURS.map(h => (
                      <option key={h} value={h}>
                        {h === 12 ? '12pm' : h < 12 ? `${h}am` : h === 19 ? '7pm' : `${h - 12}pm`}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] uppercase tracking-[0.2em] text-ink/40 font-medium">
                  Max Participants (2–10)
                </label>
                <input
                  type="number"
                  required
                  min={2}
                  max={10}
                  value={groupMaxCapacity}
                  onChange={e => setGroupMaxCapacity(Math.min(10, Math.max(2, parseInt(e.target.value, 10) || 2)))}
                  className="w-full border border-ink/20 px-3 py-2 text-sm focus:outline-none focus:border-accent/40 bg-transparent"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] uppercase tracking-[0.2em] text-ink/40 font-medium">
                  Per-Person Rate ($)
                </label>
                <input
                  type="number"
                  required
                  min={1}
                  step="0.01"
                  placeholder="e.g. 25.00"
                  value={groupRate}
                  onChange={e => setGroupRate(e.target.value === '' ? '' : parseFloat(e.target.value))}
                  className="w-full border border-ink/20 px-3 py-2 text-sm focus:outline-none focus:border-accent/40 bg-transparent"
                />
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button
                type="submit"
                disabled={addingGroup}
                className="border border-blue-400/50 text-blue-400 px-8 py-2.5 text-[11px] uppercase tracking-[0.2em] font-medium hover:bg-blue-400 hover:text-white transition-all duration-300 disabled:opacity-50"
              >
                {addingGroup ? 'Creating…' : 'Create Group Slot'}
              </button>
              <button
                type="button"
                onClick={() => setShowGroupForm(false)}
                className="text-[11px] text-ink/40 hover:text-ink/70 transition-colors uppercase tracking-[0.2em]"
              >
                Cancel
              </button>
            </div>
          </form>
        )}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-6 text-[10px] uppercase tracking-[0.2em] text-ink/40">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-accent/10 border-l-2 border-l-accent" />
          1-on-1 Available
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-accent/20" />
          Booked
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-blue-500/15 border-l-2 border-l-blue-400" />
          Group Session
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
