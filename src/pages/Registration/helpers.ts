import { doc, getDoc } from "firebase/firestore";
import { db } from "../../firebase";
import type { Section } from "../../types";

export async function getUniversityOptions(): Promise<string[]> {
  try {
    const docRef = doc(db, "config", "registrationForm");
    const snap = await getDoc(docRef);

    if (!snap.exists()) return [];

    const data = snap.data();
    const sections: Section[] = data.sections || [];

    for (const section of sections) {
      for (const question of section.questions) {
        if (question.lockedKey === "school") {
          return question.options || [];
        }
      }
    }

    return [];
  } catch (err) {
    console.error("Failed to fetch university options:", err);
    return [];
  }
}