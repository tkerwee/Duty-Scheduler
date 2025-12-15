export enum ShiftStatus {
    EMPTY = 'EMPTY',
    PARTIAL = 'PARTIAL',
    FILLED = 'FILLED',
    CONFLICT = 'CONFLICT'
  }
  
  export type TeamType = 'A' | 'B';
  export type UnavailabilityReason = 'COURSE' | 'LL' | 'OSL' | 'OFF' | 'OTHER';
  export type UserRole = 'OPERATOR' | 'TEAM_LEAD';

  export interface Operator {
    id: string;
    name: string;
    avatar: string;
    role: UserRole;
    team: TeamType;
    lastYearHoliday: string | null; // The specific holiday name worked last year
    preferredDates: string[]; // ISO date strings
    unavailableDates: string[]; // ISO date strings
    unavailabilityReasons: Record<string, UnavailabilityReason>; // Map date -> reason
  }
  
  export interface DailyRoster {
    date: string; // ISO date string YYYY-MM-DD
    operatorIds: string[]; // Duty Operators
    standbyOperatorIds: string[]; // Standby Operators
    isHoliday: boolean;
    holidayName?: string;
    isLocked?: boolean; // If true, AI generation skips this day
  }
  
  export interface ValidationResult {
    isValid: boolean;
    messages: string[];
  }
  
  export interface GenerationConfig {
    month: number; // 0-11
    year: number;
    holidays: { date: string; name: string }[];
  }

  export interface AIGenerationConfig {
    balanceMode: 'EQUAL' | 'PREFERENCE';
    priorityOperatorIds: string[];
  }

  export interface SwapRequest {
    id: string;
    requesterId: string;
    requesterDate: string;
    targetId: string; // The operator being asked to swap
    targetDate: string;
    status: 'PENDING' | 'ACCEPTED' | 'REJECTED';
  }
  
  export type ViewMode = 'OPERATOR' | 'TEAM_LEAD' | 'ADMIN';