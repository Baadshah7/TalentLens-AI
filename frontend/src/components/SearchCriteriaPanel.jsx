import React, { useState } from 'react';
import { Filter, ChevronDown } from 'lucide-react';

const SearchCriteriaPanel = ({
  selectedJob,
  minScore,
  maxScore,
  setMinScore,
  setMaxScore,
  selectedRecs,
  setSelectedRecs,
  skillsFilter,
  setSkillsFilter,
  decisionStatusFilter,
  setDecisionStatusFilter,
  updateUrlFilters,
  getActiveFilterCount
}) => {
  // Default open, persisted in localStorage
  const [isOpen, setIsOpen] = useState(() => {
    const persisted = localStorage.getItem('talentlens_filters_expanded');
    return persisted !== null ? JSON.parse(persisted) : true;
  });

  const togglePanel = () => {
    const nextState = !isOpen;
    setIsOpen(nextState);
    localStorage.setItem('talentlens_filters_expanded', JSON.stringify(nextState));
  };

  const clearAllFilters = () => {
    setMinScore(0);
    setMaxScore(100);
    setSelectedRecs([]);
    setSkillsFilter('');
    setDecisionStatusFilter('');
    updateUrlFilters(0, 100, [], '', '');
  };

  const activeFilters = getActiveFilterCount();

  return (
    <div className="glass-panel border border-slate-800/80 rounded-2xl shadow-xl bg-slate-900/40 backdrop-blur-md overflow-hidden transition-all duration-300">
      {/* Header / Accordion trigger */}
      <div 
        onClick={togglePanel}
        className="flex justify-between items-center px-6 py-4 cursor-pointer hover:bg-slate-900/20 transition-colors border-b border-slate-850"
      >
        <div className="flex items-center space-x-2.5">
          <Filter className="h-4.5 w-4.5 text-indigo-400" />
          <h4 className="font-semibold text-slate-100 text-sm flex items-center">
            <span>Search Criteria & Filters</span>
            {activeFilters > 0 && (
              <span className="ml-2 px-2 py-0.5 text-[10px] font-bold bg-indigo-950/80 border border-indigo-500/50 text-indigo-300 rounded-full shadow-sm animate-pulse">
                {activeFilters} active {activeFilters === 1 ? 'filter' : 'filters'}
              </span>
            )}
          </h4>
        </div>
        <div className="flex items-center space-x-4">
          {activeFilters > 0 && (
            <button 
              onClick={(e) => {
                e.stopPropagation();
                clearAllFilters();
              }}
              className="text-xs text-indigo-400 hover:text-indigo-300 font-bold transition hover:underline"
            >
              Clear Filters
            </button>
          )}
          <ChevronDown className={`h-4.5 w-4.5 text-slate-400 transition-transform duration-300 ${isOpen ? 'transform rotate-180' : ''}`} />
        </div>
      </div>

      {/* Collapsible panel body */}
      <div className={`transition-all duration-350 ease-in-out ${isOpen ? 'max-h-[800px] opacity-100 p-6' : 'max-h-0 opacity-0 overflow-hidden'}`}>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          
          {/* Column 1: Score Range */}
          <div className="space-y-3.5 pr-2">
            <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Score Range</label>
            <div className="space-y-2">
              <div className="flex items-center space-x-3">
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={minScore}
                  onChange={(e) => {
                    const val = Number(e.target.value);
                    setMinScore(val);
                    updateUrlFilters(val, maxScore, selectedRecs, skillsFilter, decisionStatusFilter);
                  }}
                  className="w-1/2 h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-500 focus:outline-none"
                />
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={maxScore}
                  onChange={(e) => {
                    const val = Number(e.target.value);
                    setMaxScore(val);
                    updateUrlFilters(minScore, val, selectedRecs, skillsFilter, decisionStatusFilter);
                  }}
                  className="w-1/2 h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-500 focus:outline-none"
                />
              </div>
              <div className="flex justify-between items-center text-[10px] text-indigo-400 font-bold bg-slate-950/40 p-2 rounded-lg border border-slate-900 shadow-inner">
                <span>Min: {minScore}%</span>
                <span>Max: {maxScore}%</span>
              </div>
            </div>
          </div>

          {/* Column 2: AI Match Recommendations */}
          <div className="space-y-3.5 md:border-l border-slate-850 md:pl-6 pr-2">
            <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">AI Match Recommendation</label>
            <div className="flex flex-wrap gap-1.5 pt-0.5">
              {['Strong Match', 'Good Match', 'Potential Match', 'Low Match'].map(rec => {
                const isSelected = selectedRecs.includes(rec);
                return (
                  <button
                    key={rec}
                    onClick={() => {
                      const newRecs = isSelected 
                        ? selectedRecs.filter(r => r !== rec)
                        : [...selectedRecs, rec];
                      setSelectedRecs(newRecs);
                      updateUrlFilters(minScore, maxScore, newRecs, skillsFilter, decisionStatusFilter);
                    }}
                    className={`px-2.5 py-1 rounded-lg text-[9px] font-bold border transition duration-200 active:scale-95 ${
                      isSelected 
                        ? 'bg-indigo-950/60 border-indigo-500 text-indigo-300 font-bold shadow-sm shadow-indigo-950/20' 
                        : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200'
                    }`}
                  >
                    {rec.replace(' Match', '')}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Column 3: Skills Search */}
          <div className="space-y-3.5 lg:border-l border-slate-850 lg:pl-6 pr-2">
            <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Skills Search</label>
            <div className="space-y-2">
              <div className="flex flex-wrap gap-1.5 max-h-[80px] overflow-y-auto pr-1">
                {selectedJob?.Required_Skills?.concat(selectedJob?.Preferred_Skills || [])?.slice(0, 8).map(sk => {
                  const isSelected = skillsFilter.toLowerCase().includes(sk.toLowerCase());
                  return (
                    <button
                      key={sk}
                      onClick={() => {
                        let newSkills = skillsFilter;
                        if (isSelected) {
                          newSkills = skillsFilter.split(',').map(s => s.trim()).filter(s => s.toLowerCase() !== sk.toLowerCase()).join(',');
                        } else {
                          newSkills = skillsFilter ? `${skillsFilter}, ${sk}` : sk;
                        }
                        setSkillsFilter(newSkills);
                        updateUrlFilters(minScore, maxScore, selectedRecs, newSkills, decisionStatusFilter);
                      }}
                      className={`px-2 py-0.5 rounded text-[8px] font-bold border transition duration-205 active:scale-95 ${
                        isSelected
                          ? 'bg-emerald-950/60 border-emerald-500 text-emerald-400 font-bold shadow-sm shadow-emerald-950/10'
                          : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200'
                      }`}
                    >
                      {sk}
                    </button>
                  );
                })}
              </div>
              <input
                type="text"
                value={skillsFilter}
                onChange={(e) => {
                  setSkillsFilter(e.target.value);
                  updateUrlFilters(minScore, maxScore, selectedRecs, e.target.value, decisionStatusFilter);
                }}
                placeholder="Search tags (e.g. React, Python)..."
                className="w-full bg-slate-900 border border-slate-800 focus:border-indigo-500 rounded-xl px-3 py-1.5 text-[10px] outline-none text-slate-200 placeholder-slate-600 transition-colors shadow-inner"
              />
            </div>
          </div>

          {/* Column 4: Recruiter Decisions */}
          <div className="space-y-3.5 md:border-l border-slate-850 md:pl-6">
            <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Recruiter Decision</label>
            <select
              value={decisionStatusFilter}
              onChange={(e) => {
                setDecisionStatusFilter(e.target.value);
                updateUrlFilters(minScore, maxScore, selectedRecs, skillsFilter, e.target.value);
              }}
              className="w-full px-3 py-2 bg-slate-900 border border-slate-850 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-xl text-[10px] outline-none text-slate-200 transition"
            >
              <option value="">All Decisions</option>
              <option value="No Decision">Awaiting Review</option>
              <option value="Shortlist">Shortlisted</option>
              <option value="Interview">Interviewing</option>
              <option value="Hold">On Hold</option>
              <option value="Reject">Rejected</option>
            </select>
          </div>

        </div>
      </div>
    </div>
  );
};

export default SearchCriteriaPanel;
