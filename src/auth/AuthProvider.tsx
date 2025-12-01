// src/auth/AuthProvider.tsx
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { onAuthStateChanged, getIdTokenResult } from "firebase/auth";
import type { User } from "firebase/auth";
import { auth, db } from "../firebase";
import { doc, onSnapshot, type Unsubscribe } from "firebase/firestore";
import { subscribeToProgramState, type ProgramState } from "../services/programState";

// Define the shape of the authentication context
type AuthCtx = {
  user: User | null;
  loading: boolean;
  emailVerified: boolean;
  claims?: Record<string, any>;
  participant: Record<string, unknown> | null;
  participantLoading: boolean;
  programState: ProgramState | null;
  programStateLoading: boolean;
  setProgramState?: (ps: ProgramState | null) => void;
  refreshUser: () => Promise<void>;
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
  setProgramState: undefined,
  refreshUser: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [claims, setClaims] = useState<Record<string, any> | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [participant, setParticipant] = useState<Record<string, unknown> | null>(null);
  const [participantLoading, setParticipantLoading] = useState(true);
  const [programState, setProgramState] = useState<ProgramState | null>(null);
  const [programStateLoading, setProgramStateLoading] = useState(true);

  useEffect(() => {
    setProgramStateLoading(true);
    // Subscribes to Firebase Auth
    const unsub = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (u) {
        const token = await getIdTokenResult(u, true);
        setClaims(token.claims as any);
      } else {
        setClaims(undefined);
      }
      setLoading(false);
    });
    return unsub;
  }, []);

  useEffect(() => {
    let unsubscribe: Unsubscribe | undefined;
    // no user or the user’s email isn’t verified, don’t load a profile
    if (!user || !user.emailVerified) {
      setParticipant(null);
      setParticipantLoading(false);
      return () => {
        if (unsubscribe) unsubscribe();
      };
    }

    setParticipantLoading(true);
    const docRef = doc(db, "participants", user.uid);
    unsubscribe = onSnapshot(
      docRef,
      (snapshot) => {
        if (snapshot.exists()) {
          setParticipant({ id: snapshot.id, ...snapshot.data() });
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

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [user]);

  useEffect(() => {
    // subscribe to realtime program state
    setProgramStateLoading(true);
    const unsub = subscribeToProgramState(
      (state) => {
        setProgramState(state);
        setProgramStateLoading(false);
      },
      (err) => {
        console.error("ProgramState subscription error in AuthProvider", err);
        setProgramState(null);
        setProgramStateLoading(false);
      }
    );

    return () => {
      if (typeof unsub === "function") unsub();
    };
  }, []);

  // Forces a fresh fetch of the current user
  const refreshUser = useCallback(async () => {
    if (!auth.currentUser) return;
    await auth.currentUser.reload();
    setUser(auth.currentUser);
  }, []);

  // Memoize the context value & prevent unnecessary re-renders
  const contextValue = useMemo<AuthCtx>(
    () => ({
      user,
      loading,
      emailVerified: !!user?.emailVerified,
      claims,
      participant,
      participantLoading,
      programState,
      programStateLoading,
      setProgramState,
      refreshUser,
    }),
    [claims, loading, participant, participantLoading, programState, programStateLoading, refreshUser, user],
  );

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
