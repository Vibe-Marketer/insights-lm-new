
import React from 'react';

interface LogoProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const Logo = ({ size = 'md', className = '' }: LogoProps) => {
  const sizeClasses = {
    sm: 'w-6 h-6',
    md: 'w-8 h-8', 
    lg: 'w-12 h-12'
  };

  const iconSizes = {
    sm: '16px',
    md: '20px',
    lg: '28px'
  };

  return (
    <div className={`${sizeClasses[size]} bg-black rounded-full flex items-center justify-center ${className}`}>
      <svg
        xmlns="http://www.w3.org/2000/svg"
        height={iconSizes[size]}
        viewBox="0 -960 960 960"
        width={iconSizes[size]}
        fill="#FFFFFF"
      >
        <path d="M160-160q-33 0-56.5-23.5T80-240v-480q0-33 23.5-56.5T160-800h640q33 0 56.5 23.5T880-720v480q0 33-23.5 56.5T800-160H160Zm0-80h640v-480H160v480Zm80-80h480v-80H240v80Zm0-160h480v-80H240v80Zm0-160h480v-80H240v80Z" />
      </svg>
    </div>
  );
};

export default Logo;
