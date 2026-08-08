import { isNativeiOS } from '@/lib/platform';

const APP_STORE_URL =
  'https://apps.apple.com/us/app/fitrush-personal-trainer/id6766015234';

interface AppStoreBadgeProps {
  className?: string;
}

// Official Apple artwork, served unmodified from /assets. Apple's marketing
// guidelines forbid recoloring, cropping or adding effects to the badge, so the
// only permitted hover affordance is opacity.
const AppStoreBadge: React.FC<AppStoreBadgeProps> = ({ className = '' }) => {
  if (isNativeiOS()) return null;

  return (
    <a
      href={APP_STORE_URL}
      target="_blank"
      rel="noopener noreferrer"
      className={`inline-block opacity-90 hover:opacity-100 transition-opacity duration-300 ${className}`}
    >
      <img
        src="/download-on-the-app-store.svg"
        alt="Download FitRush on the App Store"
        width={144}
        height={48}
        className="h-12 w-auto"
      />
    </a>
  );
};

export default AppStoreBadge;
