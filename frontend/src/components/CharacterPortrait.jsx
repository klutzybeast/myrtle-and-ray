import { Link } from "react-router-dom";

export default function CharacterPortrait({ slug, name, image, size = 96 }) {
  return (
    <Link to={`/story#${slug}`} className="block group" data-testid={`portrait-${slug}`}>
      <div className="gradient-ring animate-bob mx-auto" style={{ width: size, height: size }}>
        <img src={image} alt={name} loading="lazy" className="w-full h-full rounded-full object-cover bg-white" />
      </div>
      <div className="text-center mt-2 text-sm font-semibold text-[#2e3a3a] group-hover:text-[#5a8a6f]">{name}</div>
    </Link>
  );
}
