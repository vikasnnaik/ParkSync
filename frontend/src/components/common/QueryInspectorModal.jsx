import React, { useState } from 'react';
import { Database, X, Copy, Check, Terminal, Layers, Info } from 'lucide-react';

/**
 * Format and highlight basic SQL keywords for clean visual presentation in the modal
 */
const highlightSql = (sql) => {
  if (!sql) return '';
  const keywords = [
    'SELECT', 'FROM', 'WHERE', 'JOIN', 'INNER JOIN', 'LEFT JOIN', 'RIGHT JOIN',
    'GROUP BY', 'HAVING', 'ORDER BY', 'ASC', 'DESC', 'LIMIT', 'OFFSET',
    'INSERT INTO', 'VALUES', 'UPDATE', 'SET', 'DELETE',
    'CREATE TABLE', 'IF NOT EXISTS', 'ALTER TABLE', 'DROP TABLE',
    'START TRANSACTION', 'COMMIT', 'ROLLBACK', 'FOR UPDATE', 'FOR SHARE',
    'DELIMITER', 'CREATE TRIGGER', 'AFTER INSERT', 'AFTER UPDATE', 'FOR EACH ROW',
    'BEGIN', 'END', 'AND', 'OR', 'NOT IN', 'IN', 'BETWEEN', 'LIKE', 'ON', 'AS',
    'PRIMARY KEY', 'FOREIGN KEY', 'REFERENCES', 'AUTO_INCREMENT', 'NOT NULL',
    'UNIQUE KEY', 'DEFAULT', 'COUNT', 'SUM', 'AVG', 'COALESCE', 'TIMESTAMPDIFF',
    'NOW', 'LAST_INSERT_ID', 'ON DELETE CASCADE', 'ON DELETE SET NULL'
  ];

  // Regex pattern matching keywords case-insensitively while preserving formatting
  const regex = new RegExp(`\\b(${keywords.join('|')})\\b`, 'gi');
  
  return sql.replace(regex, (match) => {
    return `<span class="text-teal-400 font-semibold">${match.toUpperCase()}</span>`;
  });
};

export const QueryInspectorModal = ({ isOpen, onClose, query }) => {
  const [copied, setCopied] = useState(false);

  if (!isOpen || !query) return null;

  const handleCopy = () => {
    navigator.clipboard.writeText(query.sql);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs">
      <div 
        className="bg-gray-900 border border-gray-800 rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col text-gray-100 overflow-hidden animate-in fade-in zoom-in-95 duration-150"
        role="dialog"
        aria-modal="true"
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-800 flex items-center justify-between bg-gray-900/90">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-teal-500/10 border border-teal-500/20 text-teal-400">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-teal-950 text-teal-300 border border-teal-800">
                  EMBEDDED SQL
                </span>
                <span className="text-xs text-gray-400 font-mono">
                  {query.id}
                </span>
              </div>
              <h2 className="text-base sm:text-lg font-bold text-white mt-0.5">
                {query.title}
              </h2>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-white rounded-lg hover:bg-gray-800 transition"
            title="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Metadata pill bar */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
            <div className="p-3 bg-gray-800/60 rounded-xl border border-gray-700/60">
              <span className="text-gray-400 font-medium block mb-1 flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-teal-400" />
                DBMS Concept Demonstrated:
              </span>
              <span className="text-teal-300 font-semibold text-sm">
                {query.concept}
              </span>
            </div>

            <div className="p-3 bg-gray-800/60 rounded-xl border border-gray-700/60">
              <span className="text-gray-400 font-medium block mb-1 flex items-center gap-1.5">
                <Database className="w-3.5 h-3.5 text-cyan-400" />
                Relational Tables Involved:
              </span>
              <div className="flex flex-wrap gap-1.5">
                {query.tables.map((tbl, i) => (
                  <span 
                    key={i} 
                    className="px-2 py-0.5 bg-gray-900 text-cyan-300 rounded text-xs font-mono border border-gray-700"
                  >
                    {tbl}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Academic explanation */}
          {query.description && (
            <div className="p-3.5 bg-teal-950/30 border border-teal-900/50 rounded-xl text-xs text-teal-200/90 flex gap-2.5 items-start">
              <Info className="w-4 h-4 text-teal-400 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-teal-300 mb-0.5">Academic Evaluation Note:</p>
                <p>{query.description}</p>
              </div>
            </div>
          )}

          {/* Embedded SQL Source Code Display */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-gray-400 flex items-center gap-2">
                <Terminal className="w-3.5 h-3.5 text-teal-400" />
                Embedded SQL Statement (MySQL 8.0 Dialect)
              </span>
              <button
                type="button"
                onClick={handleCopy}
                className="flex items-center gap-1.5 px-3 py-1 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg text-xs transition border border-gray-700 cursor-pointer"
              >
                {copied ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    <span className="text-emerald-400 font-medium">Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copy SQL</span>
                  </>
                )}
              </button>
            </div>

            <div className="relative rounded-xl overflow-hidden border border-gray-800 bg-[#0d1117]">
              <pre className="p-4 text-xs sm:text-sm font-mono text-gray-200 overflow-x-auto whitespace-pre leading-relaxed">
                <code dangerouslySetInnerHTML={{ __html: highlightSql(query.sql) }} />
              </pre>
            </div>
          </div>

          {/* Sample Bound Parameters */}
          {query.sampleParams && Object.keys(query.sampleParams).length > 0 && (
            <div>
              <span className="text-xs font-semibold uppercase tracking-wider text-gray-400 block mb-2">
                Runtime Bound Parameters (Prepared Statement Placeholders)
              </span>
              <div className="bg-gray-800/40 rounded-xl border border-gray-700/60 overflow-hidden">
                <table className="w-full text-xs text-left">
                  <thead className="bg-gray-800/80 text-gray-400 border-b border-gray-700/60">
                    <tr>
                      <th className="px-4 py-2 font-mono">Placeholder / Parameter</th>
                      <th className="px-4 py-2 font-mono">Type</th>
                      <th className="px-4 py-2 font-mono">Example Value</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-800 font-mono">
                    {Object.entries(query.sampleParams).map(([key, val], idx) => (
                      <tr key={idx} className="hover:bg-gray-800/30">
                        <td className="px-4 py-2 text-teal-300">:{key} / ?</td>
                        <td className="px-4 py-2 text-gray-400">{typeof val}</td>
                        <td className="px-4 py-2 text-amber-300">{JSON.stringify(val)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Academic Execution Architecture Banner */}
          <div className="p-3 bg-gray-950 rounded-xl border border-gray-800 text-[11px] text-gray-400 space-y-1">
            <span className="font-semibold text-gray-300 block">
              Embedded Execution Architecture (Secure 3-Tier Academic Design):
            </span>
            <p>
              <span className="text-teal-400 font-mono">React Feature UI</span> 
              {' ➔ '} 
              <span className="text-indigo-400 font-mono">Embedded Parameterized API Call</span> 
              {' ➔ '} 
              <span className="text-cyan-400 font-mono">Express Service Layer</span> 
              {' ➔ '} 
              <span className="text-emerald-400 font-mono">MySQL 8.0 Connection Pool (ACID Execution)</span>
            </p>
            <p className="text-gray-500 italic">
              * Prepared statements and connection pooling protect against SQL Injection and protect database credentials from client exposure while keeping SQL transparent for grading.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-gray-800 bg-gray-900/90 flex justify-between items-center text-xs text-gray-400">
          <span>ParkSync DBMS Mini Project — Evaluator Inspection Tool</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-teal-600 hover:bg-teal-500 text-white rounded-lg font-medium transition cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};

export default QueryInspectorModal;

