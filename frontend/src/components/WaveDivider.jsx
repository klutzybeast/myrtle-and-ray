export default function WaveDivider({ flip = false, color = "#fff9f0" }) {
  return (
    <svg className="wave-divider" viewBox="0 0 1440 80" preserveAspectRatio="none" style={{ transform: flip ? "rotate(180deg)" : "none" }} aria-hidden="true">
      <path fill={color} d="M0,32 C240,80 480,0 720,32 C960,64 1200,16 1440,40 L1440,80 L0,80 Z" />
    </svg>
  );
}
