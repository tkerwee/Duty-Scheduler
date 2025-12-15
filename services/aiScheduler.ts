import { GoogleGenAI, Type } from "@google/genai";
import { Operator, DailyRoster, AIGenerationConfig } from "../types";

const generateRoster = async (
  operators: Operator[],
  daysToSchedule: { date: string; isHoliday: boolean; holidayName?: string; dutyTeam?: string }[],
  config?: AIGenerationConfig
): Promise<DailyRoster[]> => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) {
    throw new Error("API Key is missing");
  }

  const ai = new GoogleGenAI({ apiKey });

  // Transform data for the prompt
  const operatorSummary = operators.map(op => ({
    id: op.id,
    name: op.name,
    team: op.team,
    lastYearHoliday: op.lastYearHoliday,
    preferred: op.preferredDates,
    unavailable: op.unavailableDates
  }));

  const daySummary = daysToSchedule.map(d => ({
    date: d.date,
    dayOfWeek: new Date(d.date).toLocaleDateString('en-US', { weekday: 'short' }),
    isHoliday: d.isHoliday,
    holidayName: d.holidayName,
    dutyTeam: d.dutyTeam
  }));

  // Construct Custom Instructions based on Config
  let customInstructions = "";
  if (config) {
    customInstructions += `\n    Generation Configuration:\n`;
    customInstructions += `    - Balance Strategy: ${config.balanceMode === 'EQUAL' ? 'Strictly equalize the number of shifts across all operators.' : 'Prioritize assigning operators to their Preferred Dates, even if it causes slight imbalance.'}\n`;
    
    if (config.priorityOperatorIds.length > 0) {
      const priorityNames = operators.filter(o => config.priorityOperatorIds.includes(o.id)).map(o => o.name).join(', ');
      customInstructions += `    - Priority Operators: ${priorityNames} (ID: ${config.priorityOperatorIds.join(', ')}). Ensure these operators are assigned duties if they are available.\n`;
    }
  }

  const prompt = `
    You are an expert Duty Roster Scheduler. 
    Goal: Assign exactly 2 operators for DUTY and 2 operators for STANDBY per day.
    
    Constraints:
    1. Each day MUST have 2 'operatorIds' (Duty) and 2 'standbyOperatorIds' (Standby).
    2. An operator CANNOT be on Duty and Standby on the same day.
    3. An operator MUST NOT work (Duty) for more than 2 consecutive days.
    4. An operator who worked a holiday last year (lastYearHoliday is present) MUST NOT work a Duty shift on THAT SAME holiday this year (match holidayName).
    5. Respect 'unavailable' dates.
    6. TEAM ROTATION: Each day has a 'dutyTeam' (A or B). 
       - DUTY operators (operatorIds) MUST belong to the 'dutyTeam' specified for that day.
       - STANDBY operators (standbyOperatorIds) MUST belong to the OPPOSITE team (i.e. if dutyTeam is A, standby must be B).
    7. WEEKEND BALANCE: Avoid assigning the same operator to Duty on consecutive weekends (Saturday or Sunday). If an operator works one weekend, try not to assign them the next weekend if possible.
    
    ${customInstructions}

    Input Data:
    Operators: ${JSON.stringify(operatorSummary)}
    Days to Schedule: ${JSON.stringify(daySummary)}

    Output:
    Return a JSON array of objects. Each object must have:
    - date (string)
    - operatorIds (array of strings, exactly 2 IDs)
    - standbyOperatorIds (array of strings, exactly 2 IDs)
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              date: { type: Type.STRING },
              operatorIds: {
                type: Type.ARRAY,
                items: { type: Type.STRING }
              },
              standbyOperatorIds: {
                type: Type.ARRAY,
                items: { type: Type.STRING }
              }
            },
            required: ["date", "operatorIds", "standbyOperatorIds"]
          }
        }
      }
    });

    const result = JSON.parse(response.text || "[]");
    
    // Merge result with original day structure to keep metadata
    return daysToSchedule.map(day => {
        const assignment = result.find((r: any) => r.date === day.date);
        return {
            ...day,
            operatorIds: assignment ? assignment.operatorIds : [],
            standbyOperatorIds: assignment ? assignment.standbyOperatorIds : []
        };
    });

  } catch (error) {
    console.error("Gemini Scheduling Error:", error);
    throw new Error("Failed to generate roster. Please try again.");
  }
};

export const aiService = {
  generateRoster
};