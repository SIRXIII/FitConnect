import { ShieldCheck, GraduationCap, FileCheck, Star } from 'lucide-react';

const TrustSafety: React.FC = () => {
  const features = [
    {
      icon: <ShieldCheck size={24} strokeWidth={1} />,
      title: "Vetted",
      description: "Rigorous background checks for every professional."
    },
    {
      icon: <GraduationCap size={24} strokeWidth={1} />,
      title: "Certified",
      description: "Verified credentials from elite global bodies."
    },
    {
      icon: <FileCheck size={24} strokeWidth={1} />,
      title: "Protected",
      description: "Comprehensive liability coverage for every session."
    },
    {
      icon: <Star size={24} strokeWidth={1} />,
      title: "Authentic",
      description: "Transparent reviews from our verified community."
    }
  ];

  return (
    <section id="safety" className="py-32 bg-paper border-t border-ink/5">
      <div className="max-w-7xl mx-auto px-6 sm:px-10 lg:px-12">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-16">
          {features.map((feature, index) => (
            <div key={index} className="space-y-6">
              <div className="text-accent">
                {feature.icon}
              </div>
              <div className="space-y-3">
                <h3 className="text-xs uppercase tracking-[0.2em] font-semibold text-ink">{feature.title}</h3>
                <p className="text-sm text-ink/50 leading-relaxed font-light">{feature.description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default TrustSafety;
