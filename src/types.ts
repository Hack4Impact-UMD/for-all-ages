export type Role = "Admin" | "Subadmin";

export type UserType = "student" | "adult";

export interface User {
    email: string;
    name: string;
    role: Role;
}

/** Address shape for participant documents (Firestore) */
export interface RawAddress {
    line1?: string | null
    line2?: string | null
    city?: string | null
    state?: string | null
    postalCode?: string | null
    country?: string | null
}

/** Preference scores (q1–q3) used in participant docs and rematching */
export interface PreferenceScores {
    q1?: number
    q2?: number
    q3?: number
}

/** Participant document shape (Firestore-friendly; all fields optional) */
export interface Participant {
    id?: string
    type?: "Participant"
    userUid?: string
    displayName?: string | null
    firstName?: string | null
    lastName?: string | null
    email?: string | null
    phoneNumber?: string | null
    address?: RawAddress | null
    user_type?: UserType | string
    dateOfBirth?: string | null
    pronouns?: string | null
    heardAbout?: string | null
    university?: string | null
    interests?: string | null
    teaPreference?: string | null
    preferredContactMethods?: string[] | null
    preferenceScores?: PreferenceScores | null
    status?: string | null
    role?: Role | null
}

export type ParticipantDoc = Partial<Participant>;

export type ParticipantProfile = Pick<
    Participant,
    "displayName" | "firstName" | "lastName"
>;

/** Participant view for rematching page (participants-test2 collection) */
export interface RematchingParticipant {
    id: string
    userUid: string
    type: UserType
    name: string
    interestsText: string
    school?: string
    preferenceScores?: PreferenceScores
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

/** Log document with Firestore document id */
export type LogWithId = Logs & { id: string }

/** Admin list row (participant doc with required id and name) */
export interface AdminRecord {
    id: string
    name: string
    role: Role | "Participant"
    email: string
    phoneNumber?: string | null
    address?: string | null
    user_type?: string | null
    status?: string | null
    university?: string | null
}

/** Banner message for success/error feedback */
export interface BannerState {
    type: "success" | "error"
    message: string
}

/** Program config document (Firestore config/programState) */
export interface ProgramState {
    started: boolean
    matches_final: boolean
    week: number
}

/** PreProgram match row status */
export type MatchStatus = "Pending" | "Approved" | "No Match"

/** Day labels for schedule (AdminDashboard) */
export type DayKey = "Sun" | "Mon" | "Tue" | "Wed" | "Thurs" | "Fri" | "Sat"

/** Tag variant for person/assignment display */
export type PersonTagVariant = "rose" | "green" | "gold"

/** Assignment of names to a day slot (AdminDashboard) */
export interface PersonAssignment {
    names: string[]
    variant?: PersonTagVariant
}

/** Params for inviting a new admin account */
export interface InviteAdminParams {
    firstName: string
    lastName: string
    email: string
    role: Role
    university?: string | null
}

/** Event edit form values (roadmap events) */
export interface EditEventValues {
    title: string
    timeText?: string
    locationText?: string
    colorHex?: string
}

/** Preference question ids (q1–q3) */
export type PreferenceQuestionId = "q1" | "q2" | "q3"

/** Matching API result (PreProgram / matching service) */
export interface BackendMatch {
    studentId: string
    seniorId: string
    scores: {
        frqScore: number
        quantScore: number
        finalScore: number
    }
    confidence: string
    rank: number
}

/** PreProgram UI table row */
export interface UI_Match {
    name1: string
    name2: string
    participant1_id: string | null
    participant2_id: string | null
    confidence?: number
    status: MatchStatus
    score: number
    matchId?: string
}

/** Registration form state */
export interface RegistrationFormState {
    addressLine1: string
    addressLine2: string
    city: string
    state: string
    postalCode: string
    country: string
    phone: string
    confirmPhone: string
    email: string
    dateOfBirth: string
    pronouns: string
    heardAbout: string
    university: string
    user_type: string
    interests: string
    teaPreference: string
    preferredContactMethods: string[]
    preferenceScores: { q1: number; q2: number; q3: number }
}

/** Profile page display / form state */
export interface UserProfile {
    name: string
    email: string
    password: string
    pronouns: string
    phone: string
    birthday: string
    address: string
    interests: string
    startDate: string
    endDate: string
    status: string
}

/** Validation error fields (Profile and similar forms) */
export interface ErrorState {
    email?: string
    phone?: string
    birthday?: string
    address?: string
}

/** Partner card display (MatchedDashboard) */
export interface PartnerInfo {
    id: string
    name: string
    displayName: string
    email: string
    phone_number: string
    user_type: string
}


