// Central personalization config. Update the fields below (and drop your
// avatar image at `public/images/avatar.jpg`) — the header, footer, homepage
// hero, and post author card all read from this file.
export const profile = {
  name: "Mustafa Faek Banikhalaf",
  handle: "0xmfbk.sec",
  jobTitle: "Cybersecurity Associate",
  tagline: "Offensive & Defensive Security",
  bio: "Offensive & Defensive Security | Web Application Penetration Testing.",
  // Local path under /public, or a full https URL (e.g. GitHub avatar).
  avatar: "avatar.png",
  links: {
    portfolio: "https://mfbk.onrender.com",
    github: "https://github.com/0xmfbk",
    linkedin: "https://linkedin.com/in/mustafabanikhalaf",
    email: "mailto:mustafabanikhalaf772@gmail.com",
  },
} as const;

export type Profile = typeof profile;
