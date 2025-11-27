export type Role = "Admin" | "Subadmin" | "Participant";

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
    day_of_call: number // 1-7 (Monday-Sunday)
    similarity: number
}

export interface Week {
    week: number  // 1-20, acts as primary key
    calls: string[]  // Array of match_ids (document IDs)
}

export interface Logs {
    week: number
    uid: string
    duration: number
    rating: number
    concerns: string
}





