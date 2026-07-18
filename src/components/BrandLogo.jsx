export default function BrandLogo() {
  return (
    <div className="brand">
      <svg className="brand-mark" viewBox="0 0 100 120" aria-hidden="true">
        <defs>
          <linearGradient id="brandPinGrad" x1="6" y1="6" x2="94" y2="114" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#FF3B5C" />
            <stop offset="100%" stopColor="#6D4AFF" />
          </linearGradient>
        </defs>
        <path
          fill="url(#brandPinGrad)"
          d="M50,8 C27,8 10,26 10,48 C10,72 50,112 50,112 C50,112 90,72 90,48 C90,26 73,8 50,8 Z"
        />
        <circle cx="50" cy="46" r="26" fill="#FFFFFF" />
        <circle cx="50" cy="46" r="4.5" fill="#221C2B" />
        <line x1="50" y1="46" x2="37" y2="31" stroke="#221C2B" strokeWidth="7" strokeLinecap="round" />
        <line x1="50" y1="46" x2="67" y2="59" stroke="#221C2B" strokeWidth="6" strokeLinecap="round" />
      </svg>
      <h1>Odijjm</h1>
      <span>어디쯤</span>
    </div>
  );
}
