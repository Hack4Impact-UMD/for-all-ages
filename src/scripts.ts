import { collection, addDoc, writeBatch, doc } from 'firebase/firestore';
import { db } from './firebase';

const interest_list = [
    "Poetry slams on Fridays. Coffee shop regular. I write short stories and love indie music. Deep conversations over small talk.",
    "Rock climbing twice a week. Podcast addict. I'm learning to play ukulele and love trying new vegetarian restaurants.",
    "Theater kid at heart. I act in campus productions and binge musicals. Karaoke nights are my jam. Very expressive and outgoing.",
    "I'm into photography and urban exploring. Street art fascinates me. I skateboard and enjoy thrift shopping on weekends.",
    "Gym routine keeps me balanced. Meal prep Sundays. I play intramural soccer and enjoy self-help audiobooks.",
    "Video games and anime are my escape. I'm learning Japanese and code in my free time. Quiet nights in > going out.",
    "I dance salsa and bachata. Music festivals in summer. I love teaching others to dance and trying new coffee blends.",
    "Marathon runner training for Boston. Smoothie bowls and yoga. I listen to true crime podcasts while running.",
    "Astronomy club president. Stargazing trips monthly. Physics nerd who loves sci-fi novels and explaining space to anyone who'll listen.",
    "Cooking traditional family recipes from scratch. Food blogger on Instagram. I host dinner parties and love farmer's markets.",
    "Sustainable fashion advocate. I thrift, upcycle, and sew. Environmental activism is important to me. Plant-based meals only.",
    "Casual gamer and meme enthusiast. I'm learning guitar (badly) and enjoy late-night diner runs with friends.",
    "Debate team captain. Mock trial on weekends. I love arguing (constructively!) and discussing current events over coffee.",
    "Bookworm with a constantly growing TBR pile. Fantasy novels are my favorite. Cozy reading nooks and tea are essential.",
    "Stand-up comedy open mics when I'm brave enough. I watch comedy specials and love making people laugh. Extroverted energy.",
    "Mountain biking and camping trips. Outdoor adventure club member. I'm happiest with dirt under my nails.",
    "Jazz piano player for 10 years. I perform at local venues and enjoy vinyl record collecting. Old soul vibes.",
    "Language learning enthusiast. Fluent in three languages, working on my fourth. I watch foreign films without subtitles.",
    "DIY and woodworking projects in my spare time. I build furniture and enjoy hands-on problem solving.",
    "Social justice activist. Organizing rallies and community service. I'm passionate about equity and volunteer weekly.",
    "Chess club regular. Strategy games fascinate me. I enjoy puzzles, escape rooms, and anything that challenges my brain.",
    "Yoga instructor in training. Meditation daily. Wellness and mental health awareness are my passions. Calm and centered energy.",
    "Classic car restoration with my dad on weekends. I love mechanics, vintage things, and getting grease on my hands.",
    "Travel blog writer. I've visited 15 countries and counting. Photography, journaling, and planning my next adventure constantly.",
    "Improv comedy troupe member. Quick wit and spontaneity. I love collaborative storytelling and making up silly characters.",
    "I write poetry and attend monthly writing circles. Tea and quiet reflection bring me peace. I enjoy sharing life's wisdom.",
    "Retired engineer who still tinkers with gadgets. I mentor students in robotics and enjoy classical music concerts.",
    "Theater volunteer for 20 years. I've seen every Broadway touring show. Love discussing performances over dinner.",
    "Photography has been my passion since the 60s. I teach darkroom techniques and love capturing candid moments.",
    "Fitness classes three times a week keep me young. I'm learning to use my smartphone better and enjoy trying new healthy recipes.",
    "Avid reader of mysteries and thrillers. Book club regular. I prefer quiet evenings but love lively literary discussions.",
    "Retired dance instructor. I still take salsa classes and love live music venues. Music is life.",
    "Former marathon runner, now I do half marathons and 5ks. I give running advice and enjoy early morning starts.",
    "Amateur astronomer with a telescope on my porch. I host stargazing nights and love explaining constellations.",
    "Cooking is my love language. I've collected recipes from 40 years of travel. Teaching others brings me joy.",
    "Environmental activist since the 70s. I garden organically and advocate for sustainability. Still fighting the good fight.",
    "I play video games with my grandkids online. Learning new technology keeps my mind sharp. Surprisingly good at Mario Kart.",
    "Retired lawyer who follows political news closely. I enjoy respectful debates and understanding different perspectives.",
    "Librarian for 35 years. I recommend books like breathing. My home library has over 2000 volumes.",
    "Former improv actor. I still take comedy workshops and love making people smile. Life's too short not to laugh.",
    "Hiking club leader. I've explored every trail in Connecticut. Nature restores my soul.",
    "Jazz pianist who plays at senior center weekly. I've seen legends perform live. Music history is my specialty.",
    "Fluent in five languages from my years living abroad. I tutor ESL students and love cultural exchange.",
    "Carpenter by trade, woodworker by passion. My garage is my happy place. I teach woodworking basics.",
    "Civil rights activist since the 60s. I share stories from the movement and volunteer with community organizations.",
    "Chess master with tournament wins. I teach at the library on Tuesdays. Strategy and patience go hand in hand.",
    "Former yoga instructor, now I practice daily. Mindfulness and meditation ground me. I lead gentle senior yoga classes.",
    "Car enthusiast with a vintage collection. I attend car shows and love talking about restoration projects.",
    "Travel writer with stories from 50 countries. I lecture at the library about my adventures. Wanderlust never fades.",
    "Improvisational storyteller. I perform at community theaters and love teaching creative writing to beginners."
];


type RegistrationFormState = {
  addressLine1: string;
  addressLine2: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  phone: string;
  confirmPhone: string;
  email: string;
  confirmEmail: string;
  dateOfBirth: string;
  pronouns: string;
  heardAbout: string;
  university: string;
  interests: string;
  teaPreference: string;
  role: string;
  displayName: string;
};

// Utility functions for generating random data
const getRandomElement = <T>(array: T[]): T => {
  return array[Math.floor(Math.random() * array.length)];
};

const generateRandomPhone = (): string => {
  return `+1${Math.floor(1000000000 + Math.random() * 9000000000)}`;
};

const generateRandomEmail = (): string => {
  const domains = ['gmail.com', 'yahoo.com', 'outlook.com', 'hotmail.com', 'icloud.com'];
  const names = ['john', 'jane', 'alex', 'sam', 'morgan', 'casey', 'riley', 'quincy'];
  const randomNum = Math.floor(Math.random() * 1000);
  return `${getRandomElement(names)}${randomNum}@${getRandomElement(domains)}`;
};

const generateRandomDateOfBirth = (): string => {
  const start = new Date(1970, 0, 1);
  const end = new Date(2005, 11, 31);
  const date = new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
  return date.toISOString().split('T')[0];
};

// Sample data for randomization
const cities = ['New York', 'Los Angeles', 'Chicago', 'Houston', 'Phoenix', 'Philadelphia', 'San Antonio', 'San Diego', 'Dallas', 'San Jose'];
const states = ['CA', 'TX', 'FL', 'NY', 'IL', 'PA', 'OH', 'GA', 'NC', 'MI'];
const countries = ['United States', 'Canada', 'United Kingdom'];
const pronouns = ['he/him', 'she/her', 'they/them', 'he/they', 'she/they'];
const heardAbout = ['Friend', 'Social Media', 'University', 'Website', 'Advertisement', 'Email'];
const universities = ['State University', 'Tech College', 'Liberal Arts College', 'Community College', 'Online University'];
const teaPreferences = ['Green Tea', 'Black Tea', 'Herbal Tea', 'Chai', 'Oolong', 'No Preference', 'Coffee Instead'];

const generateRandomProfile = (interest: string, name:string): RegistrationFormState => {
  const phone = generateRandomPhone();
  const email = generateRandomEmail();
  
  return {
    addressLine1: `${Math.floor(Math.random() * 9999) + 1} Main St`,
    addressLine2: Math.random() > 0.7 ? `Apt ${Math.floor(Math.random() * 999) + 1}` : '',
    city: getRandomElement(cities),
    state: getRandomElement(states),
    postalCode: Math.floor(10000 + Math.random() * 90000).toString(),
    country: getRandomElement(countries),
    phone: phone,
    confirmPhone: phone,
    email: email,
    confirmEmail: email,
    dateOfBirth: generateRandomDateOfBirth(),
    pronouns: getRandomElement(pronouns),
    heardAbout: getRandomElement(heardAbout),
    university: getRandomElement(universities),
    interests: interest,
    teaPreference: getRandomElement(teaPreferences),
    role: 'Participant',
    displayName: name
  };
};

const names_list = [
  "Emma Johnson",
  "Liam Chen",
  "Olivia Martinez",
  "Noah Rodriguez",
  "Ava Thompson",
  "Ethan Davis",
  "Sophia Wilson",
  "Mason Brown",
  "Isabella Garcia",
  "James Williams",
  "Mia Anderson",
  "Benjamin Lee",
  "Charlotte Taylor",
  "Lucas Moore",
  "Amelia Jackson",
  "Alexander White",
  "Harper Harris",
  "William Martin",
  "Evelyn Clark",
  "Michael Lewis",
  "Abigail Walker",
  "Daniel Hall",
  "Emily Allen",
  "Matthew Young",
  "Elizabeth King",
  "David Wright",
  "Sofia Scott",
  "Joseph Green",
  "Avery Adams",
  "Samuel Nelson",
  "Ella Baker",
  "Henry Carter",
  "Scarlett Mitchell",
  "Jackson Perez",
  "Grace Roberts",
  "Sebastian Turner",
  "Chloe Phillips",
  "Jack Campbell",
  "Victoria Parker",
  "Owen Evans",
  "Riley Edwards",
  "Gabriel Collins",
  "Aurora Stewart",
  "Julian Sanchez",
  "Zoey Morris",
  "Luke Rogers",
  "Lily Reed",
  "Jayden Cook",
  "Hannah Morgan",
  "Leo Bell"
];

export const insertProfiles = async () => {
  try {
    const participantsCollection = collection(db, 'participants');
    const BATCH_SIZE = 20;
    
    for (let i = 0; i < interest_list.length; i += BATCH_SIZE) {
      // Create a new batch for each group
      const batch = writeBatch(db);
      
      // Process a batch of documents
      const endIndex = Math.min(i + BATCH_SIZE, interest_list.length);
      
      for (let j = i; j < endIndex; j++) {
        const interest = interest_list[j];
        const name = names_list[j]
        const profile = generateRandomProfile(interest, name);
        const docRef = doc(participantsCollection);
        
        batch.set(docRef, {
          ...profile,
          createdAt: new Date(),
          updatedAt: new Date()
        });
      }
      
      // Commit this batch
      await batch.commit();
      console.log(`Committed batch from index ${i} to ${endIndex - 1}`);
      
      // Small delay to avoid overwhelming Firebase
      await new Promise(resolve => setTimeout(resolve, 200));
    }
    
    console.log('Successfully inserted all profiles!');
    
  } catch (error) {
    console.error('Error inserting profiles:', error);
    if (error instanceof Error) {
      console.error('Error message:', error.message);
      console.error('Error stack:', error.stack);
    }
  }
};


