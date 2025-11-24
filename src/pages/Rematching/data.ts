import type { RematchingParticipant, ApprovedMatch } from "./Rematching";

/**
 * Initial dummy data for students pending matches.
 */
export const INITIAL_STUDENTS: RematchingParticipant[] = [
  {
    id: "s1",
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
    id: "s2",
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
    id: "s3",
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
    id: "s4",
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
    id: "s5",
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
    id: "s6",
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
 * Initial dummy data for adults pending matches.
 */
export const INITIAL_ADULTS: RematchingParticipant[] = [
  {
    id: "a1",
    name: "Grace Lee",
    type: "adult",
    interests: ["Reading", "Music", "Art", "Photography", "Writing"],
    address: "",
    phone_number: "",
    email: "",
    dob: new Date(),
    pronouns: "",
  },
  {
    id: "a2",
    name: "Henry Davis",
    type: "adult",
    interests: ["Sports", "Cooking", "Music", "Travel"],
    address: "",
    phone_number: "",
    email: "",
    dob: new Date(),
    pronouns: "",
  },
  {
    id: "a3",
    name: "Ivy Chen",
    type: "adult",
    interests: ["Art", "Photography", "Reading"],
    address: "",
    phone_number: "",
    email: "",
    dob: new Date(),
    pronouns: "",
  },
  {
    id: "a4",
    name: "Jack Taylor",
    type: "adult",
    interests: ["Music", "Writing", "History"],
    address: "",
    phone_number: "",
    email: "",
    dob: new Date(),
    pronouns: "",
  },
  {
    id: "a5",
    name: "Karen White",
    type: "adult",
    interests: ["Cooking", "Travel", "Photography"],
    address: "",
    phone_number: "",
    email: "",
    dob: new Date(),
    pronouns: "",
  },
  {
    id: "a6",
    name: "Leo Martinez",
    type: "adult",
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
  { studentId: "s7", adultId: "a7" },
  { studentId: "s8", adultId: "a8" },
];

