import React from 'react';
import { Loader2 } from 'lucide-react';

export const Loader = ({ message = 'Loading data...', fullHeight = false }) => {
  return (
    <div
      className={`flex flex-col items-center justify-center p-8 ${
        fullHeight ? 'min-h-[400px]' : 'py-12'
      }`}
    >
      <Loader2 className="w-8 h-8 text-teal-600 animate-spin" />
      <p className="mt-3 text-sm font-medium text-gray-500">{message}</p>
    </div>
  );
};

export default Loader;

