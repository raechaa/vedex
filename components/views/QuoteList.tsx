// components/views/QuoteList.tsx

'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Quote, FileQuestion, ChevronDown, ChevronRight, User, LayoutTemplate } from 'lucide-react';

export default function QuoteList({ quotes, onSelectQuote, fadeVariants }) {
  const [groupBy, setGroupBy] = useState('public_figure');
  const [expandedNodes, setExpandedNodes] = useState({});

  const toggleNode = (parentName) => {
    setExpandedNodes(prev => ({ ...prev, [parentName]: !prev[parentName] }));
  };

  const groupedData = quotes.reduce((acc, curr) => {
    const key = curr[groupBy] || 'Uncategorized';
    if (!acc[key]) acc[key] = [];
    acc[key].push(curr);
    return acc;
  }, {});

  return (
    <motion.div 
      layoutId="main-container" 
      key="quotes" 
      variants={fadeVariants} 
      initial="hidden" 
      animate="visible" 
      exit="exit" 
      className="w-full max-w-4xl bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl shadow-2xl p-8 text-white"
    >
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-semibold flex items-center gap-2">
          <Quote size={20} className="text-yellow-300" />
          Quote Collection
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
      
      {quotes.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <FileQuestion size={48} className="text-white/20 mb-4" />
          <h3 className="text-lg font-semibold text-white/80 mb-2">Data Not Found</h3>
          <p className="text-sm text-white/50 max-w-md">Belum ada quotes yang tersedia di database.</p>
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
  );
}