import React, { useState, useEffect } from 'react';
import { Operator, DailyRoster, ViewMode, ValidationResult, SwapRequest, TeamType, UnavailabilityReason } from './types';
import { INITIAL_OPERATORS, MOCK_HOLIDAYS } from './constants';
import { OperatorView } from './components/OperatorView';
import { TeamLeadView } from './components/TeamLeadView';
import { AdminView } from './components/AdminView';
import { Users, CalendarDays, ShieldCheck, Save, LogIn, UserCircle, ShieldAlert, ChevronLeft, ChevronRight } from 'lucide-react';

// Define a simplified User type for the auth simulation
type AuthUser = { id: string; name: string; role: 'OPERATOR' | 'TEAM_LEAD' | 'ADMIN' };

const ADMIN_USER: AuthUser = { id: 'admin', name: 'System Administrator', role: 'ADMIN' };

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

const App: React.FC = () => {
  const [activeView, setActiveView] = useState<ViewMode>('OPERATOR');
  const [currentUser, setCurrentUser] = useState<AuthUser>(INITIAL_OPERATORS[0] as unknown as AuthUser); // Default to first op
  
  // Date State - Defaulting to Jan 2026 as requested
  const [viewYear, setViewYear] = useState(2026);
  const [viewMonth, setViewMonth] = useState(0); // 0-indexed (January)

  const [operators, setOperators] = useState<Operator[]>(INITIAL_OPERATORS);
  const [roster, setRoster] = useState<DailyRoster[]>([]);
  const [monthDates, setMonthDates] = useState<string[]>([]);
  const [swapRequests, setSwapRequests] = useState<SwapRequest[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);
  const [startWeekTeam, setStartWeekTeam] = useState<TeamType>('A');

  // Initialize Data & Persistence
  useEffect(() => {
    // Generate dates for current view
    const dates = [];
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    for (let i = 1; i <= daysInMonth; i++) {
      dates.push(`${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`);
    }
    setMonthDates(dates);

    // Load data only once on mount, but refresh dates whenever viewYear/viewMonth changes
    if (!isLoaded) {
        const savedData = localStorage.getItem('dutyFlowData_v4');
        if (savedData) {
            const parsed = JSON.parse(savedData);
            setOperators(parsed.operators || INITIAL_OPERATORS);
            const loadedRoster = parsed.roster || [];
            const hydratedRoster = loadedRoster.map((r: any) => ({
                ...r,
                standbyOperatorIds: r.standbyOperatorIds || []
            }));
            setRoster(hydratedRoster);
            setSwapRequests(parsed.swapRequests || []);
            if (parsed.startWeekTeam) setStartWeekTeam(parsed.startWeekTeam);
        }
        setIsLoaded(true);
    }
  }, [viewYear, viewMonth, isLoaded]);

  // Ensure roster entries exist for the new dates when switching views
  useEffect(() => {
      if (!isLoaded) return;
      
      const newRoster = [...roster];
      let hasChanges = false;

      monthDates.forEach(date => {
          if (!newRoster.find(r => r.date === date)) {
              const holiday = MOCK_HOLIDAYS.find(h => h.date === date);
              newRoster.push({
                  date,
                  operatorIds: [],
                  standbyOperatorIds: [],
                  isHoliday: !!holiday,
                  holidayName: holiday?.name
              });
              hasChanges = true;
          }
      });

      if (hasChanges) {
          setRoster(newRoster);
      }
  }, [monthDates, isLoaded, roster]);

  useEffect(() => {
    if (isLoaded) {
        const data = { operators, roster, swapRequests, startWeekTeam };
        localStorage.setItem('dutyFlowData_v4', JSON.stringify(data));
    }
  }, [operators, roster, swapRequests, startWeekTeam, isLoaded]);

  // --- Auth Simulation Logic ---
  const handleSwitchUser = (userId: string) => {
      if (userId === 'admin') {
          setCurrentUser(ADMIN_USER);
          setActiveView('ADMIN');
      } else {
          const op = operators.find(o => o.id === userId);
          if (op) {
              // Create AuthUser shape from Operator
              const authUser: AuthUser = { id: op.id, name: op.name, role: op.role };
              setCurrentUser(authUser);
              // Default views based on role
              if (op.role === 'TEAM_LEAD') setActiveView('TEAM_LEAD');
              else setActiveView('OPERATOR');
          }
      }
  };

  // --- Navigation Handlers ---
  const handlePrevMonth = () => {
      if (viewMonth === 0) {
          setViewMonth(11);
          setViewYear(prev => prev - 1);
      } else {
          setViewMonth(prev => prev - 1);
      }
  };

  const handleNextMonth = () => {
      if (viewMonth === 11) {
          setViewMonth(0);
          setViewYear(prev => prev + 1);
      } else {
          setViewMonth(prev => prev + 1);
      }
  };

  // --- Handlers ---

  const handleUpdatePreferences = (id: string, type: 'preferred' | 'unavailable', date: string, reason?: UnavailabilityReason) => {
    setOperators(prev => prev.map(op => {
      if (op.id !== id) return op;
      
      const newPreferred = op.preferredDates.filter(d => d !== date);
      const newUnavailable = op.unavailableDates.filter(d => d !== date);
      const newReasons = { ...op.unavailabilityReasons };
      delete newReasons[date];

      if (type === 'preferred') {
        return { ...op, preferredDates: [...newPreferred, date], unavailableDates: newUnavailable, unavailabilityReasons: newReasons };
      } else {
        if (reason) newReasons[date] = reason;
        return { ...op, preferredDates: newPreferred, unavailableDates: [...newUnavailable, date], unavailabilityReasons: newReasons };
      }
    }));
  };
  
  const handleNeutralPreferences = (id: string, date: string) => {
      setOperators(prev => prev.map(op => {
          if (op.id !== id) return op;
          const newReasons = { ...op.unavailabilityReasons };
          delete newReasons[date];
          return {
              ...op,
              preferredDates: op.preferredDates.filter(d => d !== date),
              unavailableDates: op.unavailableDates.filter(d => d !== date),
              unavailabilityReasons: newReasons
          };
      }));
  }

  const updatePrefsWrapper = (id: string, type: 'preferred' | 'unavailable', date: string, reason?: UnavailabilityReason) => {
      const op = operators.find(o => o.id === id);
      if(!op) return;

      const isPref = op.preferredDates.includes(date);
      const isUnav = op.unavailableDates.includes(date);

      if (type === 'preferred' && !isPref && !isUnav) {
          handleUpdatePreferences(id, 'preferred', date);
      } else if (type === 'unavailable' && isPref) {
          handleUpdatePreferences(id, 'unavailable', date, reason || 'OFF');
      } else if (isUnav && type === 'unavailable') {
           // Toggle off: If already unavailable and 'unavailable' is requested, switch to neutral
           handleNeutralPreferences(id, date);
      } else if (isUnav && type !== 'unavailable') {
          handleNeutralPreferences(id, date);
      } else {
           handleUpdatePreferences(id, type, date, reason);
      }
  };

  const handleUpdateProfile = (id: string, updates: Partial<Operator>) => {
    setOperators(prev => prev.map(op => op.id === id ? { ...op, ...updates } : op));
  };

  // Admin Actions
  const handleAddOperator = (op: Operator) => {
      setOperators(prev => [...prev, op]);
  };
  const handleRemoveOperator = (id: string) => {
      setOperators(prev => prev.filter(o => o.id !== id));
      // Clean up roster
      setRoster(prev => prev.map(day => ({
          ...day,
          operatorIds: day.operatorIds.filter(oid => oid !== id),
          standbyOperatorIds: day.standbyOperatorIds.filter(oid => oid !== id)
      })));
  };

  // Swap Logic
  const handleRequestSwap = (request: SwapRequest) => {
    setSwapRequests(prev => [...prev, request]);
  };

  const handleProcessSwap = (requestId: string, action: 'ACCEPT' | 'REJECT') => {
    setSwapRequests(prev => prev.filter(r => r.id !== requestId));
    if (action === 'ACCEPT') {
        const request = swapRequests.find(r => r.id === requestId);
        if (!request) return;

        setRoster(prevRoster => {
            const newRoster = [...prevRoster];
            const reqDayIdx = newRoster.findIndex(r => r.date === request.requesterDate);
            const tarDayIdx = newRoster.findIndex(r => r.date === request.targetDate);

            if (reqDayIdx === -1 || tarDayIdx === -1) return newRoster;

            const reqDay = { ...newRoster[reqDayIdx] };
            reqDay.operatorIds = reqDay.operatorIds.map(id => id === request.requesterId ? request.targetId : id);

            const tarDay = { ...newRoster[tarDayIdx] };
            tarDay.operatorIds = tarDay.operatorIds.map(id => id === request.targetId ? request.requesterId : id);

            newRoster[reqDayIdx] = reqDay;
            newRoster[tarDayIdx] = tarDay;
            return newRoster;
        });
    }
  };

  // --- Logic Validator ---
  
  const getWeekNumber = (dateStr: string) => {
      const date = new Date(dateStr);
      const firstDay = new Date(date.getFullYear(), date.getMonth(), 1);
      const offset = firstDay.getDay(); 
      return Math.ceil((date.getDate() + offset) / 7);
  };

  const getDutyTeamForDate = (dateStr: string) => {
      const weekNum = getWeekNumber(dateStr);
      const isOddWeek = weekNum % 2 !== 0;
      if (startWeekTeam === 'A') return isOddWeek ? 'A' : 'B';
      return isOddWeek ? 'B' : 'A';
  };

  const validateRoster = (): ValidationResult => {
    const messages: string[] = [];
    let isValid = true;

    // Only validate the currently visible month to avoid clutter
    const currentMonthRoster = roster.filter(r => monthDates.includes(r.date));

    currentMonthRoster.forEach(day => {
        const expectedDutyTeam = getDutyTeamForDate(day.date);
        
        // 2. Duty vs Standby Separation
        const overlap = day.operatorIds.filter(id => day.standbyOperatorIds.includes(id));
        if (overlap.length > 0) {
            isValid = false;
            messages.push(`${day.date}: Operator(s) assigned to both Duty and Standby.`);
        }

        // 3. Team Alignment
        day.operatorIds.forEach(opId => {
            const op = operators.find(o => o.id === opId);
            if (op && op.team !== expectedDutyTeam) {
                isValid = false;
                messages.push(`${day.date}: Operator ${op.name} (Team ${op.team}) assigned Duty, but it is Team ${expectedDutyTeam}'s week.`);
            }
        });
        day.standbyOperatorIds.forEach(opId => {
            const op = operators.find(o => o.id === opId);
            if (op && op.team === expectedDutyTeam) {
                isValid = false;
                messages.push(`${day.date}: Operator ${op.name} (Team ${op.team}) assigned Standby, but they should be on Duty rotation.`);
            }
        });
    });

    operators.forEach(op => {
        // Filter duties to current view to simplify error messaging context
        const dutyDates = currentMonthRoster.filter(r => r.operatorIds.includes(op.id));
        const dutyDateStrings = dutyDates.map(r => r.date).sort();

        // 4. Consecutive Days
        let consecutive = 1;
        for (let i = 1; i < dutyDateStrings.length; i++) {
            const prev = new Date(dutyDateStrings[i-1]);
            const curr = new Date(dutyDateStrings[i]);
            const diffDays = Math.ceil(Math.abs(curr.getTime() - prev.getTime()) / (1000 * 60 * 60 * 24)); 
            if (diffDays === 1) {
                consecutive++;
                if (consecutive > 2) {
                    isValid = false;
                    messages.push(`${op.name}: Working >2 consecutive days ending ${dutyDateStrings[i]}.`);
                }
            } else {
                consecutive = 1;
            }
        }

        // 5. Consecutive Weekends
        const weekendDuties = dutyDateStrings.filter(d => {
            const day = new Date(d).getDay();
            return day === 0 || day === 6; // Sun or Sat
        });
        
        if (weekendDuties.length > 0) {
            const weekendsWorked = new Set<number>();
            weekendDuties.forEach(d => weekendsWorked.add(getWeekNumber(d)));
            const sortedWeeks = Array.from(weekendsWorked).sort((a,b) => a-b);
            
            for(let i=1; i < sortedWeeks.length; i++) {
                if (sortedWeeks[i] === sortedWeeks[i-1] + 1) {
                     isValid = false;
                     messages.push(`${op.name}: Working consecutive weekends (Week ${sortedWeeks[i-1]} & ${sortedWeeks[i]}).`);
                }
            }
        }

        // 7. Unavailable/Off Constraint
        const assignedOnUnavailable = dutyDateStrings.filter(d => op.unavailableDates.includes(d));
        if (assignedOnUnavailable.length > 0) {
             assignedOnUnavailable.forEach(d => {
                 const reason = op.unavailabilityReasons[d] || 'Unavailable';
                 isValid = false;
                 messages.push(`${op.name}: Assigned Duty on ${d} which is marked as ${reason}.`);
             });
        }

        // 8. Specific Holiday Match
        if (op.lastYearHoliday) {
             const workedRestricted = currentMonthRoster.find(r => r.operatorIds.includes(op.id) && r.holidayName === op.lastYearHoliday);
             if (workedRestricted) {
                 isValid = false;
                 messages.push(`${op.name}: Worked ${op.lastYearHoliday} last year, cannot be assigned to it this year.`);
             }
        }
    });

    return { isValid, messages };
  };

  const currentOperatorObject = operators.find(o => o.id === currentUser.id);

  return (
    <div className="min-h-screen flex flex-col">
      <header className="bg-slate-900 text-white p-4 shadow-lg sticky top-0 z-50">
        <div className="max-w-7xl mx-auto space-y-4">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="flex items-center gap-3">
              <div className="bg-indigo-500 p-2 rounded-lg">
                  <CalendarDays className="w-6 h-6 text-white" />
              </div>
              <div>
                  <h1 className="text-xl font-bold tracking-tight">DutyFlow Scheduler</h1>
                  <p className="text-xs text-slate-400">Intelligent Roster Management</p>
              </div>
            </div>
            
            <div className="flex flex-col md:flex-row items-center gap-4 bg-slate-800 p-2 rounded-lg">
              <div className="flex items-center gap-2 px-2 border-r border-slate-700 mr-2">
                  <LogIn className="w-4 h-4 text-slate-400" />
                  <span className="text-xs text-slate-400">Log in as:</span>
                  <select 
                      value={currentUser.id} 
                      onChange={(e) => handleSwitchUser(e.target.value)}
                      className="bg-slate-900 text-white text-sm rounded border border-slate-700 p-1 cursor-pointer focus:ring-1 focus:ring-indigo-500"
                  >
                      <optgroup label="System">
                          <option value="admin">System Admin</option>
                      </optgroup>
                      <optgroup label="Operators">
                          {operators.map(op => (
                              <option key={op.id} value={op.id}>
                                  {op.name} ({op.role === 'TEAM_LEAD' ? 'Lead' : 'Op'})
                              </option>
                          ))}
                      </optgroup>
                  </select>
              </div>

              {/* Navigation */}
              <div className="flex items-center gap-2">
                  {currentUser.role === 'ADMIN' && (
                      <button onClick={() => setActiveView('ADMIN')} className={`flex items-center gap-2 px-3 py-1.5 rounded-md transition-all text-xs font-medium ${activeView === 'ADMIN' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-white'}`}>
                          <ShieldAlert className="w-3 h-3" />
                          Admin Panel
                      </button>
                  )}
                  {currentUser.role !== 'ADMIN' && (
                      <button onClick={() => setActiveView('OPERATOR')} className={`flex items-center gap-2 px-3 py-1.5 rounded-md transition-all text-xs font-medium ${activeView === 'OPERATOR' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-white'}`}>
                          <Users className="w-3 h-3" />
                          My Roster
                      </button>
                  )}
                  {currentUser.role === 'TEAM_LEAD' && (
                      <button onClick={() => setActiveView('TEAM_LEAD')} className={`flex items-center gap-2 px-3 py-1.5 rounded-md transition-all text-xs font-medium ${activeView === 'TEAM_LEAD' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-white'}`}>
                          <ShieldCheck className="w-3 h-3" />
                          Team Management
                      </button>
                  )}
              </div>
            </div>
          </div>

          {/* Date Navigator - Available to all logged in users except Admin View (optional, but keeping consistent) */}
          {activeView !== 'ADMIN' && (
             <div className="flex justify-center items-center gap-4 bg-slate-800/50 p-2 rounded-lg border border-slate-700/50 backdrop-blur-sm max-w-md mx-auto">
                <button 
                  onClick={handlePrevMonth}
                  className="p-1.5 hover:bg-slate-700 rounded-lg text-slate-300 transition-colors"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                
                <div className="flex items-center gap-2 text-white font-bold min-w-[180px] justify-center">
                   <select 
                      value={viewMonth} 
                      onChange={(e) => setViewMonth(parseInt(e.target.value))}
                      className="bg-transparent border-none py-0 pl-2 pr-6 focus:ring-0 cursor-pointer text-right font-bold"
                   >
                      {MONTH_NAMES.map((m, i) => <option key={i} value={i} className="bg-slate-800 text-white">{m}</option>)}
                   </select>
                   <select 
                      value={viewYear} 
                      onChange={(e) => setViewYear(parseInt(e.target.value))}
                      className="bg-transparent border-none py-0 pl-0 pr-6 focus:ring-0 cursor-pointer font-bold"
                   >
                      {[2024, 2025, 2026, 2027, 2028].map(y => <option key={y} value={y} className="bg-slate-800 text-white">{y}</option>)}
                   </select>
                </div>

                <button 
                  onClick={handleNextMonth}
                  className="p-1.5 hover:bg-slate-700 rounded-lg text-slate-300 transition-colors"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
             </div>
          )}
        </div>
      </header>

      <main className="flex-1 bg-slate-50 p-4 md:p-8">
        <div className="max-w-7xl mx-auto">
          
          {/* View Routing */}
          {activeView === 'ADMIN' && currentUser.role === 'ADMIN' && (
              <AdminView 
                operators={operators}
                onAddOperator={handleAddOperator}
                onRemoveOperator={handleRemoveOperator}
                onUpdateOperator={handleUpdateProfile}
              />
          )}

          {activeView === 'OPERATOR' && currentOperatorObject && (
            <div className="flex flex-col gap-6 animate-in fade-in slide-in-from-bottom-2">
                <div className="flex items-center justify-between bg-white p-4 rounded-lg border border-slate-200 shadow-sm">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center font-bold text-slate-600 border-2 border-slate-300 relative">
                            {currentOperatorObject.avatar}
                            <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-blue-600 text-white text-[10px] flex items-center justify-center rounded-full border-2 border-white">
                                {currentOperatorObject.team}
                            </div>
                        </div>
                        <div>
                            <p className="text-sm font-bold text-slate-800">{currentOperatorObject.name}</p>
                            <p className="text-xs text-slate-500 capitalize">{currentOperatorObject.role.replace('_', ' ')}</p>
                        </div>
                    </div>
                    <div className="text-right">
                        <p className="text-sm font-semibold text-slate-700">{MONTH_NAMES[viewMonth]} {viewYear}</p>
                        <p className="text-xs text-slate-500">{monthDates.length} Days to Schedule</p>
                    </div>
                </div>

                <OperatorView 
                    currentOperator={currentOperatorObject}
                    operators={operators}
                    monthDates={monthDates}
                    holidays={MOCK_HOLIDAYS}
                    roster={roster}
                    swapRequests={swapRequests}
                    onUpdatePreferences={updatePrefsWrapper}
                    onUpdateProfile={handleUpdateProfile}
                    onRequestSwap={handleRequestSwap}
                    onProcessSwap={handleProcessSwap}
                    viewYear={viewYear}
                    viewMonthName={MONTH_NAMES[viewMonth]}
                />
            </div>
          )}

          {activeView === 'TEAM_LEAD' && currentUser.role === 'TEAM_LEAD' && (
            <div className="animate-in fade-in slide-in-from-bottom-2">
                <TeamLeadView 
                    operators={operators}
                    roster={roster}
                    setRoster={setRoster}
                    monthDates={monthDates}
                    validateRoster={validateRoster}
                    onUpdateProfile={handleUpdateProfile}
                    startWeekTeam={startWeekTeam}
                    setStartWeekTeam={setStartWeekTeam}
                    holidays={MOCK_HOLIDAYS}
                    viewYear={viewYear}
                    viewMonthName={MONTH_NAMES[viewMonth]}
                />
            </div>
          )}

          {/* Fallback/Error State */}
          {activeView === 'OPERATOR' && !currentOperatorObject && (
              <div className="text-center p-10 text-slate-500">
                  <UserCircle className="w-12 h-12 mx-auto mb-2 text-slate-300" />
                  <p>User profile not found. Please log in again.</p>
              </div>
          )}
        </div>
      </main>
      
      <footer className="bg-white border-t border-slate-200 p-6 text-center text-slate-500 text-sm flex flex-col items-center">
         <p>© {new Date().getFullYear()} DutyFlow. Designed for efficient team scheduling.</p>
         <div className="flex items-center gap-2 mt-2 text-green-600 bg-green-50 px-3 py-1 rounded-full text-xs font-medium">
             <Save className="w-3 h-3" />
             Auto-saving enabled
         </div>
      </footer>
    </div>
  );
};

export default App;