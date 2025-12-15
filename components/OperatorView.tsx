import React, { useState } from 'react';
import { Operator, DailyRoster, SwapRequest, UnavailabilityReason } from '../types';
import { Check, X, Calendar as CalendarIcon, Info, ArrowRightLeft, Bell, AlertCircle, Shield, Briefcase, Plane, Home } from 'lucide-react';

interface OperatorViewProps {
  currentOperator: Operator;
  operators: Operator[];
  monthDates: string[];
  holidays: { date: string; name: string }[];
  roster: DailyRoster[];
  swapRequests: SwapRequest[];
  onUpdatePreferences: (id: string, type: 'preferred' | 'unavailable', date: string, reason?: UnavailabilityReason) => void;
  onUpdateProfile: (id: string, updates: Partial<Operator>) => void;
  onRequestSwap: (req: SwapRequest) => void;
  onProcessSwap: (reqId: string, action: 'ACCEPT' | 'REJECT') => void;
  viewYear: number;
  viewMonthName: string;
}

export const OperatorView: React.FC<OperatorViewProps> = ({
  currentOperator,
  operators,
  monthDates,
  holidays,
  roster,
  swapRequests,
  onUpdatePreferences,
  onUpdateProfile,
  onRequestSwap,
  onProcessSwap,
  viewYear,
  viewMonthName
}) => {
  const [activeTab, setActiveTab] = useState<'PREFERENCES' | 'ROSTER'>('PREFERENCES');
  const [swapTargetDate, setSwapTargetDate] = useState<string>('');
  const [swapWithOp, setSwapWithOp] = useState<string>(''); 
  const [swapWithDate, setSwapWithDate] = useState<string>('');
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [reasonModal, setReasonModal] = useState<{date: string, isOpen: boolean}>({date: '', isOpen: false});

  // Preferences Logic
  const getDayStatus = (date: string) => {
    if (currentOperator.preferredDates.includes(date)) return 'preferred';
    if (currentOperator.unavailableDates.includes(date)) return 'unavailable';
    return 'neutral';
  };

  const handleDayClick = (date: string) => {
    const currentStatus = getDayStatus(date);
    if (currentStatus === 'neutral') {
      onUpdatePreferences(currentOperator.id, 'preferred', date);
    } else if (currentStatus === 'preferred') {
      // Open Reason Modal instead of setting immediately
      setReasonModal({ date, isOpen: true });
    } else {
      // Neutralize
      onUpdatePreferences(currentOperator.id, 'unavailable', date); // This triggers the toggle wrapper to go neutral
    }
  };

  const handleReasonSelect = (reason: UnavailabilityReason) => {
      onUpdatePreferences(currentOperator.id, 'unavailable', reasonModal.date, reason);
      setReasonModal({ date: '', isOpen: false });
  };

  // Roster Logic: Show both Duty and Standby assignments for the current view
  const myAssignmentsInView = roster.filter(r => 
      (r.operatorIds.includes(currentOperator.id) || r.standbyOperatorIds.includes(currentOperator.id)) && 
      monthDates.includes(r.date)
  ).sort((a, b) => a.date.localeCompare(b.date));
  
  // For swap dropdowns, we might want to allow swapping with any known roster date, but let's stick to current view for simplicity
  const allMyDuties = roster.filter(r => r.operatorIds.includes(currentOperator.id));
  
  const incomingRequests = swapRequests.filter(r => r.targetId === currentOperator.id && r.status === 'PENDING');

  const handleSwapClick = () => {
    if(!swapTargetDate || !swapWithOp || !swapWithDate) return;
    setIsConfirmModalOpen(true);
  };

  const confirmSwap = () => {
     const req: SwapRequest = {
         id: Math.random().toString(36).substr(2, 9),
         requesterId: currentOperator.id,
         requesterDate: swapTargetDate,
         targetId: swapWithOp,
         targetDate: swapWithDate,
         status: 'PENDING'
     };
     onRequestSwap(req);
     setSwapTargetDate('');
     setSwapWithOp('');
     setSwapWithDate('');
     setIsConfirmModalOpen(false);
  };

  const getPotentialSwapDates = () => {
      // Show available swaps in the current view
      return roster.filter(r => !r.operatorIds.includes(currentOperator.id) && r.operatorIds.length > 0 && monthDates.includes(r.date));
  };
  const potentialSwapDates = getPotentialSwapDates();

  const targetOperatorName = operators.find(o => o.id === swapWithOp)?.name;

  return (
    <div className="space-y-6 relative">
      {/* Tab Nav */}
      <div className="flex border-b border-slate-200">
        <button 
          onClick={() => setActiveTab('PREFERENCES')}
          className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === 'PREFERENCES' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
        >
          Availability & Roster
        </button>
        <button 
          onClick={() => setActiveTab('ROSTER')}
          className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'ROSTER' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
        >
          Swap Requests & List
          {incomingRequests.length > 0 && (
             <span className="bg-red-500 text-white text-[10px] px-1.5 py-0.5 rounded-full">{incomingRequests.length}</span>
          )}
        </button>
      </div>

      {activeTab === 'PREFERENCES' ? (
        <>
            <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                <div className="flex justify-between items-start">
                    <div>
                        <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                        <CalendarIcon className="w-5 h-5 text-indigo-600" />
                        My Calendar: {viewMonthName} {viewYear}
                        </h2>
                        <p className="text-slate-500 mt-2">
                        Click dates to toggle: <span className="font-semibold text-green-600">Preferred</span> / <span className="font-semibold text-red-500">Unavailable</span>. 
                        </p>
                    </div>
                    
                    <div className="flex flex-col gap-2 text-xs">
                        <div className="flex items-center gap-2"><div className="w-3 h-3 bg-indigo-600 rounded"></div> Duty (You)</div>
                        <div className="flex items-center gap-2"><div className="w-3 h-3 bg-amber-500 rounded"></div> Standby (You)</div>
                    </div>
                </div>

                <div className="mt-4 flex flex-col md:flex-row gap-4 bg-blue-50 p-4 rounded-lg items-start md:items-center">
                    <Info className="w-5 h-5 text-blue-600 shrink-0" />
                    <div className="flex-1 w-full">
                        <label className="block text-sm font-medium text-slate-700 mb-1">Holiday Constraint (Last Year)</label>
                        <select 
                            value={currentOperator.lastYearHoliday || ''}
                            onChange={(e) => onUpdateProfile(currentOperator.id, { lastYearHoliday: e.target.value || null })}
                            className="w-full md:w-1/2 p-2 border border-slate-300 rounded text-sm bg-white"
                        >
                            <option value="">-- None / I didn't work a holiday --</option>
                            {holidays.map(h => (
                                <option key={h.name} value={h.name}>{h.name} ({h.date})</option>
                            ))}
                        </select>
                        <p className="text-xs text-slate-500 mt-1">Select the holiday you worked last year. You will not be assigned to it this year.</p>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-7 gap-2">
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
                <div key={d} className="text-center text-sm font-semibold text-slate-400 py-2">{d}</div>
                ))}
                {monthDates.map(date => {
                const status = getDayStatus(date);
                const holiday = holidays.find(h => h.date === date);
                
                // Check assignments
                const dayRoster = roster.find(r => r.date === date);
                const isDuty = dayRoster?.operatorIds.includes(currentOperator.id);
                const isStandby = dayRoster?.standbyOperatorIds.includes(currentOperator.id);
                
                let partnerName = null;
                if (isDuty && dayRoster) {
                    const partnerId = dayRoster.operatorIds.find(id => id !== currentOperator.id);
                    partnerName = operators.find(o => o.id === partnerId)?.name;
                }

                let bgClass = 'bg-white hover:bg-slate-50 border-slate-200';
                if (status === 'preferred') bgClass = 'bg-green-50 border-green-200';
                if (status === 'unavailable') bgClass = 'bg-red-50 border-red-200';
                
                const reason = currentOperator.unavailabilityReasons[date];

                return (
                    <button
                    key={date}
                    onClick={() => handleDayClick(date)}
                    className={`
                        relative h-28 p-1 rounded-lg border flex flex-col items-start transition-all group overflow-hidden
                        ${bgClass}
                    `}
                    >
                        <div className="flex justify-between w-full p-1">
                            <span className={`text-sm font-medium ${holiday ? 'text-amber-600' : 'text-slate-700'}`}>
                                {parseInt(date.split('-')[2])}
                            </span>
                             <div className="flex gap-1">
                                {status === 'preferred' && <Check className="w-4 h-4 text-green-600" />}
                                {status === 'unavailable' && <X className="w-4 h-4 text-red-500" />}
                            </div>
                        </div>

                        {holiday && <span className="text-[10px] bg-amber-50 px-1 rounded text-amber-600 font-bold uppercase w-full text-left truncate mb-1">{holiday.name}</span>}
                        
                        {status === 'unavailable' && reason && (
                             <div className="w-full text-center my-1">
                                 <span className="text-[10px] font-bold bg-white/50 px-2 py-0.5 rounded border border-red-200 text-red-700">{reason}</span>
                             </div>
                        )}

                        {/* Assignment Badges */}
                        <div className="mt-auto w-full flex flex-col gap-1">
                            {isDuty && (
                                <div className="bg-indigo-600 text-white text-xs p-1.5 rounded text-left shadow-sm">
                                    <div className="font-bold">On Duty</div>
                                    <div className="text-[10px] opacity-90 truncate">w/ {partnerName || '?'}</div>
                                </div>
                            )}
                            {isStandby && (
                                <div className="bg-amber-100 text-amber-800 border border-amber-200 text-xs p-1.5 rounded text-left flex items-center gap-1">
                                    <Shield className="w-3 h-3" />
                                    <span className="font-bold">Standby</span>
                                </div>
                            )}
                        </div>
                    </button>
                );
                })}
            </div>
        </>
      ) : (
        <div className="grid md:grid-cols-2 gap-6">
            {/* List View */}
            <div className="space-y-4">
                <h3 className="font-bold text-slate-800 text-lg flex items-center gap-2">
                    <CalendarIcon className="w-5 h-5" /> Assignments in {viewMonthName}
                </h3>
                {myAssignmentsInView.length === 0 ? (
                    <div className="bg-slate-100 p-8 rounded-lg text-center text-slate-500">
                        No assignments in {viewMonthName} {viewYear}.
                    </div>
                ) : (
                    <div className="space-y-3">
                        {myAssignmentsInView.map(d => {
                             const holiday = holidays.find(h => h.date === d.date);
                             const isDuty = d.operatorIds.includes(currentOperator.id);
                             const isStandby = d.standbyOperatorIds.includes(currentOperator.id);
                             
                             let partnerName = null;
                             if (isDuty) {
                                 const partnerId = d.operatorIds.find(id => id !== currentOperator.id);
                                 partnerName = operators.find(op => op.id === partnerId)?.name;
                             }

                             return (
                                <div key={d.date} className={`border p-4 rounded-lg flex justify-between items-center shadow-sm transition-colors ${isDuty ? 'bg-white border-slate-200' : 'bg-amber-50 border-amber-200'}`}>
                                    <div>
                                        <div className="flex items-center gap-3">
                                            <div className="font-bold text-slate-800 text-lg">{d.date}</div>
                                            {isDuty && <span className="text-[10px] bg-indigo-100 text-indigo-700 px-2 py-1 rounded-md font-bold uppercase tracking-wider">On Duty</span>}
                                            {isStandby && <span className="text-[10px] bg-amber-100 text-amber-800 px-2 py-1 rounded-md font-bold uppercase tracking-wider flex items-center gap-1"><Shield className="w-3 h-3" /> Standby</span>}
                                        </div>
                                        {holiday && <div className="text-xs text-amber-600 font-bold mt-1 uppercase">{holiday.name}</div>}
                                    </div>
                                    <div className="text-sm text-right">
                                        {isDuty && (
                                            <div>
                                                <div className="text-xs text-slate-400 font-semibold uppercase">Partner</div>
                                                <div className="font-bold text-slate-700">{partnerName || 'Unknown'}</div>
                                            </div>
                                        )}
                                        {isStandby && (
                                            <div className="text-amber-700 font-medium text-xs italic">
                                                Available for call-up
                                            </div>
                                        )}
                                    </div>
                                </div>
                             )
                        })}
                    </div>
                )}
            </div>

            {/* Swap Actions */}
            <div className="space-y-6">
                {/* Inbox */}
                {incomingRequests.length > 0 && (
                    <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4">
                         <h3 className="font-bold text-indigo-900 text-sm mb-3 flex items-center gap-2">
                             <Bell className="w-4 h-4" /> Swap Requests
                         </h3>
                         <div className="space-y-2">
                             {incomingRequests.map(req => {
                                 const requester = operators.find(o => o.id === req.requesterId);
                                 return (
                                     <div key={req.id} className="bg-white p-3 rounded shadow-sm border border-indigo-100 text-sm">
                                         <p className="text-slate-700 mb-2">
                                             <span className="font-bold">{requester?.name}</span> wants to swap their shift on <span className="font-mono font-bold">{req.requesterDate}</span> with your shift on <span className="font-mono font-bold">{req.targetDate}</span>.
                                         </p>
                                         <div className="flex gap-2">
                                             <button onClick={() => onProcessSwap(req.id, 'ACCEPT')} className="flex-1 bg-green-600 text-white py-1 rounded hover:bg-green-700 text-xs font-bold">Accept</button>
                                             <button onClick={() => onProcessSwap(req.id, 'REJECT')} className="flex-1 bg-red-100 text-red-600 py-1 rounded hover:bg-red-200 text-xs font-bold">Reject</button>
                                         </div>
                                     </div>
                                 )
                             })}
                         </div>
                    </div>
                )}

                {/* Request Swap */}
                <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
                    <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                        <ArrowRightLeft className="w-5 h-5 text-slate-500" /> Request a Swap
                    </h3>
                    
                    <div className="space-y-4">
                        <div>
                            <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">I want to give up my shift on:</label>
                            <select 
                                value={swapTargetDate}
                                onChange={(e) => setSwapTargetDate(e.target.value)}
                                className="w-full p-2 border border-slate-300 rounded-md text-sm"
                            >
                                <option value="">Select a date...</option>
                                {/* Show ALL duties for swap selection, not just current month, in case they want to swap out of a different month */}
                                {allMyDuties.map(d => (
                                    <option key={d.date} value={d.date}>{d.date}</option>
                                ))}
                            </select>
                        </div>

                        <div>
                             <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">And take shift from ({viewMonthName}):</label>
                             <select
                                value={swapWithDate + '::' + swapWithOp}
                                onChange={(e) => {
                                    const [date, opId] = e.target.value.split('::');
                                    setSwapWithDate(date);
                                    setSwapWithOp(opId);
                                }}
                                disabled={!swapTargetDate}
                                className="w-full p-2 border border-slate-300 rounded-md text-sm disabled:bg-slate-100"
                             >
                                 <option value="">Select available shift...</option>
                                 {potentialSwapDates.map(d => (
                                     d.operatorIds.map(opId => {
                                         const op = operators.find(o => o.id === opId);
                                         if (!op) return null;
                                         return (
                                             <option key={`${d.date}::${opId}`} value={`${d.date}::${opId}`}>
                                                 {d.date} - {op.name}
                                             </option>
                                         )
                                     })
                                 ))}
                             </select>
                        </div>

                        <button 
                            onClick={handleSwapClick}
                            disabled={!swapTargetDate || !swapWithOp}
                            className="w-full bg-slate-900 text-white py-2 rounded-md font-medium hover:bg-slate-800 disabled:opacity-50 transition-colors"
                        >
                            Send Request
                        </button>
                    </div>
                </div>
            </div>
        </div>
      )}

      {/* Confirmation Modal */}
      {isConfirmModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
              <div className="bg-white rounded-xl shadow-2xl max-w-sm w-full p-6">
                  <div className="flex flex-col items-center text-center">
                      <div className="w-12 h-12 bg-amber-100 rounded-full flex items-center justify-center mb-4">
                          <AlertCircle className="w-6 h-6 text-amber-600" />
                      </div>
                      <h3 className="text-lg font-bold text-slate-800 mb-2">Confirm Swap Request</h3>
                      <div className="flex gap-3 w-full mt-4">
                          <button onClick={() => setIsConfirmModalOpen(false)} className="flex-1 px-4 py-2 bg-slate-100 rounded-lg font-bold">Cancel</button>
                          <button onClick={confirmSwap} className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg font-bold">Confirm</button>
                      </div>
                  </div>
              </div>
          </div>
      )}

      {/* Reason Selection Modal */}
      {reasonModal.isOpen && (
           <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in">
                <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6">
                     <div className="flex justify-between items-center mb-4">
                         <h3 className="text-lg font-bold text-slate-800">Select Unavailability Reason</h3>
                         <button onClick={() => setReasonModal({date: '', isOpen: false})}><X className="w-5 h-5 text-slate-400" /></button>
                     </div>
                     <p className="text-sm text-slate-500 mb-4">Why are you unavailable on <span className="font-bold text-slate-700">{reasonModal.date}</span>?</p>
                     
                     <div className="grid grid-cols-2 gap-3">
                         <button onClick={() => handleReasonSelect('OFF')} className="p-3 border rounded-lg hover:bg-red-50 hover:border-red-200 flex flex-col items-center gap-2 group">
                             <Home className="w-6 h-6 text-slate-400 group-hover:text-red-500" />
                             <span className="text-xs font-bold text-slate-600 group-hover:text-red-700">OFF Day</span>
                         </button>
                         <button onClick={() => handleReasonSelect('COURSE')} className="p-3 border rounded-lg hover:bg-red-50 hover:border-red-200 flex flex-col items-center gap-2 group">
                             <Briefcase className="w-6 h-6 text-slate-400 group-hover:text-red-500" />
                             <span className="text-xs font-bold text-slate-600 group-hover:text-red-700">Course</span>
                         </button>
                         <button onClick={() => handleReasonSelect('LL')} className="p-3 border rounded-lg hover:bg-red-50 hover:border-red-200 flex flex-col items-center gap-2 group">
                             <Home className="w-6 h-6 text-slate-400 group-hover:text-red-500" />
                             <span className="text-xs font-bold text-slate-600 group-hover:text-red-700">Local Leave</span>
                         </button>
                         <button onClick={() => handleReasonSelect('OSL')} className="p-3 border rounded-lg hover:bg-red-50 hover:border-red-200 flex flex-col items-center gap-2 group">
                             <Plane className="w-6 h-6 text-slate-400 group-hover:text-red-500" />
                             <span className="text-xs font-bold text-slate-600 group-hover:text-red-700">Overseas Leave</span>
                         </button>
                     </div>
                </div>
           </div>
      )}
    </div>
  );
};