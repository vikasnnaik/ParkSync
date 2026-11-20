'use client';

import React, { useState } from 'react';
import { 
  Database, 
  Terminal, 
  Layers, 
  CheckCircle2, 
  Copy, 
  Check, 
  Search, 
  Filter, 
  BookOpen, 
  GitBranch, 
  ShieldCheck, 
  Sparkles,
  ArrowRight
} from 'lucide-react';
import { EMBEDDED_QUERIES } from '../../db/embeddedQueries';

const CONCEPTS = [
  'ALL',
  'DDL & Constraints',
  'DML (CRUD)',
  'Subqueries',
  'Database Views',
  'Relational Joins',
  'Aggregates & GROUP BY',
  'ACID Transactions',
  'Database Triggers'
];

export const DbmsSqlShowcase = () => {
  const [selectedConcept, setSelectedConcept] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedId, setCopiedId] = useState(null);

  const queryList = Object.values(EMBEDDED_QUERIES);

  const handleCopy = (id, sql) => {
    navigator.clipboard.writeText(sql);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const filteredQueries = queryList.filter((q) => {
    const matchesConcept = 
      selectedConcept === 'ALL' ||
      (selectedConcept === 'DDL & Constraints' && q.id.includes('DDL')) ||
      (selectedConcept === 'DML (CRUD)' && q.id.includes('DML')) ||
      (selectedConcept === 'Subqueries' && (q.id.includes('SUBQUERY') || q.concept.includes('Subquer'))) ||
      (selectedConcept === 'Database Views' && (q.id.includes('VIEW') || q.concept.includes('View'))) ||
      (selectedConcept === 'Relational Joins' && (q.id.includes('JOIN') || q.concept.includes('JOIN'))) ||
      (selectedConcept === 'Aggregates & GROUP BY' && (q.id.includes('AGGREGATE') || q.id.includes('GROUP_BY') || q.concept.includes('GROUP BY'))) ||
      (selectedConcept === 'ACID Transactions' && (q.id.includes('TRANSACTION') || q.concept.includes('Transaction'))) ||
      (selectedConcept === 'Database Triggers' && (q.id.includes('TRIGGER') || q.concept.includes('Trigger')));

    const matchesSearch = 
      q.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      q.concept.toLowerCase().includes(searchQuery.toLowerCase()) ||
      q.tables.some(t => t.toLowerCase().includes(searchQuery.toLowerCase())) ||
      q.sql.toLowerCase().includes(searchQuery.toLowerCase());

    return matchesConcept && matchesSearch;
  });

  return (
    <div className="space-y-8 max-w-7xl mx-auto pb-12">
      {/* Hero / Viva Header Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-gray-900 via-teal-950 to-gray-900 border border-teal-800/40 p-6 sm:p-8 text-white shadow-xl">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-3 max-w-3xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-teal-500/20 border border-teal-500/30 text-teal-300 text-xs font-semibold tracking-wide">
              <Sparkles className="w-3.5 h-3.5" />
              DBMS MINI PROJECT EVALUATION & VIVA SUITE
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
              Embedded SQL & Relational Database Architecture
            </h1>
            <p className="text-sm sm:text-base text-gray-300 leading-relaxed">
              ParkSync incorporates embedded SQL statements directly throughout the application interface.
              All operations execute on a live <strong>MySQL 8.0 relational database</strong> (<code>parksync_db</code>)
              complemented by <strong>MongoDB</strong> (<code>parksync_logs</code>) for audit logs.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3 shrink-0">
            <div className="p-3.5 rounded-xl bg-white/5 border border-white/10 backdrop-blur-xs text-center">
              <div className="text-2xl font-black text-teal-400">10</div>
              <div className="text-[11px] text-gray-400 font-medium">Relational Tables</div>
            </div>
            <div className="p-3.5 rounded-xl bg-white/5 border border-white/10 backdrop-blur-xs text-center">
              <div className="text-2xl font-black text-cyan-400">13</div>
              <div className="text-[11px] text-gray-400 font-medium">DBMS Topics Covered</div>
            </div>
            <div className="p-3.5 rounded-xl bg-white/5 border border-white/10 backdrop-blur-xs text-center">
              <div className="text-2xl font-black text-emerald-400">4</div>
              <div className="text-[11px] text-gray-400 font-medium">Active Triggers</div>
            </div>
            <div className="p-3.5 rounded-xl bg-white/5 border border-white/10 backdrop-blur-xs text-center">
              <div className="text-2xl font-black text-amber-400">100%</div>
              <div className="text-[11px] text-gray-400 font-medium">ACID Compliant</div>
            </div>
          </div>
        </div>

        {/* Decorative background glow */}
        <div className="absolute top-0 right-0 -mr-20 -mt-20 w-80 h-80 bg-teal-500/10 rounded-full blur-3xl pointer-events-none" />
      </div>

      {/* Core Syllabus Checklist Grid */}
      <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-xs space-y-4">
        <h2 className="text-base font-bold text-gray-900 flex items-center gap-2">
          <BookOpen className="w-5 h-5 text-teal-600" />
          Academic DBMS Concepts Demonstrated in Source Code
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {[
            { title: '1. DDL (Data Definition)', desc: 'CREATE TABLE, ALTER, DROP with engine specs', status: 'Implemented' },
            { title: '2. DML (Data Manipulation)', desc: 'INSERT, SELECT, UPDATE, DELETE queries', status: 'Implemented' },
            { title: '3. Relational Joins', desc: 'INNER JOIN, LEFT JOIN across 5 tables', status: 'Implemented' },
            { title: '4. Aggregate Functions', desc: 'COUNT, SUM, AVG with COALESCE', status: 'Implemented' },
            { title: '5. GROUP BY & HAVING', desc: 'Capacity aggregation with post-filters', status: 'Implemented' },
            { title: '6. ORDER BY & Sorting', desc: 'Ascending/Descending multi-column ordering', status: 'Implemented' },
            { title: '7. WHERE Predicates', desc: 'BETWEEN, LIKE, IN, AND, OR conditions', status: 'Implemented' },
            { title: '8. Subqueries (Nested)', desc: 'Correlated NOT IN slot elimination', status: 'Implemented' },
            { title: '9. Keys & Referencing', desc: 'Primary Keys, Foreign Keys, ON DELETE CASCADE', status: 'Implemented' },
            { title: '10. Schema Constraints', desc: 'UNIQUE, ENUM, NOT NULL, AUTO_INCREMENT', status: 'Implemented' },
            { title: '11. Database Views', desc: 'reservation_details multi-table view', status: 'Implemented' },
            { title: '12. Active Triggers', desc: 'trg_reservation_slot_status, audit triggers', status: 'Implemented' },
            { title: '13. ACID Transactions', desc: 'START TRANSACTION, COMMIT, FOR UPDATE locks', status: 'Implemented' },
          ].map((item, idx) => (
            <div key={idx} className="p-3 rounded-xl bg-gray-50 border border-gray-100 flex items-start gap-3">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <div>
                <h3 className="text-xs font-bold text-gray-900">{item.title}</h3>
                <p className="text-[11px] text-gray-500 mt-0.5">{item.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 3-Tier Academic Execution Architecture Visualizer */}
      <div className="bg-gradient-to-r from-gray-900 to-teal-950 rounded-2xl p-6 border border-teal-900 text-white shadow-md">
        <h2 className="text-sm font-bold uppercase tracking-wider text-teal-400 mb-4 flex items-center gap-2">
          <GitBranch className="w-4 h-4" />
          Embedded SQL 3-Tier Execution Architecture
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-center">
          <div className="p-4 rounded-xl bg-white/5 border border-white/10 text-center space-y-1">
            <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-teal-500/20 text-teal-300">Tier 1: Presentation</span>
            <div className="font-bold text-sm text-white">React Frontend</div>
            <p className="text-[11px] text-gray-400">Embedded SQL definitions & Parameterized UI Dispatch</p>
          </div>

          <div className="hidden md:flex justify-center text-teal-400">
            <ArrowRight className="w-6 h-6 animate-pulse" />
          </div>

          <div className="p-4 rounded-xl bg-white/5 border border-white/10 text-center space-y-1">
            <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300">Tier 2: Application</span>
            <div className="font-bold text-sm text-white">Express Backend</div>
            <p className="text-[11px] text-gray-400">Service Layer, JWT Authentication & Prepared Statements</p>
          </div>

          <div className="p-4 rounded-xl bg-white/5 border border-white/10 text-center space-y-1">
            <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300">Tier 3: Relational</span>
            <div className="font-bold text-sm text-white">MySQL 8.0 Engine</div>
            <p className="text-[11px] text-gray-400">Connection Pool, ACID Transactions, Views & Triggers</p>
          </div>
        </div>
      </div>

      {/* Filter and Search Controls */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search SQL, tables, or concepts..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-white border border-gray-200 rounded-xl text-xs sm:text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 shadow-2xs"
            />
          </div>

          <span className="text-xs text-gray-500">
            Showing <strong>{filteredQueries.length}</strong> of {queryList.length} embedded queries
          </span>
        </div>

        {/* Concept Filter Pills */}
        <div className="flex flex-wrap gap-2">
          {CONCEPTS.map((concept) => (
            <button
              key={concept}
              onClick={() => setSelectedConcept(concept)}
              className={`px-3 py-1.5 rounded-xl text-xs font-medium transition cursor-pointer ${
                selectedConcept === concept
                  ? 'bg-teal-600 text-white shadow-xs font-semibold'
                  : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
              }`}
            >
              {concept}
            </button>
          ))}
        </div>
      </div>

      {/* Queries Showcase Cards */}
      <div className="space-y-6">
        {filteredQueries.map((q) => (
          <div 
            key={q.id} 
            className="bg-white rounded-2xl border border-gray-200 shadow-xs overflow-hidden transition-all hover:border-teal-300"
          >
            {/* Card Header */}
            <div className="p-5 border-b border-gray-100 flex flex-col md:flex-row md:items-center justify-between gap-3 bg-gray-50/50">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="px-2 py-0.5 rounded bg-teal-100 text-teal-800 text-[11px] font-mono font-bold">
                    {q.id}
                  </span>
                  <span className="text-xs font-semibold text-teal-700 bg-teal-50 px-2.5 py-0.5 rounded-full border border-teal-200">
                    {q.concept}
                  </span>
                </div>
                <h2 className="text-base font-bold text-gray-900">
                  {q.title}
                </h2>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleCopy(q.id, q.sql)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 rounded-xl text-xs font-medium shadow-2xs transition cursor-pointer"
                >
                  {copiedId === q.id ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                      <span className="text-emerald-600 font-semibold">Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copy SQL</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Card Body */}
            <div className="p-5 space-y-4">
              {/* Tables involved */}
              <div className="flex items-center gap-2 text-xs">
                <span className="text-gray-500 font-medium">Relational Tables:</span>
                <div className="flex flex-wrap gap-1.5">
                  {q.tables.map((t, idx) => (
                    <span key={idx} className="px-2 py-0.5 rounded bg-gray-100 text-gray-700 font-mono text-[11px]">
                      {t}
                    </span>
                  ))}
                </div>
              </div>

              {/* Academic description */}
              {q.description && (
                <p className="text-xs text-gray-600 leading-relaxed bg-teal-50/50 border border-teal-100 p-3 rounded-xl">
                  <strong className="text-teal-900">DBMS Evaluation Note: </strong>
                  {q.description}
                </p>
              )}

              {/* SQL Code Block */}
              <div className="rounded-xl overflow-hidden border border-gray-800 bg-[#0d1117]">
                <div className="px-4 py-2 bg-gray-900/80 border-b border-gray-800 flex items-center justify-between text-xs text-gray-400">
                  <span className="font-mono flex items-center gap-1.5">
                    <Terminal className="w-3.5 h-3.5 text-teal-400" />
                    MySQL 8.0 Prepared Query
                  </span>
                  <span className="text-[10px] text-gray-500">Parameterized Statement</span>
                </div>
                <pre className="p-4 text-xs font-mono text-gray-200 overflow-x-auto whitespace-pre leading-relaxed">
                  <code>{q.sql}</code>
                </pre>
              </div>

              {/* Sample parameters */}
              {q.sampleParams && Object.keys(q.sampleParams).length > 0 && (
                <div className="text-xs space-y-1.5">
                  <span className="font-semibold text-gray-700">Sample Runtime Parameter Bindings:</span>
                  <div className="bg-gray-50 p-2.5 rounded-xl border border-gray-200/70 font-mono text-[11px] text-gray-600 overflow-x-auto">
                    {JSON.stringify(q.sampleParams, null, 2)}
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default DbmsSqlShowcase;

