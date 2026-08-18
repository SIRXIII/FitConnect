import { Link } from 'react-router-dom';
import { MapPin } from 'lucide-react';

const NominateCTA: React.FC = () => {
  return (
    <section className="py-24 px-6 border-t border-ink/5">
      <div className="max-w-3xl mx-auto space-y-6 text-center">
        <div className="flex items-center justify-center gap-2">
          <MapPin size={16} className="text-accent" />
          <p className="text-xs uppercase tracking-[0.3em] text-ink/40 font-medium">Bring FitRush Here</p>
        </div>
        <h2 className="text-2xl md:text-3xl serif font-light italic text-ink">
          Want FitRush trainers in your city?
        </h2>
        <p className="text-sm text-ink/40 font-light max-w-lg mx-auto">
          Nominate your city and help us decide where to recruit next. It takes ten seconds and no account is required.
        </p>
        <Link
          to="/nominate"
          className="inline-flex items-center justify-center px-10 py-3.5 text-[11px] uppercase tracking-[0.3em] text-white bg-ink hover:bg-accent transition-all duration-500"
        >
          Nominate My City
        </Link>
      </div>
    </section>
  );
};

export default NominateCTA;
