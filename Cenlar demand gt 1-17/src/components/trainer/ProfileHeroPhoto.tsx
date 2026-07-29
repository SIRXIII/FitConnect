interface ProfileHeroPhotoProps {
  avatar?: string | null;
  name: string;
}

/** Trainer profile hero photo — soft "squircle" treatment (quiet-luxury pivot, profile surfaces only). */
export const ProfileHeroPhoto: React.FC<ProfileHeroPhotoProps> = ({ avatar, name }) => (
  <div className="aspect-[4/5] overflow-hidden bg-ink/5 rounded-[2.5rem] border border-ink/10">
    {avatar ? (
      <img
        src={avatar}
        alt={name}
        referrerPolicy="no-referrer"
        loading="lazy"
        decoding="async"
        className="w-full h-full object-cover"
      />
    ) : (
      <div className="w-full h-full flex items-center justify-center text-6xl serif text-ink/20">
        {name.charAt(0)}
      </div>
    )}
  </div>
);

export default ProfileHeroPhoto;
