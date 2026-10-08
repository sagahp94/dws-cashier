import React from 'react';

interface MinimalAppIconProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

export const MinimalAppIcon: React.FC<MinimalAppIconProps> = ({
  className = '',
  size = 'md',
}) => {
  const sizeClasses = {
    sm: 'w-8 h-8 rounded-lg',
    md: 'w-10 h-10 rounded-xl',
    lg: 'w-14 h-14 rounded-2xl',
  }[size];

  const svgSizes = {
    sm: 'w-4 h-4',
    md: 'w-5 h-5',
    lg: 'w-7 h-7',
  }[size];

  return (
    <div
      className={`bg-teal-700 text-white flex items-center justify-center shrink-0 select-none ${sizeClasses} ${className}`}
      aria-label="Quản Lý Phân Quầy Icon"
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={svgSizes}
      >
        <rect
          x="3"
          y="3"
          width="7.5"
          height="7.5"
          rx="2"
          stroke="currentColor"
          strokeWidth="2"
        />
        <rect
          x="13.5"
          y="3"
          width="7.5"
          height="7.5"
          rx="2"
          stroke="currentColor"
          strokeWidth="2"
          className="opacity-70"
        />
        <rect
          x="3"
          y="13.5"
          width="7.5"
          height="7.5"
          rx="2"
          stroke="currentColor"
          strokeWidth="2"
          className="opacity-70"
        />
        <path
          d="M14.5 17.25L16.75 19.5L20.5 15"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
};
