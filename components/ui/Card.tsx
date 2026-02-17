import React from 'react';

// FIX: Extend CardProps with React.HTMLAttributes<HTMLDivElement> to allow passing standard div props like onClick.
interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  className?: string;
}

const Card: React.FC<CardProps> = ({ children, className, ...props }) => {
  return (
    // FIX: Spread the rest of the props to the underlying div element.
    <div className={`bg-gray-800 p-4 rounded-lg border border-gray-700 ${className}`} {...props}>
      {children}
    </div>
  );
};

export default Card;
