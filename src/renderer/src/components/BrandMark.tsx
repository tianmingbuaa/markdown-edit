export function BrandMark() {
  return (
    <span className="brand-mark" aria-hidden="true">
      <svg viewBox="0 0 24 24" role="presentation">
        <path
          className="brand-mark__page"
          d="M6.75 4.1h6.7l3.8 3.8v12H6.75z"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.35"
          strokeLinejoin="round"
        />
        <path
          className="brand-mark__fold"
          d="M13.45 4.1v3.8h3.8"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.35"
          strokeLinejoin="round"
        />
        <path
          className="brand-mark__line"
          d="M9.55 11.2h4.8M9.55 14.2h5.35M9.55 17.2h3.1"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.25"
          strokeLinecap="round"
        />
        <circle className="brand-mark__dot" cx="17.45" cy="17.35" r="1.55" />
      </svg>
    </span>
  )
}
