import { profile } from "@/config/profile";

type Props = {
  /** Optional overrides for post-level author info coming from the DB. */
  name?: string | null;
  bio?: string | null;
  avatar?: string | null;
  compact?: boolean;
};

export function AuthorCard({ name, bio, avatar, compact = false }: Props) {
  const displayName = name || profile?.name;
  const displayBio = bio || profile?.bio;
  const displayAvatar = avatar || profile?.avatar;
  const { portfolio, github, linkedin, email } = profile?.links || {};

  return (
    <aside
      className={
        // أضفنا w-full لضمان أن البطاقة تأخذ أقصى عرض مسموح لها في المكان الذي توضع فيه
        "rounded-md border border-border bg-surface p-6 flex gap-5 w-full " +
        (compact ? "items-center" : "items-start")
      }
    >
      {displayAvatar && (
        <img
          src={displayAvatar}
          alt={`${displayName} avatar`}
          className={
            // 1. غيرنا rounded-md إلى rounded-full لتصبح الصورة دائرية بالكامل
            // 2. كبرنا الحجم من h-20 w-20 إلى h-28 w-28 (مما يعطيها إطاراً أكبر بوضوح)
            "rounded-full border-2 border-border object-cover shrink-0 " +
            (compact ? "h-20 w-20" : "h-40 w-40")
          }
          onError={(e) => {
            (e.currentTarget as HTMLImageElement).style.display = "none";
          }}
        />
      )}

      <div className="min-w-0">
        <p className="mono text-[11px] uppercase tracking-[0.18em] text-terminal-dim">
          <span className="text-terminal">$</span> whoami
        </p>

        {/* أزلنا كلاس 'truncate' لكي لا يتم قص اسمك الطويل، وكبرنا الخط قليلاً لـ text-lg */}
        <h3 className="mt-1 text-lg font-bold text-foreground">{displayName}</h3>

        <p className="mono text-sm text-terminal mt-1">{profile?.jobTitle}</p>

        {!compact && displayBio && (
          <p className="mt-3 text-sm text-muted-foreground leading-relaxed">{displayBio}</p>
        )}

        {(portfolio || github || linkedin || email) && (
          <div className="mt-4 flex flex-wrap gap-2 mono text-[11px]">
            {portfolio && (
              <a
                href={portfolio}
                target="_blank"
                rel="noopener noreferrer"
                className="terminal-chip hover:text-terminal transition"
              >
                portfolio
              </a>
            )}
            {github && (
              <a
                href={github}
                target="_blank"
                rel="noopener noreferrer"
                className="terminal-chip hover:text-terminal transition"
              >
                github
              </a>
            )}
            {linkedin && (
              <a
                href={linkedin}
                target="_blank"
                rel="noopener noreferrer"
                className="terminal-chip hover:text-terminal transition"
              >
                linkedin
              </a>
            )}
            {email && (
              <a href={`mailto:${email}`} className="terminal-chip hover:text-terminal transition">
                email
              </a>
            )}
          </div>
        )}
      </div>
    </aside>
  );
}
