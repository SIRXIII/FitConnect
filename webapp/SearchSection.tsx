import React, { useState, useMemo } from 'react';
import { Search, Filter } from 'lucide-react';
import { MOCK_TRAINERS, SPECIALTIES } from '../constants';
import { PriceRange, Trainer } from '../types';
import TrainerCard from './TrainerCard';

const SearchSection: React.FC = () => {
  const [location, setLocation] = useState('');
  const [specialty, setSpecialty] = useState('');
  const [priceRange, setPriceRange] = useState('');

  const filteredTrainers = useMemo(() => {
    return MOCK_TRAINERS.filter(trainer => {
      const matchLocation = trainer.location.toLowerCase().includes(location.toLowerCase());
      const matchSpecialty = specialty === '' || trainer.specialty === specialty;
      
      let matchPrice = true;
      if (priceRange === PriceRange.BUDGET) matchPrice = trainer.discountedRate <= 50;
      if (priceRange === PriceRange.STANDARD) matchPrice = trainer.discountedRate > 50 && trainer.discountedRate <= 80;
      if (priceRange === PriceRange.PREMIUM) matchPrice = trainer.discountedRate > 80;

      return matchLocation && matchSpecialty && matchPrice;
    });
  }, [location, specialty, priceRange]);

  return (
    <section id="search" className="py-32 bg-paper">
      <div className="max-w-7xl mx-auto px-6 sm:px-10 lg:px-12">
        <div className="text-center mb-20">
          <h2 className="text-4xl md:text-5xl serif font-light text-ink mb-6 italic">The Collective</h2>
          <p className="text-sm uppercase tracking-[0.3em] text-ink/40">Curated certified professionals</p>
        </div>

        {/* Search Bar */}
        <div className="mb-24">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-12 border-b border-ink/10 pb-12">
                <div className="space-y-4">
                    <label className="block text-[10px] uppercase tracking-[0.2em] font-semibold text-ink/40">Location</label>
                    <div className="relative">
                        <input 
                            type="text" 
                            placeholder="City or Zip" 
                            value={location}
                            onChange={(e) => setLocation(e.target.value)}
                            className="w-full py-2 bg-transparent border-none focus:ring-0 outline-none text-ink serif text-xl placeholder:text-ink/20"
                        />
                    </div>
                </div>

                <div className="space-y-4">
                    <label className="block text-[10px] uppercase tracking-[0.2em] font-semibold text-ink/40">Specialty</label>
                    <div className="relative">
                        <select 
                            value={specialty}
                            onChange={(e) => setSpecialty(e.target.value)}
                            className="w-full py-2 bg-transparent border-none focus:ring-0 outline-none text-ink serif text-xl appearance-none cursor-pointer"
                        >
                            <option value="">All Disciplines</option>
                            {SPECIALTIES.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                    </div>
                </div>

                <div className="space-y-4">
                    <label className="block text-[10px] uppercase tracking-[0.2em] font-semibold text-ink/40">Investment</label>
                    <div className="relative">
                         <select 
                            value={priceRange}
                            onChange={(e) => setPriceRange(e.target.value)}
                            className="w-full py-2 bg-transparent border-none focus:ring-0 outline-none text-ink serif text-xl appearance-none cursor-pointer"
                        >
                            <option value="">Any Range</option>
                            <option value={PriceRange.BUDGET}>Essential ($30-50)</option>
                            <option value={PriceRange.STANDARD}>Elevated ($50-80)</option>
                            <option value={PriceRange.PREMIUM}>Mastery ($80+)</option>
                        </select>
                    </div>
                </div>

                <div className="flex items-end">
                    <button className="w-full bg-ink text-white py-4 text-[10px] uppercase tracking-[0.3em] hover:bg-accent transition-all duration-500">
                        Refine Search
                    </button>
                </div>
            </div>
        </div>

        {/* Results */}
        {filteredTrainers.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-12 gap-y-20">
            {filteredTrainers.map(trainer => (
                <TrainerCard key={trainer.id} trainer={trainer} />
            ))}
            </div>
        ) : (
            <div className="text-center py-32 border border-dashed border-ink/10">
                <h3 className="text-3xl serif font-light text-ink mb-4 italic">No matches found</h3>
                <p className="text-sm uppercase tracking-widest text-ink/40 mb-8">Adjust your criteria for the collective</p>
                <button 
                  onClick={() => {setLocation(''); setSpecialty(''); setPriceRange('');}}
                  className="text-[10px] uppercase tracking-[0.2em] border-b border-ink/20 hover:border-ink transition-all pb-1"
                >
                    Reset Filters
                </button>
            </div>
        )}
      </div>
    </section>
  );
};

export default SearchSection;