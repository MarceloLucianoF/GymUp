import React from 'react';

export default function EmptyState({ icon: Icon, title, description, action }) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-12 px-6 text-gray-500 dark:text-gray-400">
      {Icon && <Icon className="w-12 h-12 mb-4 opacity-40" aria-hidden="true" />}
      <p className="font-bold text-gray-700 dark:text-gray-200">{title}</p>
      {description && <p className="text-sm mt-1 max-w-xs">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
