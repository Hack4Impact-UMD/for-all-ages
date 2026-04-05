// src/auth/AuthProvider.tsx
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { ReactNode } from "react";
import { onAuthStateChanged, getIdTokenResult } from "firebase/auth";
import type { User } from "firebase/auth";
import { doc, onSnapshot, type Unsubscribe } from "firebase/firestore";

import { auth, db } from "../firebase";
import type { ParticipantDoc, ProgramState } from "../types";

type AuthClaims = Record<string, unknown>;

function isAdminRole(role?: string | null) {
  if (!role) return false;
  const normalized = role.toLowerCase();
  return (
    normalized === "admin" ||
    normalized === "subadmin" ||
    normalized === "sub-admin"
  );
}

type AuthCtx = {
  user: User | null;
  loading: boolean;
  emailVerified: boolean;
  claims: AuthClaims | undefined;
  participant: ParticipantDoc | null;
  participantLoading: boolean;
  programState: ProgramState | null;
  programStateLoading: boolean;
  isWaitlisted: boolean;
  waitlistLoading: boolean;
  refreshUser: () => Promise<void>;
  isAdmin: boolean;
};

const AuthContext = createContext<AuthCtx>({
  user: null,
  loading: true,
  emailVerified: false,
  claims: undefined,

  participant: null,
  participantLoading: true,

  programState: null,
  programStateLoading: true,

  isWaitlisted: false,
  waitlistLoading: true,

  refreshUser: async () => {},
  isAdmin: false,
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [claims, setClaims] = useState<AuthClaims | undefined>(undefined);
  const [loading, setLoading] = useState(true);

  const [participant, setParticipant] = useState<ParticipantDoc | null>(null);
  const [participantLoading, setParticipantLoading] = useState(true);

  const [programState, setProgramState] = useState<ProgramState | null>(null);
  const [programStateLoading, setProgramStateLoading] = useState(true);

  const [isWaitlisted, setIsWaitlisted] = useState(false);
  const [waitlistLoading, setWaitlistLoading] = useState(true);

  // Firebase Auth subscription
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      setUser(u);

      if (u) {
        const token = await getIdTokenResult(u, true);
        setClaims(token.claims as AuthClaims);
      } else {
        setClaims(undefined);
      }

      setLoading(false);
    });

    return unsub;
  }, []);

  // Participant profile subscription
  useEffect(() => {
    let unsubscribe: Unsubscribe | undefined;

    if (!user || !user.emailVerified) {
      setParticipant(null);
      setParticipantLoading(false);
      return () => unsubscribe?.();
    }

    setParticipantLoading(true);

    const docRef = doc(db, "participants", user.uid);
    unsubscribe = onSnapshot(
      docRef,
      (snapshot) => {
        if (snapshot.exists()) {
          setParticipant({
            id: snapshot.id,
            ...(snapshot.data() as ParticipantDoc),
          });
        } else {
          setParticipant(null);
        }
        setParticipantLoading(false);
      },
      (error) => {
        console.error("Failed to load participant profile", error);
        setParticipant(null);
        setParticipantLoading(false);
      },
    );

    return () => unsubscribe?.();
  }, [user]);

  // Program state subscription
  useEffect(() => {
    let unsubscribe: Unsubscribe | undefined;

    if (!user || !user.emailVerified) {
      setProgramState(null);
      setProgramStateLoading(false);
      return () => unsubscribe?.();
    }

    setProgramStateLoading(true);

    const docRef = doc(db, "config", "programState");
    unsubscribe = onSnapshot(
      docRef,
      (snapshot) => {
        setProgramState(
          snapshot.exists() ? (snapshot.data() as ProgramState) : null,
        );
        setProgramStateLoading(false);
      },
      (error) => {
        console.error("Failed to load program state", error);
        setProgramState(null);
        setProgramStateLoading(false);
      },
    );

    return () => unsubscribe?.();
  }, [user]);

  // Waitlist subscription
  useEffect(() => {
    let unsubscribe: Unsubscribe | undefined;

    if (!user || !user.emailVerified) {
      setIsWaitlisted(false);
      setWaitlistLoading(false);
      return () => unsubscribe?.();
    }

    setWaitlistLoading(true);

    const docRef = doc(db, "waitlist", user.uid);
    unsubscribe = onSnapshot(
      docRef,
      (snapshot) => {
        setIsWaitlisted(snapshot.exists());
        setWaitlistLoading(false);
      },
      (error) => {
        console.error("Failed to load waitlist status", error);
        setIsWaitlisted(false);
        setWaitlistLoading(false);
      },
    );

    return () => unsubscribe?.();
  }, [user]);

  const refreshUser = useCallback(async () => {
    if (!auth.currentUser) return;
    await auth.currentUser.reload();
    setUser(auth.currentUser);
  }, []);

  const contextValue = useMemo<AuthCtx>(() => {
    const role = participant?.role ?? null;

    return {
      user,
      loading,
      emailVerified: !!user?.emailVerified,
      claims,

      participant,
      participantLoading,

      programState,
      programStateLoading,

      isWaitlisted,
      waitlistLoading,

      refreshUser,
      isAdmin: isAdminRole(role),
    };
  }, [
    user,
    loading,
    claims,
    participant,
    participantLoading,
    programState,
    programStateLoading,
    isWaitlisted,
    waitlistLoading,
    refreshUser,
  ]);

  return (
    <AuthContext.Provider value={contextValue}>{children}</AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
