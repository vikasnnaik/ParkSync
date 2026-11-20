'use client';

import React, { useState } from 'react';
import { Database, Code } from 'lucide-react';
import { EMBEDDED_QUERIES } from '../../db/embeddedQueries';
import QueryInspectorModal from './QueryInspectorModal';

/**
 * EmbeddedSqlBadge
 * A faculty-ready interactive component that embeds into UI headers or toolbars.
 * Clicking it reveals the embedded SQL statement, DBMS concept, and bound parameters.
 */
export const EmbeddedSqlBadge = ({ queryKey, label = 'View Embedded SQL', size = 'sm', className = '' }) => {
  const [isOpen, setIsOpen] = useState(false);
  
  const query = EMBEDDED_QUERIES[queryKey];
  if (!query) return null;

  const sizeClasses = {
    xs: 'px-2 py-0.5 text-[11px] gap-1',
    sm: 'px-2.5 py-1 text-xs gap-1.5',
    md: 'px-3 py-1.5 text-sm gap-2'
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className={`inline-flex items-center font-medium rounded-lg border border-teal-200 bg-teal-50/80 text-teal-800 hover:bg-teal-100 hover:border-teal-300 transition-all shadow-2xs hover:shadow-xs cursor-pointer ${sizeClasses[size] || sizeClasses.sm} ${className}`}
        title={`Inspect Embedded SQL: ${query.title}`}
      >
        <Database className="w-3.5 h-3.5 text-teal-600" />
        <span className="font-semibold">{label}</span>
        <span className="px-1.5 py-0.2 rounded bg-teal-200/60 text-teal-900 text-[10px] font-mono uppercase">
          {query.concept.split(',')[0]}
        </span>
      </button>

      {isOpen && (
        <QueryInspectorModal
          isOpen={isOpen}
          onClose={() => setIsOpen(false)}
          query={query}
        />
      )}
    </>
  );
};

export default EmbeddedSqlBadge;

