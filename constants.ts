import { Operator } from './types';

// Singapore Public Holidays 2024-2027
export const MOCK_HOLIDAYS = [
  // 2024
  { date: '2024-12-25', name: 'Christmas Day' },
  // 2025
  { date: '2025-01-01', name: 'New Year Day' },
  { date: '2025-01-29', name: 'Chinese New Year' },
  { date: '2025-01-30', name: 'Chinese New Year' },
  { date: '2025-03-31', name: 'Hari Raya Puasa' },
  { date: '2025-04-18', name: 'Good Friday' },
  { date: '2025-05-01', name: 'Labour Day' },
  { date: '2025-05-12', name: 'Vesak Day' },
  { date: '2025-08-09', name: 'National Day' },
  { date: '2025-10-20', name: 'Deepavali' },
  { date: '2025-12-25', name: 'Christmas Day' },
  // 2026
  { date: '2026-01-01', name: 'New Year Day' },
  { date: '2026-02-17', name: 'Chinese New Year' },
  { date: '2026-02-18', name: 'Chinese New Year' },
  { date: '2026-03-20', name: 'Hari Raya Puasa' },
  { date: '2026-04-03', name: 'Good Friday' },
  { date: '2026-05-01', name: 'Labour Day' },
  { date: '2026-05-31', name: 'Vesak Day' },
  { date: '2026-08-09', name: 'National Day' },
  { date: '2026-11-08', name: 'Deepavali' },
  { date: '2026-12-25', name: 'Christmas Day' },
  // 2027
  { date: '2027-01-01', name: 'New Year Day' },
  { date: '2027-02-06', name: 'Chinese New Year' },
  { date: '2027-02-07', name: 'Chinese New Year' },
];

export const INITIAL_OPERATORS: Operator[] = [
  { id: '1', name: 'Alice Chen', avatar: 'AC', role: 'TEAM_LEAD', team: 'A', lastYearHoliday: null, preferredDates: [], unavailableDates: [], unavailabilityReasons: {} },
  { id: '2', name: 'Bob Smith', avatar: 'BS', role: 'OPERATOR', team: 'A', lastYearHoliday: 'Christmas Day', preferredDates: [], unavailableDates: [], unavailabilityReasons: {} },
  { id: '3', name: 'Charlie Davis', avatar: 'CD', role: 'OPERATOR', team: 'A', lastYearHoliday: null, preferredDates: [], unavailableDates: [], unavailabilityReasons: {} },
  { id: '4', name: 'Dana Lee', avatar: 'DL', role: 'TEAM_LEAD', team: 'B', lastYearHoliday: null, preferredDates: [], unavailableDates: [], unavailabilityReasons: {} },
  { id: '5', name: 'Evan Wright', avatar: 'EW', role: 'OPERATOR', team: 'B', lastYearHoliday: 'New Year Day', preferredDates: [], unavailableDates: [], unavailabilityReasons: {} },
  { id: '6', name: 'Fiona Gallagher', avatar: 'FG', role: 'OPERATOR', team: 'B', lastYearHoliday: null, preferredDates: [], unavailableDates: [], unavailabilityReasons: {} },
  { id: '7', name: 'George Hall', avatar: 'GH', role: 'OPERATOR', team: 'A', lastYearHoliday: null, preferredDates: [], unavailableDates: [], unavailabilityReasons: {} },
  { id: '8', name: 'Helen Ivy', avatar: 'HI', role: 'OPERATOR', team: 'B', lastYearHoliday: null, preferredDates: [], unavailableDates: [], unavailabilityReasons: {} },
];