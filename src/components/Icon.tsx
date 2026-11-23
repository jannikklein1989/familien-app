const P: Record<string, string[]> = {
  pulse: ['M3 12h4l3-8 4 16 3-8h4'],
  check: ['M4 7a3 3 0 0 1 3-3h10a3 3 0 0 1 3 3v10a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3z', 'M8.5 12l2.5 2.5 4.5-5'],
  cart: ['M3 4h2l2.5 11h11L21 8H6.2', 'M9 21a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3z', 'M17 21a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3z'],
  bowl: ['M4 11h16v2a7 7 0 0 1-7 7h-2a7 7 0 0 1-7-7z', 'M8 7c0-1.2 1.2-1.2 1.2-2.4M12 7c0-1.2 1.2-1.2 1.2-2.4M16 7c0-1.2 1.2-1.2 1.2-2.4'],
  wallet: ['M3 8a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z', 'M3 10h18', 'M16 15h2'],
  doc: ['M7 3h7l5 5v13H7z', 'M14 3v5h5', 'M10 13h6M10 17h4'],
  gift: ['M4 10h16v10H4z', 'M3 7h18v3H3z', 'M12 7v13', 'M12 7c-2-4-6-3-5 0M12 7c2-4 6-3 5 0'],
  calendar: ['M5 5h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z', 'M3 10h18M8 3v4M16 3v4'],
  heart: ['M20.8 8.6a5 5 0 0 0-8.8-3.2A5 5 0 0 0 3.2 8.6c0 5.4 8.8 11 8.8 11s8.8-5.6 8.8-11z', 'M7 11h3l1.5-2 2 4 1.5-2h2'],
  phone: ['M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2'],
  mic: ['M9 6a3 3 0 0 1 6 0v5a3 3 0 0 1-6 0z', 'M5 11a7 7 0 0 0 14 0', 'M12 18v3'],
  bell: ['M6 8a6 6 0 0 1 12 0c0 7 3 8 3 8H3s3-1 3-8', 'M10 20a2 2 0 0 0 4 0'],
  repeat: ['M4 12a8 8 0 0 1 14-5l2-2v6h-6l2.3-2.3A6 6 0 0 0 6 12'],
  plus: ['M12 5v14M5 12h14'],
  close: ['M6 6l12 12M18 6L6 18'],
  trash: ['M4 7h16', 'M9 7V4h6v3', 'M6 7l1 13h10l1-13'],
  arrow: ['M7 17L17 7M9 7h8v8'],
  chevron: ['M9 6l6 6-6 6'],
  back: ['M15 6l-6 6 6 6'],
  star: ['M12 3l2.8 5.7 6.2.9-4.5 4.4 1 6.2L12 17.3 6.5 20.2l1-6.2L3 9.6l6.2-.9z'],
  link: ['M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1', 'M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1'],
  users: ['M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z', 'M2 21c1-4 4-6 7-6s6 2 7 6', 'M16 3.5a4 4 0 0 1 0 7.5', 'M18 15c2 .7 3.4 2.6 4 6'],
  logout: ['M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3', 'M10 17l-5-5 5-5', 'M5 12h11'],
  sparkle: ['M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z'],
}

export type IconName = keyof typeof P

export function Icon({ name, size = 22, stroke = 2, className = '', label }: { name: IconName; size?: number; stroke?: number; className?: string; label?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={stroke}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      {...(label ? { role: 'img', 'aria-label': label } : { 'aria-hidden': true })}
    >
      {P[name].map((d, i) => <path key={i} d={d} />)}
    </svg>
  )
}
