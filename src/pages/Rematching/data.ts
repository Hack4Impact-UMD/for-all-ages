import type { RematchingParticipant, ApprovedMatch } from "./Rematching";

/**
 * Initial dummy data for students pending matches.
 */
export const INITIAL_STUDENTS: RematchingParticipant[] = [
  {
    id: "S1",
    name: "Alice Johnson",
    type: "student",
    interests: ["Reading", "Music", "Art", "Photography"],
    school: "Stanford University",
    address: "",
    phone_number: "",
    email: "",
    dob: new Date(),
    pronouns: "",
  },
  {
    id: "S2",
    name: "Bob Smith",
    type: "student",
    interests: ["Sports", "Cooking", "Music"],
    school: "UC Berkeley",
    address: "",
    phone_number: "",
    email: "",
    dob: new Date(),
    pronouns: "",
  },
  {
    id: "S3",
    name: "Charlie Brown",
    type: "student",
    interests: ["Art", "Reading", "Writing", "History"],
    school: "Harvard University",
    address: "",
    phone_number: "",
    email: "",
    dob: new Date(),
    pronouns: "",
  },
  {
    id: "S4",
    name: "Diana Prince",
    type: "student",
    interests: ["Music", "Dancing", "Photography"],
    school: "Yale University",
    address: "",
    phone_number: "",
    email: "",
    dob: new Date(),
    pronouns: "",
  },
  {
    id: "S5",
    name: "Eve Wilson",
    type: "student",
    interests: ["Cooking", "Sports", "Travel"],
    school: "MIT",
    address: "",
    phone_number: "",
    email: "",
    dob: new Date(),
    pronouns: "",
  },
  {
    id: "S6",
    name: "Frank Miller",
    type: "student",
    interests: ["Reading", "Writing", "History"],
    school: "Princeton University",
    address: "",
    phone_number: "",
    email: "",
    dob: new Date(),
    pronouns: "",
  },
];

/**
 * Initial dummy data for seniors pending matches.
 */
export const INITIAL_SENIORS: RematchingParticipant[] = [
  {
    id: "T1",
    name: "Grace Lee",
    type: "senior",
    interests: ["Reading", "Music", "Art", "Photography", "Writing"],
    address: "",
    phone_number: "",
    email: "",
    dob: new Date(),
    pronouns: "",
  },
  {
    id: "T2",
    name: "Henry Davis",
    type: "senior",
    interests: ["Sports", "Cooking", "Music", "Travel"],
    address: "",
    phone_number: "",
    email: "",
    dob: new Date(),
    pronouns: "",
  },
  {
    id: "T3",
    name: "Ivy Chen",
    type: "senior",
    interests: ["Art", "Photography", "Reading"],
    address: "",
    phone_number: "",
    email: "",
    dob: new Date(),
    pronouns: "",
  },
  {
    id: "T4",
    name: "Jack Taylor",
    type: "senior",
    interests: ["Music", "Writing", "History"],
    address: "",
    phone_number: "",
    email: "",
    dob: new Date(),
    pronouns: "",
  },
  {
    id: "T5",
    name: "Karen White",
    type: "senior",
    interests: ["Cooking", "Travel", "Photography"],
    address: "",
    phone_number: "",
    email: "",
    dob: new Date(),
    pronouns: "",
  },
  {
    id: "T6",
    name: "Leo Martinez",
    type: "senior",
    interests: ["Sports", "Reading", "Music"],
    address: "",
    phone_number: "",
    email: "",
    dob: new Date(),
    pronouns: "",
  },
];

/**
 * Initial approved matches count.
 */
export const INITIAL_APPROVED_MATCHES: ApprovedMatch[] = [
  { studentId: "s7", seniorId: "T7" },
  { studentId: "s8", seniorId: "T8" },
];

