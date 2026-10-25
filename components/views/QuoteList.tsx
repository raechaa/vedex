// components/views/QuoteList.tsx

'use client';

import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Quote, FileQuestion, ChevronDown, ChevronRight, User, LayoutTemplate, Search, Plus, X, Loader2 } from 'lucide-react';
import { runQuoteQuery } from '@/lib/actions';

export default function QuoteList({ quotes, onSelectQuote, fadeVariants, userName = '' }) {
  const [ideaText, setIdeaText] = useState('');
  const [queryLoading, setQueryLoading] = useState(false);
  const [queryStatus, setQueryStatus] = useState<{ type: 'info' | 'success' | 'error'; text: string } | null>(null);

  const handleQuery = async () => {
    if (!ideaText.trim() || queryLoading) return;
    setQueryLoading(true);
    setQueryStatus({ type: 'info', text: 'Querying QuoteReseacher...' });
    try {
      const { count } = await runQuoteQuery(ideaText);
      setQueryStatus({ type: 'success', text: `query complete with ${count} quote(s)` });
      setTimeout(() => window.location.reload(), 1500);
    } catch (error) {
      setQueryStatus({ type: 'error', text: error instanceof Error ? error.message : 'Query gagal.' });
      setQueryLoading(false);
    }
  };

  const [groupBy, setGroupBy] = useState('public_figure');
  const [expandedNodes, setExpandedNodes] = useState({});
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const toggleNode = (parentName) => {
    setExpandedNodes(prev => ({ ...prev, [parentName]: !prev[parentName] }));
  };

  // Filter quotes berdasarkan search & status
  const filteredQuotes = useMemo(() => {
    let result = quotes;
    
    // Filter by status
    if (statusFilter !== 'all') {
      result = result.filter(q => q.status === statusFilter);
    }
    
    // Filter by search term
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      result = result.filter(q => 
        (q.public_figure || '').toLowerCase().includes(term) ||
        (q.main_topic || '').toLowerCase().includes(term) ||
        (q.quote_text || '').toLowerCase().includes(term)
      );
    }
    
    return result;
  }, [quotes, searchTerm, statusFilter]);

  const groupedData = filteredQuotes.reduce((acc, curr) => {
    const key = curr[groupBy] || 'Uncategorized';
    if (!acc[key]) acc[key] = [];
    acc[key].push(curr);
    return acc;
  }, {});

  return (
    <div className="w-full max-w-4xl flex flex-col gap-4 overflow-y-auto max-h-full">
    <motion.div
      key="idea-box"
      variants={fadeVariants}
      initial="hidden"
      animate="visible"
      exit="exit"
      className="w-full bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl shadow-2xl p-6 text-white"
    >
      <h2 className="text-lg font-semibold mb-3">What's your Idea, {userName} ?</h2>
      <input
        id="idea-input"
        type="text"
        value={ideaText}
        onChange={(e) => setIdeaText(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && handleQuery()}
        disabled={queryLoading}
        placeholder="Tulis ide atau topik quote..."
        className="w-full bg-white/5 border border-white/20 rounded-lg px-4 py-3 text-sm text-white placeholder-white/40 outline-none focus:border-blue-400/50 transition-colors disabled:opacity-60"
      />
      <div className="flex items-center gap-4 mt-3">
        <button
          id="idea-query-button"
          onClick={handleQuery}
          disabled={queryLoading || !ideaText.trim()}
          className="flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-medium bg-blue-500/60 hover:bg-blue-500/80 border border-blue-400 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {queryLoading && <Loader2 size={14} className="animate-spin" />}
          Query
        </button>
        {queryStatus && (
          <span className={`text-sm ${queryStatus.type === 'error' ? 'text-red-300' : queryStatus.type === 'success' ? 'text-green-300' : 'text-white/70'}`}>
            {queryStatus.text}
          </span>
        )}
      </div>
    </motion.div>

    <motion.div 
      layoutId="main-container" 
      key="quotes" 
      variants={fadeVariants} 
      initial="hidden" 
      animate="visible" 
      exit="exit" 
      className="w-full bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl shadow-2xl p-8 text-white"
    >
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-semibold flex items-center gap-2">
          <Quote size={20} className="text-yellow-300" />
          Quote Collection
          <span className="text-xs text-white/50 font-normal">({filteredQuotes.length} quotes)</span>
        </h2>
        <div className="flex gap-2 text-sm">
          <button 
            onClick={() => setGroupBy('public_figure')} 
            className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all border ${groupBy === 'public_figure' ? 'bg-blue-500/40 border-blue-400' : 'bg-white/5 border-white/10 hover:bg-white/15'}`}
          >
            <User size={14} /> Public Figure
          </button>
          <button 
            onClick={() => setGroupBy('main_topic')} 
            className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all border ${groupBy === 'main_topic' ? 'bg-blue-500/40 border-blue-400' : 'bg-white/5 border-white/10 hover:bg-white/15'}`}
          >
            <LayoutTemplate size={14} /> Main Topic
          </button>
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div className="flex flex-col md:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40" />
          <input 
            type="text"
            placeholder="Cari public figure, topik, atau quote..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-white/5 border border-white/20 rounded-lg pl-10 pr-8 py-2 text-sm text-white placeholder-white/40 outline-none focus:border-blue-400/50 transition-colors"
          />
          {searchTerm && (
            <button 
              onClick={() => setSearchTerm('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white transition-colors"
            >
              <X size={14} />
            </button>
          )}
        </div>
        <div className="flex gap-2">
          <select 
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-white/5 border border-white/20 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-blue-400/50 transition-colors appearance-none"
          >
            <option value="all" className="bg-gray-900">Semua Status</option>
            <option value="Draft" className="bg-gray-900">Draft</option>
            <option value="Published" className="bg-gray-900">Published</option>
          </select>
        </div>
      </div>
      
      {filteredQuotes.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <FileQuestion size={48} className="text-white/20 mb-4" />
          <h3 className="text-lg font-semibold text-white/80 mb-2">
            {searchTerm || statusFilter !== 'all' ? 'Data Tidak Ditemukan' : 'Data Not Found'}
          </h3>
          <p className="text-sm text-white/50 max-w-md">
            {searchTerm || statusFilter !== 'all' 
              ? 'Tidak ada quotes yang cocok dengan pencarian atau filter Anda.' 
              : 'Belum ada quotes yang tersedia di database.'}
          </p>
        </div>
      ) : (
        <div className="space-y-6 w-full">
          {Object.entries(groupedData).map(([parentName, items], idx) => {
            const isExpanded = !!expandedNodes[parentName];
            return (
              <div key={idx} className="relative flex flex-col">
                <div 
                  onClick={() => toggleNode(parentName)} 
                  className="flex items-center gap-3 relative z-10 w-max cursor-pointer group"
                >
                  <div className="bg-blue-500/80 backdrop-blur-sm p-2 rounded-full border border-white/30 shadow-lg text-white group-hover:scale-105 transition-transform">
                    <User size={14} />
                  </div>
                  <div className="flex items-center gap-2 bg-white/10 hover:bg-white/20 border border-white/20 px-4 py-2 rounded-xl backdrop-blur-md shadow-lg transition-colors">
                    <h3 className="text-xs font-bold">{parentName}</h3>
                    <span className="text-white/60 text-xs">({items.length})</span>
                    <div className="text-white/60">
                      {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                    </div>
                  </div>
                </div>
                
                <AnimatePresence>
                  {isExpanded && (
                    <motion.div 
                      initial={{ height: 0, opacity: 0 }} 
                      animate={{ height: 'auto', opacity: 1 }} 
                      exit={{ height: 0, opacity: 0 }} 
                      className="relative pl-[38px] overflow-hidden"
                    >
                      <div className="pt-2 pb-2 flex flex-col gap-4">
                        {items.map((item, index) => {
                          const isLast = index === items.length - 1;
                          const isFirst = index === 0;
                          const childLabel = groupBy === 'public_figure' ? item.main_topic : item.public_figure;
                          const isDraft = item.status === 'Draft';
                          
                          return (
                            <div key={item.quote_id} className="relative flex items-center">
                              {/* Tree lines */}
                              <div className={`absolute -left-[20px] w-px bg-white/40 z-0 ${isFirst ? 'top-[-26px] h-[calc(50%+26px)]' : 'top-[-16px] h-[calc(50%+16px)]'}`}></div>
                              {!isLast && <div className="absolute -left-[20px] top-1/2 h-[calc(50%+16px)] w-px bg-white/40 z-0"></div>}
                              <div className="absolute -left-[20px] w-[20px] h-px bg-white/40 z-0"></div>
                              <div className="absolute -left-[22.5px] w-[5px] h-[5px] rounded-full bg-white/80 shadow-[0_0_5px_rgba(255,255,255,0.8)] z-10"></div>
                              
                              {/* Quote card */}
                              <div 
                                onClick={() => isDraft && onSelectQuote(item)}
                                className={`flex flex-col w-full max-w-sm px-4 py-3 rounded-xl border backdrop-blur-md shadow-lg transition-all ${
                                  isDraft 
                                    ? 'bg-yellow-500/10 border-yellow-500/50 cursor-pointer hover:bg-yellow-500/20 hover:-translate-y-1' 
                                    : 'bg-white/5 border-white/10 opacity-80 cursor-default'
                                }`}
                              >
                                <div className="flex justify-between items-center mb-1">
                                  <span className="text-xs font-semibold text-white">{childLabel}</span>
                                  <span className={`text-[9px] uppercase font-bold tracking-wider px-2 py-0.5 rounded border ${
                                    isDraft 
                                      ? 'bg-yellow-500/30 text-yellow-200 border-yellow-500/30' 
                                      : 'bg-green-500/30 text-green-200 border-green-500/30'
                                  }`}>
                                    {item.status}
                                  </span>
                                </div>
                                <p className="text-[11px] text-white/60 italic line-clamp-1 truncate">"{item.quote_text}"</p>
                                {item.agent_stat && (
                                  <div className="mt-2 flex items-center gap-2">
                                    <span className="text-[9px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-purple-500/30 text-purple-200 border border-purple-500/30">
                                      {item.agent_stat}
                                    </span>
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>
      )}
    </motion.div>
    </div>
  );
}