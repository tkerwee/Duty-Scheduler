import React, { useState } from 'react';
import { Operator, DailyRoster, ValidationResult, TeamType, AIGenerationConfig } from '../types';
import { BrainCircuit, Loader2, AlertTriangle, CheckCircle2, RefreshCw, Download, MoreVertical, Trash2, Shield, Users, SlidersHorizontal, ChevronDown, ChevronUp, Lock, Unlock, Calendar, LayoutGrid } from 'lucide-react';
import { aiService } from '../services/aiScheduler';

interface TeamLeadViewProps {
  operators: Operator[];
  roster: DailyRoster[];
  setRoster: (roster: DailyRoster[]) => void;
  monthDates: string[];
  validateRoster: () => ValidationResult;
  onUpdateProfile: (id: string, updates: Partial<Operator>) => void;
  startWeekTeam: TeamType;
  setStartWeekTeam: (t: TeamType) => void;
  holidays: { date: string; name: string }[];
  viewYear: number;
  viewMonthName: string;
}

export const TeamLeadView: React.FC<TeamLeadViewProps> = ({
  operators,
  roster,
  setRoster,
  monthDates,
  validateRoster,
  onUpdateProfile,
  startWeekTeam,
  setStartWeekTeam,
  holidays,
  viewYear,
  viewMonthName
}) => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editMenuOpen, setEditMenuOpen] = useState<{date: string, opId: string, type: 'duty' | 'standby'} | null>(null);
  const [showTeamManager, setShowTeamManager] = useState(false);
  const [showAiConfig, setShowAiConfig] = useState(false);
  const [viewMode, setViewMode] = useState<'ROSTER' | 'YEAR_OVERVIEW'>('ROSTER');
  const [expandedOperatorId, setExpandedOperatorId] = useState<string | null>(null);

  const [aiConfig, setAiConfig] = useState<AIGenerationConfig>({
      balanceMode: 'EQUAL',
      priorityOperatorIds: []
  });
  
  const validation = validateRoster();

  const getWeekNumber = (dateStr: string) => {
      const date = new Date(dateStr);
      const firstDay = new Date(date.getFullYear(), date.getMonth(), 1);
      const offset = firstDay.getDay(); 
      return Math.ceil((date.getDate() + offset) / 7);
  };

  const getDayRoster = (date: string) => roster.find(r => r.date === date);

  const toggleDayLock = (date: string) => {
      const current = getDayRoster(date);
      // Even if entry doesn't exist, we create it to lock it
      const entry = current || { date, operatorIds: [], standbyOperatorIds: [], isHoliday: false, isLocked: false };
      
      const updatedEntry = { ...entry, isLocked: !entry.isLocked };
      
      // Update roster
      const existingIdx = roster.findIndex(r => r.date === date);
      if (existingIdx >= 0) {
          const newRoster = [...roster];
          newRoster[existingIdx] = updatedEntry;
          setRoster(newRoster);
      } else {
          setRoster([...roster, updatedEntry]);
      }
  };

  const handleAutoGenerate = async () => {
    setIsGenerating(true);
    setError(null);
    setShowAiConfig(false);
    try {
      // 1. Identify which days are locked and should NOT be touched
      const lockedDates = roster.filter(r => r.isLocked && monthDates.includes(r.date)).map(r => r.date);

      // 2. Filter days to schedule (exclude locked ones)
      const daysToSchedule = monthDates
        .filter(date => !lockedDates.includes(date))
        .map(date => {
            const existing = roster.find(r => r.date === date);
            const holiday = holidays.find(h => h.date === date);
            
            // Calculate Duty Team logic matching validation
            const weekNum = getWeekNumber(date);
            const isOddWeek = weekNum % 2 !== 0;
            const dutyTeam = startWeekTeam === 'A' ? (isOddWeek ? 'A' : 'B') : (isOddWeek ? 'B' : 'A');

            // We pass existing state (e.g. if partial) but the AI usually overwrites.
            const base = existing || { date, operatorIds: [], standbyOperatorIds: [] };
            return {
                ...base,
                isHoliday: !!holiday,
                holidayName: holiday?.name,
                dutyTeam
            };
      });

      if (daysToSchedule.length === 0) {
          setIsGenerating(false);
          return; 
      }
      
      const generatedDays = await aiService.generateRoster(operators, daysToSchedule, aiConfig);
      
      // 3. Merge: Keep locked days as is, replace unlocked days with new AI result
      const newRoster = [...roster];
      
      // Remove old unlocked entries for this month from the merge target first to avoid dupes/stale data
      // Actually, cleaner way: map over monthDates, if locked get from current roster, else get from generated
      
      // We need to preserve roster entries outside the current month too
      const outsideMonthRoster = roster.filter(r => !monthDates.includes(r.date));
      
      const currentMonthFinal = monthDates.map(date => {
          const lockedEntry = roster.find(r => r.date === date && r.isLocked);
          if (lockedEntry) return lockedEntry;

          const generatedEntry = generatedDays.find(g => g.date === date);
          // If AI didn't return a day (error?), fallback to existing empty or partial
          return generatedEntry || (roster.find(r => r.date === date) ?? {
              date, operatorIds: [], standbyOperatorIds: [], isHoliday: false
          });
      });

      setRoster([...outsideMonthRoster, ...currentMonthFinal]);

    } catch (err) {
      setError("Failed to generate roster. Please check API Key and try again.");
    } finally {
      setIsGenerating(false);
    }
  };

  const togglePriorityOperator = (id: string) => {
      setAiConfig(prev => ({
          ...prev,
          priorityOperatorIds: prev.priorityOperatorIds.includes(id) 
            ? prev.priorityOperatorIds.filter(pid => pid !== id)
            : [...prev.priorityOperatorIds, id]
      }));
  };


  // Helper to check constraints for a potential assignment
  const getViolationWarning = (opId: string, date: string, type: 'duty' | 'standby') => {
      const op = operators.find(o => o.id === opId);
      if(!op) return null;
      
      const violations: string[] = [];
      const currentDay = getDayRoster(date);
      const holiday = holidays.find(h => h.date === date);
      const isHoliday = !!holiday || currentDay?.isHoliday;
      const holidayName = holiday?.name || currentDay?.holidayName;

      // Calculate Expected Team
      const weekNum = getWeekNumber(date);
      const isOddWeek = weekNum % 2 !== 0;
      const expectedDutyTeam = startWeekTeam === 'A' ? (isOddWeek ? 'A' : 'B') : (isOddWeek ? 'B' : 'A');

      // 0. Team Alignment
      if (type === 'duty' && op.team !== expectedDutyTeam) {
          violations.push(`Wrong Team (Need ${expectedDutyTeam})`);
      }
      if (type === 'standby' && op.team === expectedDutyTeam) {
           violations.push(`Should be on Duty Rotation`);
      }

      // 1. Unavailable
      if (op.unavailableDates.includes(date)) {
          const reason = op.unavailabilityReasons[date] || 'Unavailable';
          violations.push(`${reason}`);
      }

      // 2. Already Assigned (Duty <-> Standby conflict)
      if (currentDay) {
          if (type === 'duty' && currentDay.standbyOperatorIds.includes(opId)) {
              violations.push("Already on Standby");
          }
          if (type === 'standby' && currentDay.operatorIds.includes(opId)) {
              violations.push("Already on Duty");
          }
      }

      // 3. Consecutive Duty
      if (type === 'duty') {
           const prevDate = new Date(date);
           prevDate.setDate(prevDate.getDate() - 1);
           const prevDateStr = prevDate.toISOString().split('T')[0];
           
           const prevPrevDate = new Date(date);
           prevPrevDate.setDate(prevPrevDate.getDate() - 2);
           const prevPrevDateStr = prevPrevDate.toISOString().split('T')[0];

           const workedYesterday = roster.find(r => r.date === prevDateStr)?.operatorIds.includes(opId);
           const workedDayBefore = roster.find(r => r.date === prevPrevDateStr)?.operatorIds.includes(opId);

           if (workedYesterday && workedDayBefore) {
               violations.push("Consecutive Limit");
           }
      }

      // 4. Holiday Rule
      if (isHoliday && op.lastYearHoliday === holidayName && type === 'duty') {
          violations.push(`Worked ${op.lastYearHoliday} last year`);
      }

      return violations.length > 0 ? violations.join(', ') : null;
  };


  const modifyOperator = (date: string, oldOpId: string | null, newOpId: string | null, type: 'duty' | 'standby') => {
      const currentRoster = [...roster];
      let dayIndex = currentRoster.findIndex(r => r.date === date);
      if (dayIndex === -1) {
          currentRoster.push({ date, operatorIds: [], standbyOperatorIds: [], isHoliday: false });
          dayIndex = currentRoster.length - 1;
      }
      
      const day = { ...currentRoster[dayIndex] };
      const targetArray = type === 'duty' ? 'operatorIds' : 'standbyOperatorIds';
      
      if (oldOpId && !newOpId) {
          // Remove
          day[targetArray] = day[targetArray].filter(id => id !== oldOpId);
      } else if (!oldOpId && newOpId) {
          // Add (Max 2)
          if (day[targetArray].length < 2) {
            day[targetArray] = [...day[targetArray], newOpId];
          }
      } else if (oldOpId && newOpId) {
          // Replace
          day[targetArray] = day[targetArray].map(id => id === oldOpId ? newOpId : id);
      }
      
      currentRoster[dayIndex] = day;
      setRoster(currentRoster);
      setEditMenuOpen(null);
  };

  const handleExportCalendar = () => {
      let icsContent = "BEGIN:VCALENDAR\nVERSION:2.0\nPRODID:-//DutyFlow//Scheduler//EN\n";
      
      roster.forEach(day => {
          day.operatorIds.forEach(opId => {
              const op = operators.find(o => o.id === opId);
              const startDate = day.date.replace(/-/g, '');
              icsContent += "BEGIN:VEVENT\n";
              icsContent += `DTSTART;VALUE=DATE:${startDate}\n`;
              icsContent += `SUMMARY:Duty - ${op?.name}\n`;
              icsContent += `DESCRIPTION:Duty shift\n`;
              icsContent += "END:VEVENT\n";
          });
          day.standbyOperatorIds.forEach(opId => {
              const op = operators.find(o => o.id === opId);
              const startDate = day.date.replace(/-/g, '');
              icsContent += "BEGIN:VEVENT\n";
              icsContent += `DTSTART;VALUE=DATE:${startDate}\n`;
              icsContent += `SUMMARY:Standby - ${op?.name}\n`;
              icsContent += `DESCRIPTION:Standby shift\n`;
              icsContent += "END:VEVENT\n";
          });
      });
      
      icsContent += "END:VCALENDAR";
      
      const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
      const link = document.createElement('a');
      link.href = window.URL.createObjectURL(blob);
      link.setAttribute('download', 'duty_roster.ics');
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
  };

  const renderSlot = (date: string, ids: string[], type: 'duty' | 'standby', dayEntry: DailyRoster) => {
      const isLocked = dayEntry.isLocked;

      return (
          <div className="flex flex-col gap-2">
             <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                 {type === 'duty' ? 'Active Duty' : 'Standby'}
                 {type === 'standby' && <Shield className="w-3 h-3" />}
             </div>
             {ids.map(opId => {
                const op = operators.find(o => o.id === opId);
                if (!op) return null;
                const isEditingThis = editMenuOpen?.date === date && editMenuOpen?.opId === opId && editMenuOpen?.type === type;
                const warning = getViolationWarning(opId, date, type);

                return (
                    <div key={opId} className="relative group">
                        <div 
                            className={`
                                flex items-center justify-between p-2 rounded-lg text-sm transition-colors border 
                                ${type === 'duty' ? 'bg-indigo-50 border-indigo-100' : 'bg-amber-50 border-amber-100'}
                                ${warning ? 'ring-1 ring-red-400 bg-red-50' : ''}
                                ${isLocked ? 'opacity-80' : 'hover:border-indigo-300 cursor-pointer'}
                            `}
                            onClick={() => !isLocked && setEditMenuOpen(isEditingThis ? null : { date, opId, type })}
                            title={warning || (isLocked ? "Day is locked" : undefined)}
                        >
                            <div className="flex items-center gap-2">
                                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${type === 'duty' ? 'bg-white text-indigo-700' : 'bg-white text-amber-700'}`}>
                                    {op.avatar}
                                </div>
                                <span className={`truncate max-w-[90px] ${warning ? 'text-red-700 font-semibold' : 'text-slate-700'}`}>{op.name}</span>
                            </div>
                            {warning ? <AlertTriangle className="w-4 h-4 text-red-500" /> : (!isLocked && <MoreVertical className="w-4 h-4 text-slate-300" />)}
                        </div>
                        
                        {/* Edit Popover */}
                        {isEditingThis && !isLocked && (
                            <div className="absolute top-full left-0 right-0 z-20 bg-white shadow-xl border border-slate-200 rounded-lg p-2 mt-1 animate-in fade-in slide-in-from-top-1 w-56">
                                {warning && (
                                    <div className="text-[10px] text-red-600 bg-red-50 p-2 rounded mb-2 border border-red-100">
                                        <strong>Violation:</strong> {warning}
                                    </div>
                                )}
                                <div className="text-xs font-semibold text-slate-400 mb-2 px-2">Manage {type === 'duty' ? 'Duty' : 'Standby'}</div>
                                <button 
                                    onClick={(e) => { e.stopPropagation(); modifyOperator(date, opId, null, type); }}
                                    className="w-full text-left px-2 py-1.5 text-xs text-red-600 hover:bg-red-50 rounded flex items-center gap-2"
                                >
                                    <Trash2 className="w-3 h-3" /> Remove
                                </button>
                                <div className="my-1 border-t border-slate-100"></div>
                                <div className="px-2 py-1">
                                    <div className="text-[10px] text-slate-400 mb-1">REPLACE WITH:</div>
                                    <div className="max-h-32 overflow-y-auto">
                                        {operators
                                            .filter(o => !ids.includes(o.id))
                                            .map(o => {
                                                const violation = getViolationWarning(o.id, date, type);
                                                return (
                                                    <button 
                                                        key={o.id}
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            modifyOperator(date, opId, o.id, type);
                                                        }}
                                                        className="w-full text-left px-2 py-1.5 text-xs hover:bg-slate-50 rounded flex items-center justify-between group/opt"
                                                        title={violation || undefined}
                                                    >
                                                        <span>{o.name} <span className="text-[10px] text-slate-400">({o.team})</span></span>
                                                        {violation && <AlertTriangle className="w-3 h-3 text-red-400" />}
                                                    </button>
                                                )
                                            })
                                        }
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                );
             })}
             
             {ids.length < 2 && !isLocked && (
                 <div className="relative">
                    <select 
                        className={`w-full text-xs p-1.5 rounded border border-dashed bg-slate-50 hover:border-indigo-300 cursor-pointer ${type === 'duty' ? 'border-indigo-200 text-indigo-600' : 'border-amber-200 text-amber-600'}`}
                        onChange={(e) => {
                            if(e.target.value) {
                                modifyOperator(date, null, e.target.value, type);
                                e.target.value = '';
                            }
                        }}
                        defaultValue=""
                    >
                        <option value="" disabled>+ Add {type === 'duty' ? 'Operator' : 'Standby'}</option>
                        {operators
                            .filter(op => !ids.includes(op.id))
                            .map(op => {
                                const violation = getViolationWarning(op.id, date, type);
                                return (
                                    <option key={op.id} value={op.id}>
                                        {op.name} ({op.team}) {violation ? `(⚠️)` : ''}
                                    </option>
                                );
                            })}
                    </select>
                 </div>
             )}
          </div>
      )
  };

  const renderYearOverview = () => {
      const months = Array.from({ length: 12 }, (_, i) => i);
      
      return (
          <div className="space-y-6">
              <h3 className="font-bold text-slate-800 text-lg flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-indigo-600" />
                  {viewYear} Annual Operator Schedule
              </h3>
              
              <div className="grid grid-cols-1 gap-4">
                  {operators.map(op => {
                      const isExpanded = expandedOperatorId === op.id;
                      return (
                          <div key={op.id} className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                              <div 
                                onClick={() => setExpandedOperatorId(isExpanded ? null : op.id)}
                                className="flex items-center justify-between p-4 bg-slate-50 cursor-pointer hover:bg-slate-100 transition-colors"
                              >
                                  <div className="flex items-center gap-3">
                                      <div className="w-10 h-10 rounded-full bg-white border border-slate-200 flex items-center justify-center font-bold text-slate-700">
                                          {op.avatar}
                                      </div>
                                      <div>
                                          <div className="font-bold text-slate-800">{op.name}</div>
                                          <div className="text-xs text-slate-500 font-medium">Team {op.team}</div>
                                      </div>
                                  </div>
                                  <div className="flex items-center gap-2 text-sm text-slate-500">
                                      {isExpanded ? "Hide Calendar" : "View Year Calendar"}
                                      {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                                  </div>
                              </div>

                              {isExpanded && (
                                  <div className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 animate-in slide-in-from-top-2">
                                      {months.map(monthIdx => {
                                          const monthName = new Date(viewYear, monthIdx, 1).toLocaleString('default', { month: 'long' });
                                          const daysInMonth = new Date(viewYear, monthIdx + 1, 0).getDate();
                                          const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);
                                          
                                          return (
                                              <div key={monthIdx} className="border border-slate-100 rounded-lg p-2">
                                                  <div className="text-xs font-bold text-slate-600 mb-2 text-center uppercase">{monthName}</div>
                                                  <div className="grid grid-cols-7 gap-1">
                                                      {days.map(day => {
                                                          const dateStr = `${viewYear}-${String(monthIdx + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                                                          const dayEntry = roster.find(r => r.date === dateStr);
                                                          const isDuty = dayEntry?.operatorIds.includes(op.id);
                                                          const isStandby = dayEntry?.standbyOperatorIds.includes(op.id);
                                                          const isUnavailable = op.unavailableDates.includes(dateStr);
                                                          
                                                          let bg = 'bg-slate-100';
                                                          if (isDuty) bg = 'bg-indigo-600';
                                                          else if (isStandby) bg = 'bg-amber-400';
                                                          else if (isUnavailable) bg = 'bg-red-400';
                                                          
                                                          return (
                                                              <div 
                                                                key={day} 
                                                                className={`h-2 w-2 rounded-full mx-auto ${bg}`} 
                                                                title={`${dateStr}: ${isDuty ? 'Duty' : isStandby ? 'Standby' : isUnavailable ? 'Unavailable' : 'Free'}`}
                                                              ></div>
                                                          )
                                                      })}
                                                  </div>
                                              </div>
                                          )
                                      })}
                                  </div>
                              )}
                          </div>
                      )
                  })}
              </div>
          </div>
      )
  };

  return (
    <div className="space-y-6">
      
      {/* Control Panel */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 relative">
        <div>
           <h2 className="text-xl font-bold text-slate-800">Roster Management</h2>
           <p className="text-sm text-slate-500">Review assignments for {viewMonthName} {viewYear}.</p>
        </div>
        <div className="flex gap-3">
             <div className="flex rounded-lg shadow-sm">
                 <button
                    onClick={() => setViewMode('ROSTER')}
                    className={`flex items-center gap-2 px-4 py-2 rounded-l-lg font-medium transition-colors border ${viewMode === 'ROSTER' ? 'bg-indigo-50 border-indigo-200 text-indigo-700' : 'bg-white border-slate-200 text-slate-600'}`}
                 >
                     <LayoutGrid className="w-4 h-4" /> Roster
                 </button>
                 <button
                    onClick={() => setViewMode('YEAR_OVERVIEW')}
                    className={`flex items-center gap-2 px-4 py-2 rounded-r-lg font-medium transition-colors border-t border-b border-r ${viewMode === 'YEAR_OVERVIEW' ? 'bg-indigo-50 border-indigo-200 text-indigo-700' : 'bg-white border-slate-200 text-slate-600'}`}
                 >
                     <Calendar className="w-4 h-4" /> Year View
                 </button>
             </div>

             <button
                onClick={() => setShowTeamManager(!showTeamManager)}
                className="flex items-center gap-2 bg-slate-100 text-slate-700 hover:bg-slate-200 px-4 py-2 rounded-lg font-medium transition-colors border border-slate-200"
             >
                 <Users className="w-4 h-4" /> Teams
             </button>
            <button 
                onClick={handleExportCalendar}
                className="flex items-center gap-2 bg-slate-100 text-slate-700 hover:bg-slate-200 px-4 py-2 rounded-lg font-medium transition-colors"
            >
                <Download className="w-4 h-4" />
                Export
            </button>
            
            <div className="relative">
                <div className="flex rounded-lg shadow-sm">
                    <button 
                        onClick={handleAutoGenerate}
                        disabled={isGenerating || viewMode === 'YEAR_OVERVIEW'}
                        className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-l-lg font-medium transition-colors disabled:opacity-50"
                    >
                        {isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <BrainCircuit className="w-4 h-4" />}
                        {isGenerating ? 'Thinking...' : 'AI Auto-Schedule'}
                    </button>
                    <button 
                        onClick={() => setShowAiConfig(!showAiConfig)}
                        disabled={isGenerating || viewMode === 'YEAR_OVERVIEW'}
                        className="bg-indigo-700 hover:bg-indigo-800 text-white px-2 py-2 rounded-r-lg border-l border-indigo-500 transition-colors disabled:opacity-50"
                        title="AI Configuration"
                    >
                        <SlidersHorizontal className="w-4 h-4" />
                    </button>
                </div>

                {/* AI Configuration Popover */}
                {showAiConfig && (
                    <div className="absolute top-full right-0 mt-2 w-72 bg-white rounded-lg shadow-xl border border-slate-200 z-30 p-4 animate-in fade-in slide-in-from-top-2">
                        <div className="flex justify-between items-center mb-3">
                            <h4 className="font-bold text-slate-700 text-sm">AI Generation Settings</h4>
                        </div>
                        
                        <div className="mb-4">
                            <label className="block text-xs font-semibold text-slate-500 mb-1">Balance Strategy</label>
                            <div className="flex rounded-md shadow-sm">
                                <button 
                                    onClick={() => setAiConfig({...aiConfig, balanceMode: 'EQUAL'})}
                                    className={`flex-1 text-xs py-1.5 px-2 rounded-l border ${aiConfig.balanceMode === 'EQUAL' ? 'bg-indigo-50 border-indigo-200 text-indigo-700 font-bold' : 'bg-white border-slate-300 text-slate-600 hover:bg-slate-50'}`}
                                >
                                    Equal Load
                                </button>
                                <button 
                                    onClick={() => setAiConfig({...aiConfig, balanceMode: 'PREFERENCE'})}
                                    className={`flex-1 text-xs py-1.5 px-2 rounded-r border-t border-b border-r ${aiConfig.balanceMode === 'PREFERENCE' ? 'bg-indigo-50 border-indigo-200 text-indigo-700 font-bold' : 'bg-white border-slate-300 text-slate-600 hover:bg-slate-50'}`}
                                >
                                    Preferences
                                </button>
                            </div>
                        </div>

                        <div>
                            <label className="block text-xs font-semibold text-slate-500 mb-1">Priority Operators (Must Assign)</label>
                            <div className="max-h-32 overflow-y-auto border border-slate-200 rounded-md p-1 bg-slate-50 space-y-1">
                                {operators.map(op => (
                                    <label key={op.id} className="flex items-center gap-2 px-2 py-1 hover:bg-white rounded cursor-pointer text-xs">
                                        <input 
                                            type="checkbox" 
                                            checked={aiConfig.priorityOperatorIds.includes(op.id)}
                                            onChange={() => togglePriorityOperator(op.id)}
                                            className="rounded text-indigo-600 focus:ring-indigo-500"
                                        />
                                        <span className={aiConfig.priorityOperatorIds.includes(op.id) ? 'font-bold text-indigo-700' : 'text-slate-600'}>{op.name}</span>
                                    </label>
                                ))}
                            </div>
                        </div>
                    </div>
                )}
            </div>

            <button 
                onClick={() => setRoster(roster.map(r => r.isLocked ? r : ({...r, operatorIds: [], standbyOperatorIds: []})))}
                disabled={viewMode === 'YEAR_OVERVIEW'}
                className="flex items-center gap-2 bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 px-4 py-2 rounded-lg font-medium transition-colors disabled:opacity-50"
            >
                <RefreshCw className="w-4 h-4" />
                Clear
            </button>
        </div>
      </div>

      {/* Team Manager Panel */}
      {showTeamManager && (
          <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl animate-in slide-in-from-top-2">
              <div className="flex justify-between items-center mb-4">
                  <h3 className="font-bold text-slate-700">Team Assignments</h3>
                  <div className="flex items-center gap-2 text-sm">
                      <span className="text-slate-500">Week 1 of {viewMonthName} Duty Starts with:</span>
                      <button 
                        onClick={() => setStartWeekTeam(startWeekTeam === 'A' ? 'B' : 'A')}
                        className={`px-3 py-1 rounded font-bold transition-colors ${startWeekTeam === 'A' ? 'bg-indigo-100 text-indigo-700' : 'bg-amber-100 text-amber-700'}`}
                      >
                          Team {startWeekTeam}
                      </button>
                  </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                  <div className="bg-white p-3 rounded-lg shadow-sm border border-slate-200">
                      <h4 className="text-xs font-bold text-indigo-600 uppercase mb-2">Team A</h4>
                      <div className="space-y-1">
                          {operators.filter(o => o.team === 'A').map(op => (
                              <div key={op.id} className="flex justify-between items-center text-sm p-2 bg-slate-50 rounded">
                                  <span>{op.name}</span>
                                  <button onClick={() => onUpdateProfile(op.id, {team: 'B'})} className="text-[10px] bg-slate-200 hover:bg-slate-300 px-2 py-1 rounded">Move to B &rarr;</button>
                              </div>
                          ))}
                      </div>
                  </div>
                  <div className="bg-white p-3 rounded-lg shadow-sm border border-slate-200">
                      <h4 className="text-xs font-bold text-amber-600 uppercase mb-2">Team B</h4>
                      <div className="space-y-1">
                          {operators.filter(o => o.team === 'B').map(op => (
                              <div key={op.id} className="flex justify-between items-center text-sm p-2 bg-slate-50 rounded">
                                  <span>{op.name}</span>
                                  <button onClick={() => onUpdateProfile(op.id, {team: 'A'})} className="text-[10px] bg-slate-200 hover:bg-slate-300 px-2 py-1 rounded">&larr; Move to A</button>
                              </div>
                          ))}
                      </div>
                  </div>
              </div>
          </div>
      )}

      {viewMode === 'YEAR_OVERVIEW' ? (
          renderYearOverview()
      ) : (
        <>
            {/* Validation Messages */}
            {!validation.isValid && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                    <div className="flex items-center gap-2 text-amber-800 font-semibold mb-2">
                        <AlertTriangle className="w-5 h-5" />
                        <span>Roster Issues Detected</span>
                    </div>
                    <ul className="list-disc list-inside text-sm text-amber-700 space-y-1">
                        {validation.messages.map((msg, idx) => (
                            <li key={idx}>{msg}</li>
                        ))}
                    </ul>
                </div>
            )}
            
            {validation.isValid && roster.some(r => r.operatorIds.length > 0) && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-center gap-2 text-green-800 font-semibold">
                        <CheckCircle2 className="w-5 h-5" />
                        <span>All roster rules compliant!</span>
                </div>
            )}

            {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-lg">
                    {error}
                </div>
            )}

            {/* Calendar Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {monthDates.map(date => {
                    const dayEntry = getDayRoster(date);
                    const holiday = holidays.find(h => h.date === date);
                    const isHoliday = !!holiday;
                    const holidayName = holiday?.name;

                    // Default empty entry if missing
                    const entry = dayEntry || { date, operatorIds: [], standbyOperatorIds: [], isHoliday: isHoliday, holidayName: holidayName, isLocked: false };

                    return (
                        <div key={date} className={`bg-white rounded-xl border p-4 flex flex-col gap-3 shadow-sm min-h-[250px] transition-all ${entry.isLocked ? 'border-indigo-300 ring-1 ring-indigo-100' : 'border-slate-200'}`}>
                            <div className="flex justify-between items-start border-b border-slate-100 pb-2">
                                <div>
                                    <span className="font-semibold text-slate-700">{date}</span>
                                    {isHoliday && <div className="text-[10px] text-amber-600 font-bold uppercase">{holidayName}</div>}
                                </div>
                                <button 
                                    onClick={() => toggleDayLock(date)}
                                    className={`p-1.5 rounded-md transition-colors ${entry.isLocked ? 'text-indigo-600 bg-indigo-50 hover:bg-indigo-100' : 'text-slate-300 hover:text-slate-500 hover:bg-slate-50'}`}
                                    title={entry.isLocked ? "Unlock Day" : "Lock Day"}
                                >
                                    {entry.isLocked ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
                                </button>
                            </div>

                            <div className={`flex flex-col gap-4 flex-1 ${entry.isLocked ? 'opacity-90 grayscale-[0.2]' : ''}`}>
                                {renderSlot(date, entry.operatorIds, 'duty', entry)}
                                {renderSlot(date, entry.standbyOperatorIds, 'standby', entry)}
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Team Schedule Matrix (Visual Representation) */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 overflow-hidden mt-6">
                <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                    <Users className="w-5 h-5 text-indigo-600" />
                    Team Rotation Matrix
                </h3>
                
                <div className="overflow-x-auto">
                    <div className="min-w-[1000px]">
                        {/* Header Days */}
                        <div className="flex">
                            <div className="w-32 shrink-0 p-2 font-bold text-xs text-slate-500 bg-slate-50 border-b border-r">Operator</div>
                            {monthDates.map(date => {
                                const dayNum = date.split('-')[2];
                                return (
                                    <div key={date} className="flex-1 min-w-[30px] p-2 text-center text-[10px] font-bold text-slate-500 bg-slate-50 border-b border-r border-slate-100">
                                        {dayNum}
                                    </div>
                                );
                            })}
                        </div>

                        {/* Team A Group */}
                        <div className="border-b border-slate-200">
                            <div className="p-1 bg-indigo-50 text-[10px] font-bold text-indigo-700 text-center uppercase tracking-wider">Team A</div>
                            {operators.filter(o => o.team === 'A').map(op => (
                                <div key={op.id} className="flex border-b border-slate-100 last:border-0 hover:bg-slate-50">
                                    <div className="w-32 shrink-0 p-2 text-xs font-medium text-slate-700 border-r flex items-center gap-2">
                                        <span className="w-5 h-5 rounded-full bg-slate-200 flex items-center justify-center text-[9px] font-bold">{op.avatar}</span>
                                        <span className="truncate">{op.name}</span>
                                    </div>
                                    {monthDates.map(date => {
                                        const dayRoster = getDayRoster(date);
                                        const isDuty = dayRoster?.operatorIds.includes(op.id);
                                        const isStandby = dayRoster?.standbyOperatorIds.includes(op.id);
                                        
                                        return (
                                            <div key={date} className="flex-1 min-w-[30px] border-r border-slate-100 relative">
                                                {isDuty && <div className="absolute inset-0.5 bg-indigo-600 rounded-sm shadow-sm" title="Duty"></div>}
                                                {isStandby && <div className="absolute inset-0.5 bg-amber-400 rounded-sm opacity-60" title="Standby"></div>}
                                            </div>
                                        );
                                    })}
                                </div>
                            ))}
                        </div>

                        {/* Team B Group */}
                        <div>
                            <div className="p-1 bg-amber-50 text-[10px] font-bold text-amber-700 text-center uppercase tracking-wider">Team B</div>
                            {operators.filter(o => o.team === 'B').map(op => (
                                <div key={op.id} className="flex border-b border-slate-100 last:border-0 hover:bg-slate-50">
                                    <div className="w-32 shrink-0 p-2 text-xs font-medium text-slate-700 border-r flex items-center gap-2">
                                        <span className="w-5 h-5 rounded-full bg-slate-200 flex items-center justify-center text-[9px] font-bold">{op.avatar}</span>
                                        <span className="truncate">{op.name}</span>
                                    </div>
                                    {monthDates.map(date => {
                                        const dayRoster = getDayRoster(date);
                                        const isDuty = dayRoster?.operatorIds.includes(op.id);
                                        const isStandby = dayRoster?.standbyOperatorIds.includes(op.id);
                                        
                                        return (
                                            <div key={date} className="flex-1 min-w-[30px] border-r border-slate-100 relative">
                                                {isDuty && <div className="absolute inset-0.5 bg-indigo-600 rounded-sm shadow-sm" title="Duty"></div>}
                                                {isStandby && <div className="absolute inset-0.5 bg-amber-400 rounded-sm opacity-60" title="Standby"></div>}
                                            </div>
                                        );
                                    })}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
                
                <div className="mt-4 flex gap-4 text-xs">
                    <div className="flex items-center gap-2">
                        <div className="w-4 h-4 bg-indigo-600 rounded-sm"></div>
                        <span className="text-slate-600 font-medium">Duty Assignment</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-4 h-4 bg-amber-400 opacity-60 rounded-sm"></div>
                        <span className="text-slate-600 font-medium">Standby Assignment</span>
                    </div>
                </div>
            </div>
        </>
      )}
    </div>
  );
};