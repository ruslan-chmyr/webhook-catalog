type BrandMarkProps = {
  size?: number;
};

export function BrandMark({ size = 32 }: BrandMarkProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
      <rect width="32" height="32" rx="8" fill="#3182CE" />
      <circle cx="16" cy="10" r="2.2" fill="white" />
      <circle cx="10.5" cy="21" r="2.2" fill="white" />
      <circle cx="21.5" cy="21" r="2.2" fill="white" />
      <path d="M16 12.4 11.4 18.6M16 12.4 20.6 18.6M12.2 21h7.6" stroke="white" strokeWidth="1.5" />
    </svg>
  );
}
