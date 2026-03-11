import React from 'react';
import { Search, CalendarCheck, Dumbbell } from 'lucide-react';
import MarketInsights from './MarketInsights';

const HowItWorks: React.FC = () => {
  return (
    <section id="how-it-works" className="py-32 bg-paper overflow-hidden">
      <div className="max-w-7xl mx-auto px-6 sm:px-10 lg:px-12">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-24 items-center">
            
            <div className="space-y-16">
                <div className="space-y-6">
                    <h2 className="text-4xl md:text-5xl serif font-light text-ink leading-tight italic">The Philosophy</h2>
                    <p className="text-sm uppercase tracking-[0.3em] text-ink/40">Optimized excellence</p>
                </div>

                <div className="space-y-12">
                    <div className="flex gap-8 group">
                        <div className="text-2xl serif font-light italic text-accent">01</div>
                        <div className="space-y-3">
                            <h3 className="text-xs uppercase tracking-[0.2em] font-semibold text-ink">Curation</h3>
                            <p className="text-sm text-ink/60 leading-relaxed font-light">Browse our collective of certified master trainers. Discover exclusive downtime slots—our "Signature Hours"—available at optimized rates.</p>
                        </div>
                    </div>

                    <div className="flex gap-8 group">
                        <div className="text-2xl serif font-light italic text-accent">02</div>
                        <div className="space-y-3">
                            <h3 className="text-xs uppercase tracking-[0.2em] font-semibold text-ink">Engagement</h3>
                            <p className="text-sm text-ink/60 leading-relaxed font-light">Secure your session through our seamless booking interface. We handle the logistics, ensuring a focused and professional experience from the start.</p>
                        </div>
                    </div>

                    <div className="flex gap-8 group">
                        <div className="text-2xl serif font-light italic text-accent">03</div>
                        <div className="space-y-3">
                            <h3 className="text-xs uppercase tracking-[0.2em] font-semibold text-ink">Transformation</h3>
                            <p className="text-sm text-ink/60 leading-relaxed font-light">Experience world-class coaching tailored to your unique objectives. Refine your strength and elevate your standard of fitness.</p>
                        </div>
                    </div>
                </div>
            </div>

            <div className="relative aspect-[4/5]">
                <img 
                    src="https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?ixlib=rb-4.0.3&auto=format&fit=crop&w=1740&q=80" 
                    alt="Training Experience" 
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover"
                />
                <div className="absolute -bottom-12 -right-12 w-64 h-64 border border-ink/5 -z-10 hidden lg:block"></div>
            </div>
        </div>
      </div>
    </section>
  );
};

export default HowItWorks;