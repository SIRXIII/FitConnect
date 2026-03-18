import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';

const NotFound: React.FC = () => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6 }}
      className="min-h-[70vh] flex items-center justify-center px-6"
    >
      <div className="text-center space-y-8 max-w-md">
        <div className="space-y-4">
          <span className="text-[10px] uppercase tracking-[0.4em] font-semibold text-accent block">
            Page Not Found
          </span>
          <h1 className="text-6xl md:text-8xl serif font-light tracking-tight text-ink">
            404
          </h1>
        </div>

        <p className="text-lg text-ink/60 font-light leading-relaxed">
          The page you're looking for doesn't exist or has been moved.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 justify-center pt-4">
          <Link
            to="/"
            className="bg-ink text-white px-10 py-4 text-[11px] uppercase tracking-[0.3em] hover:bg-accent transition-all duration-500 text-center"
          >
            Back to Home
          </Link>
          <Link
            to="/#search"
            className="text-ink px-6 py-4 text-[11px] uppercase tracking-[0.3em] border-b border-ink/20 hover:border-ink transition-all text-center"
          >
            Find Trainers
          </Link>
        </div>
      </div>
    </motion.div>
  );
};

export default NotFound;
