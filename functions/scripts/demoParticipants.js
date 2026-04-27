const UNIVERSITY_TITLE =
  "If you are a student, which university do you attend? If you are an older adult, which college did you graduate from (if any)?";

const INTERESTS_TITLE = "What are your interests/hobbies?";
const THREE_WORDS_TITLE = "Describe yourself in three words";
const PINEAPPLE_TITLE = "Pineapple on Pizza?";
const SPICY_TITLE = "Spicy food?";
const TALK_TITLE =
  "I could talk to a stranger for 10 minutes without it being awkward.";
const DETAILS_TITLE = "I notice small mistakes others miss.";
const PRONOUNS_TITLE = "What are your pronouns?";

const rawParticipants = [
  {
    uid: "demo-he-student-01",
    firstName: "Ethan",
    pronouns: "He/Him",
    userType: "student",
    university: "University of Maryland",
    address: {
      line1: "7421 Baltimore Ave",
      line2: "Apt 3B",
      city: "College Park",
      state: "MD",
      postalCode: "20740",
      country: "US",
    },
    phoneNumber: "3015550142",
    pairTheme: "chess, jazz records, neighborhood history walks",
    interests:
      "I like playing chess in coffee shops, listening to old jazz records, and taking long walks through neighborhoods while learning local history. I also enjoy cooking simple pasta dishes and talking about documentaries.",
    threeWords: "Thoughtful, patient, analytical",
    numeric: { numeric1: 2, numeric2: 4, numeric3: 7, numeric4: 9 },
  },
  {
    uid: "demo-he-adult-01",
    firstName: "Samuel",
    pronouns: "He/Him",
    userType: "adult",
    university: "University of Maryland",
    address: {
      line1: "1809 Knox Rd",
      line2: null,
      city: "College Park",
      state: "MD",
      postalCode: "20742",
      country: "US",
    },
    phoneNumber: "2405550188",
    pairTheme: "chess, jazz records, neighborhood history walks",
    interests:
      "I have played chess for years and still enjoy a friendly game. I collect jazz records, especially Miles Davis and Ella Fitzgerald, and I like neighborhood history walks where people share stories about how places have changed.",
    threeWords: "Patient, reflective, observant",
    numeric: { numeric1: 2, numeric2: 4, numeric3: 7, numeric4: 9 },
  },
  {
    uid: "demo-he-student-02",
    firstName: "Noah",
    pronouns: "He/Him",
    userType: "student",
    university: "University of Connecticut",
    address: {
      line1: "55 Mansfield Rd",
      line2: "Unit 12",
      city: "Storrs",
      state: "CT",
      postalCode: "06269",
      country: "US",
    },
    phoneNumber: "8605550117",
    pairTheme: "gardening, birding, watercolor painting",
    interests:
      "I relax by taking care of houseplants, sketching small watercolor scenes, and going on early morning walks to identify birds. I am new to gardening but love learning from people with more experience.",
    threeWords: "Gentle, curious, creative",
    numeric: { numeric1: 4, numeric2: 2, numeric3: 6, numeric4: 8 },
  },
  {
    uid: "demo-he-adult-02",
    firstName: "Martin",
    pronouns: "He/Him",
    userType: "adult",
    university: "University of Connecticut",
    address: {
      line1: "219 Hillside Cir",
      line2: null,
      city: "Mansfield",
      state: "CT",
      postalCode: "06268",
      country: "US",
    },
    phoneNumber: "8605550139",
    pairTheme: "gardening, birding, watercolor painting",
    interests:
      "I spend a lot of time gardening, watching birds from the porch, and painting watercolor landscapes. I enjoy trading practical tips about plants and hearing what younger people are learning in school.",
    threeWords: "Kind, curious, steady",
    numeric: { numeric1: 4, numeric2: 2, numeric3: 6, numeric4: 8 },
  },
  {
    uid: "demo-he-student-03",
    firstName: "Lucas",
    pronouns: "He/Him",
    userType: "student",
    university: "Harvard University",
    address: {
      line1: "12 Garden St",
      line2: "Apt 5",
      city: "Cambridge",
      state: "MA",
      postalCode: "02138",
      country: "US",
    },
    phoneNumber: "6175550164",
    pairTheme: "baseball, baking bread, classic movies",
    interests:
      "I follow baseball closely, like baking bread on weekends, and have been working through classic movies from the 1940s and 1950s. I enjoy conversations that start with sports and end up somewhere unexpected.",
    threeWords: "Friendly, focused, warm",
    numeric: { numeric1: 1, numeric2: 3, numeric3: 8, numeric4: 6 },
  },
  {
    uid: "demo-he-adult-03",
    firstName: "Robert",
    pronouns: "He/Him",
    userType: "adult",
    university: "Harvard University",
    address: {
      line1: "88 Brattle St",
      line2: null,
      city: "Cambridge",
      state: "MA",
      postalCode: "02138",
      country: "US",
    },
    phoneNumber: "6175550191",
    pairTheme: "baseball, baking bread, classic movies",
    interests:
      "I have always loved baseball, especially keeping score during games. I bake sourdough bread most Sundays and enjoy classic movies with strong dialogue. I like swapping stories about favorite teams and old films.",
    threeWords: "Friendly, grounded, reliable",
    numeric: { numeric1: 1, numeric2: 3, numeric3: 8, numeric4: 6 },
  },
  {
    uid: "demo-she-student-01",
    firstName: "Maya",
    pronouns: "She/Her",
    userType: "student",
    university: "University of Maryland",
    address: {
      line1: "4400 Knox Rd",
      line2: "Apt 210",
      city: "College Park",
      state: "MD",
      postalCode: "20740",
      country: "US",
    },
    phoneNumber: "3015550126",
    pairTheme: "reading fantasy books, tea, cozy crafts",
    interests:
      "I love reading fantasy books, drinking tea, crocheting small gifts, and talking about character arcs. I also enjoy quiet walks, cozy bookstores, and learning family recipes from different cultures.",
    threeWords: "Imaginative, warm, thoughtful",
    numeric: { numeric1: 3, numeric2: 2, numeric3: 7, numeric4: 7 },
  },
  {
    uid: "demo-she-adult-01",
    firstName: "Elaine",
    pronouns: "She/Her",
    userType: "adult",
    university: "University of Maryland",
    address: {
      line1: "9321 Adelphi Rd",
      line2: null,
      city: "Hyattsville",
      state: "MD",
      postalCode: "20783",
      country: "US",
    },
    phoneNumber: "3015550175",
    pairTheme: "reading fantasy books, tea, cozy crafts",
    interests:
      "I read fantasy books in the evenings, keep several kinds of tea in the kitchen, and enjoy knitting and other cozy crafts. I love discussing favorite characters and hearing what younger readers recommend.",
    threeWords: "Warm, imaginative, patient",
    numeric: { numeric1: 3, numeric2: 2, numeric3: 7, numeric4: 7 },
  },
  {
    uid: "demo-she-student-02",
    firstName: "Ava",
    pronouns: "She/Her",
    userType: "student",
    university: "University of Connecticut",
    address: {
      line1: "21 Discovery Dr",
      line2: "Room 408",
      city: "Storrs",
      state: "CT",
      postalCode: "06269",
      country: "US",
    },
    phoneNumber: "8605550148",
    pairTheme: "cooking Korean food, puzzles, travel stories",
    interests:
      "I enjoy cooking Korean food with friends, solving crossword puzzles, and collecting travel stories from people who have lived in different places. I like conversations about food, family traditions, and problem solving.",
    threeWords: "Energetic, clever, open",
    numeric: { numeric1: 5, numeric2: 5, numeric3: 9, numeric4: 8 },
  },
  {
    uid: "demo-she-adult-02",
    firstName: "Grace",
    pronouns: "She/Her",
    userType: "adult",
    university: "University of Connecticut",
    address: {
      line1: "64 Maple Rd",
      line2: null,
      city: "Mansfield",
      state: "CT",
      postalCode: "06250",
      country: "US",
    },
    phoneNumber: "8605550182",
    pairTheme: "cooking Korean food, puzzles, travel stories",
    interests:
      "I like cooking Korean food, working on crossword puzzles, and telling travel stories from years of visiting family and friends. I enjoy comparing recipes and learning how people make familiar dishes their own.",
    threeWords: "Open, clever, lively",
    numeric: { numeric1: 5, numeric2: 5, numeric3: 9, numeric4: 8 },
  },
  {
    uid: "demo-she-student-03",
    firstName: "Sofia",
    pronouns: "She/Her",
    userType: "student",
    university: "Harvard University",
    address: {
      line1: "7 Oxford St",
      line2: "Apt 2",
      city: "Cambridge",
      state: "MA",
      postalCode: "02138",
      country: "US",
    },
    phoneNumber: "6175550129",
    pairTheme: "classical piano, museums, poetry",
    interests:
      "I play classical piano, visit museums whenever I can, and write short poems in a notebook. I like thoughtful conversations about music, art, memory, and the small details people notice in daily life.",
    threeWords: "Reflective, artistic, attentive",
    numeric: { numeric1: 2, numeric2: 1, numeric3: 6, numeric4: 10 },
  },
  {
    uid: "demo-she-adult-03",
    firstName: "Margaret",
    pronouns: "She/Her",
    userType: "adult",
    university: "Harvard University",
    address: {
      line1: "1555 Massachusetts Ave",
      line2: null,
      city: "Cambridge",
      state: "MA",
      postalCode: "02138",
      country: "US",
    },
    phoneNumber: "6175550187",
    pairTheme: "classical piano, museums, poetry",
    interests:
      "I studied classical piano when I was young, still enjoy museum afternoons, and read poetry before bed. I like conversations where people slow down and notice art, music, and everyday details.",
    threeWords: "Attentive, reflective, gracious",
    numeric: { numeric1: 2, numeric2: 1, numeric3: 6, numeric4: 10 },
  },
];

function toDisplayName(person) {
  return `${person.firstName} Demo`;
}

function toParticipantDoc(person) {
  return {
    address: person.address,
    displayName: toDisplayName(person),
    email: `${person.firstName.toLowerCase()}.demo@forallages.test`,
    phoneNumber: person.phoneNumber,
    role: "Participant",
    type: "Participant",
    userUid: person.uid,
    user_type: person.userType,
  };
}

function toFormResponseDoc(person) {
  return {
    uid: person.uid,
    questions: [
      { answer: person.pronouns, title: PRONOUNS_TITLE, type: "Radio" },
      { answer: person.university, title: UNIVERSITY_TITLE, type: "DropdownWithOther" },
      { answer: person.interests, title: INTERESTS_TITLE, type: "long_input" },
      { answer: person.threeWords, title: THREE_WORDS_TITLE, type: "short_input" },
      { answer: person.numeric.numeric1, title: PINEAPPLE_TITLE, type: "Slider" },
      { answer: person.numeric.numeric2, title: SPICY_TITLE, type: "Slider" },
      { answer: person.numeric.numeric3, title: TALK_TITLE, type: "Slider" },
      { answer: person.numeric.numeric4, title: DETAILS_TITLE, type: "Slider" },
    ],
  };
}

function toPineconePayload(person) {
  return {
    uid: person.uid,
    textResponses: [person.interests, person.threeWords],
    numericResponses: person.numeric,
    user_type: person.userType,
    pronouns: person.pronouns,
  };
}

const demoParticipants = rawParticipants.map((person) => ({
  ...person,
  displayName: toDisplayName(person),
  participantDoc: toParticipantDoc(person),
  formResponseDoc: toFormResponseDoc(person),
  pineconePayload: toPineconePayload(person),
}));

module.exports = {
  demoParticipants,
};
