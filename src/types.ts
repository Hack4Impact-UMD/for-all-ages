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

export interface Week {
    week: number
    calls: {match_id: {duration: number, concerns: string}}[]
}





