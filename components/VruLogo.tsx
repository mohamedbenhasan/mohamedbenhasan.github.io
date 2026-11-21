import React from 'react';

interface VruLogoProps {
  className?: string;
  alt?: string;
}

export const VruLogo: React.FC<VruLogoProps> = ({
  className = 'w-8 h-8 rounded-lg',
  alt = 'Logo VruGuard',
}) => {
  return (
    <div
      className={`relative overflow-hidden bg-[#f8fafc] border border-slate-700/40 flex items-center justify-center shrink-0 select-none ${className}`}
    >
      <img
        src="/assets/aistudio/logo_2d895bb7.png"
        alt={alt}
        className="w-full h-full object-cover scale-[1.35]"
        draggable={false}
      />
    </div>
  );
};
