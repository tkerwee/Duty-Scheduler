import React, { useState } from 'react';
import { Operator, TeamType, UserRole } from '../types';
import { UserPlus, Trash2, ShieldAlert, Users, AlertCircle, X } from 'lucide-react';

interface AdminViewProps {
  operators: Operator[];
  onAddOperator: (op: Operator) => void;
  onRemoveOperator: (id: string) => void;
  onUpdateOperator: (id: string, updates: Partial<Operator>) => void;
}

export const AdminView: React.FC<AdminViewProps> = ({
  operators,
  onAddOperator,
  onRemoveOperator,
  onUpdateOperator
}) => {
  const [newOpName, setNewOpName] = useState('');
  const [newOpTeam, setNewOpTeam] = useState<TeamType>('A');
  const [deleteConfirm, setDeleteConfirm] = useState<{id: string, name: string} | null>(null);

  const handleAdd = () => {
    if (!newOpName.trim()) return;
    const initials = newOpName.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
    const newOp: Operator = {
      id: Math.random().toString(36).substr(2, 9),
      name: newOpName,
      avatar: initials,
      role: 'OPERATOR',
      team: newOpTeam,
      lastYearHoliday: null,
      preferredDates: [],
      unavailableDates: [],
      unavailabilityReasons: {}
    };
    onAddOperator(newOp);
    setNewOpName('');
  };

  const executeDelete = () => {
      if (deleteConfirm) {
          onRemoveOperator(deleteConfirm.id);
          setDeleteConfirm(null);
      }
  };

  return (
    <div className="space-y-8 animate-in fade-in relative">
      <div className="bg-slate-900 text-white p-6 rounded-xl shadow-md">
        <h2 className="text-2xl font-bold flex items-center gap-3">
          <ShieldAlert className="w-8 h-8 text-red-400" />
          System Administration
        </h2>
        <p className="text-slate-400 mt-1">Manage operator registry, team assignments, and leadership roles.</p>
      </div>

      {/* Add New Operator */}
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
        <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
          <UserPlus className="w-5 h-5 text-indigo-600" />
          Onboard New Operator
        </h3>
        <div className="flex flex-col md:flex-row gap-4 items-end">
          <div className="flex-1 w-full">
            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Full Name</label>
            <input 
              type="text" 
              value={newOpName}
              onChange={(e) => setNewOpName(e.target.value)}
              placeholder="e.g. John Doe"
              className="w-full p-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-indigo-500 focus:outline-none"
            />
          </div>
          <div className="w-full md:w-32">
            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Team</label>
            <select 
              value={newOpTeam}
              onChange={(e) => setNewOpTeam(e.target.value as TeamType)}
              className="w-full p-2 border border-slate-300 rounded-md"
            >
              <option value="A">Team A</option>
              <option value="B">Team B</option>
            </select>
          </div>
          <button 
            onClick={handleAdd}
            disabled={!newOpName.trim()}
            className="w-full md:w-auto px-6 py-2 bg-indigo-600 text-white rounded-md font-bold hover:bg-indigo-700 disabled:opacity-50 transition-colors"
          >
            Add Operator
          </button>
        </div>
      </div>

      {/* Operator List */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
          <h3 className="font-bold text-slate-700 flex items-center gap-2">
            <Users className="w-5 h-5" />
            Active Personnel ({operators.length})
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-slate-500 uppercase bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-6 py-3">Operator</th>
                <th className="px-6 py-3">Team</th>
                <th className="px-6 py-3">Role</th>
                <th className="px-6 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {operators.map(op => (
                <tr key={op.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-4 font-medium text-slate-900 flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center font-bold text-slate-600 text-xs">
                      {op.avatar}
                    </div>
                    {op.name}
                  </td>
                  <td className="px-6 py-4">
                    <select 
                      value={op.team}
                      onChange={(e) => onUpdateOperator(op.id, { team: e.target.value as TeamType })}
                      className={`px-2 py-1 rounded text-xs font-bold border-none ring-1 ring-inset cursor-pointer ${op.team === 'A' ? 'bg-indigo-50 text-indigo-700 ring-indigo-200' : 'bg-amber-50 text-amber-700 ring-amber-200'}`}
                    >
                      <option value="A">Team A</option>
                      <option value="B">Team B</option>
                    </select>
                  </td>
                  <td className="px-6 py-4">
                     <select 
                      value={op.role}
                      onChange={(e) => onUpdateOperator(op.id, { role: e.target.value as UserRole })}
                      className={`px-2 py-1 rounded text-xs font-bold border-none cursor-pointer focus:ring-2 ${op.role === 'TEAM_LEAD' ? 'text-green-700 bg-green-50' : 'text-slate-600 bg-slate-100'}`}
                    >
                      <option value="OPERATOR">Operator</option>
                      <option value="TEAM_LEAD">Team Lead</option>
                    </select>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button 
                      onClick={() => setDeleteConfirm({id: op.id, name: op.name})}
                      className="text-red-500 hover:text-red-700 p-2 hover:bg-red-50 rounded-full transition-colors"
                      title="Remove Operator"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in">
            <div className="bg-white rounded-xl shadow-2xl max-w-sm w-full p-6 animate-in zoom-in-95">
                <div className="flex flex-col items-center text-center">
                    <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mb-4">
                        <AlertCircle className="w-6 h-6 text-red-600" />
                    </div>
                    <h3 className="text-lg font-bold text-slate-800 mb-2">Delete Operator?</h3>
                    <p className="text-sm text-slate-500 mb-6">
                        Are you sure you want to remove <span className="font-bold text-slate-800">{deleteConfirm.name}</span>? This action will remove them from all rosters and cannot be undone.
                    </p>
                    <div className="flex gap-3 w-full">
                        <button 
                            onClick={() => setDeleteConfirm(null)} 
                            className="flex-1 px-4 py-2 bg-slate-100 text-slate-700 rounded-lg font-bold hover:bg-slate-200 transition-colors"
                        >
                            Cancel
                        </button>
                        <button 
                            onClick={executeDelete} 
                            className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg font-bold hover:bg-red-700 transition-colors"
                        >
                            Delete
                        </button>
                    </div>
                </div>
            </div>
        </div>
      )}
    </div>
  );
};