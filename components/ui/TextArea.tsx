
import React from 'react';

interface TextAreaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {}

const TextArea: React.FC<TextAreaProps> = ({ className, ...props }) => {
  return (
    <textarea
      className={`w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 text-gray-200 focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:bg-gray-800 disabled:cursor-not-allowed ${className}`}
      {...props}
    />
  );
};

export default TextArea;
