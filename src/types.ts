export type Role = "Admin" | "Subadmin";

export interface User {
    email: string;
    name: string;
    role: Role;
}

export interface Participant {
    name: string
    address: string
    phone_number: string
    email: string
    dob: Date       //switch to luxon datetime
    pronouns: string
}

export interface SurveyResponse {
    question: string
    answer: string
}

export interface Survey {
    participant_id: string
    responses: SurveyResponse[]
}

export interface Match {
    participant1_id: string
    participant2_id: string
    day_of_call: Date     //switch to luxon
    similarity: number
}

export interface LogFormData {
    callComplete?: boolean;
    duration?: number;
    satisfactionScore?: number;
    meetingNotes: string;
    mode: "edit" | "saved";
}

export interface Week {
    week: number
    calls: {match_id: {duration: number, concerns: string}}[]
}

// Log document stored in Firestore logs collection
// Structure: logs/{logId}
export interface Log {
    matchId: string;           
    participantId: string;     
    participantName: string;   
    weekNumber: number;        
    callComplete: boolean;
    duration: number;          
    satisfactionScore: number;
    meetingNotes: string;
    submittedAt?: Date;
}

// Individual user log for the admin modal
export interface UserLog {
    name: string;
    hasSubmitted: boolean;
    callComplete?: boolean;
    duration?: number;          
    satisfactionScore?: number;
    meetingNotes?: string;
}

// Combined log data for displaying both users' logs in the admin modal
export interface MatchLogPair {
    matchId: string;
    weekNumber: number;
    logs: UserLog[];
}





