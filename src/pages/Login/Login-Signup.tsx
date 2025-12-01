import { useEffect, useMemo, useState } from "react";
// Firebase SDK usage moved behind service helpers
import { useNavigate } from "react-router-dom";
import styles from "./Login.module.css";
import { auth, db } from "../../firebase";
import { useAuth } from "../../auth/AuthProvider";
import {
  friendlyAuthError,
  loginWithEmailPassword,
  signupWithEmailPassword,
  resendVerificationEmail,
} from "../../services/auth";
import { doc, getDoc } from "firebase/firestore";

type Tab = "login" | "signup";

const initialLoginState = { email: "", password: "" };
const initialSignupState = {
  firstName: "",
  lastName: "",
  email: "",
  password: "",
  confirmPassword: "",
};

// Error mapping moved to shared util
// The main LoginSignup componentx
function LoginSignup() {
  
  // Router navigation
  const navigate = useNavigate();
  
  // Auth context
  const {
    user,
    loading: authLoading,
    emailVerified,
    participant,
    participantLoading,
    refreshUser,
    setProgramState,
  } = useAuth();


  const [tab, setTab] = useState<Tab>("login");
  const [loginForm, setLoginForm] = useState(initialLoginState);
  const [signupForm, setSignupForm] = useState(initialSignupState);
  const [error, setError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [loginLoading, setLoginLoading] = useState(false);
  const [signupLoading, setSignupLoading] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);

  //verification panel if a user is signed in but not yet verified
  const needsVerification = useMemo(
    () => Boolean(user && !emailVerified),
    [user, emailVerified],
  );

  /**
   * Redirects authenticated & verified users away from this page
   * If there’s a verified user but no participant doc → go to /registration
   * If participant exists → go to the dashboard
   */
  useEffect(() => {
    if (authLoading || participantLoading) return;
    if (!user) return;
    if (!emailVerified) return;
    if (!participant) {
      navigate("/registration", { replace: true });
    } else {
      navigate("/user/dashboard", { replace: true });
    }
  }, [authLoading, participantLoading, user, emailVerified, participant, navigate]);

  useEffect(() => {
    setError(null);
  }, [tab]);

  const handleLoginChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setLoginForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSignupChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setSignupForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (tab === "login") {
      await handleLogin();
    } else {
      await handleSignup();
    }
  };

  // Handles user login
  const handleLogin = async () => {
    setError(null);
    setStatusMessage(null);
    setLoginLoading(true);
    try {
      await loginWithEmailPassword(loginForm.email, loginForm.password);
      // Reload user to get fresh emailVerified status
      await refreshUser();
      try {
        const psnap = await getDoc(doc(db, "config", "programState"));

        const ps = psnap.exists() ? (psnap.data() as any) : null;
        // If auth context exposes setter, update it immediately so guards see latest state
        try {
          setProgramState?.(ps ?? null);
        } catch (e) {
          // ignore
        }
        const started = !!ps?.started;
        const matchesFinal = !!ps?.matches_final;

        // If matches are finalized (regardless of whether this user has a match), go to matched
        if (matchesFinal && !started) {
          navigate("/user/matched", { replace: true });
          console.log("Redirecting to /user/matched after login");
          return;
        }

        // Otherwise, if matches not final -> waiting
        if (!matchesFinal && !started) {
          navigate("/waiting", { replace: true });
          console.log("Redirecting to /waiting after login");
          return;
        }

        // Default to dashboard
        navigate("/user/dashboard", { replace: true });
        return;
      } catch (fetchErr) {
        // ignore and allow existing effect logic to handle routing
        console.error("Failed to fetch programState/matches during login redirect", fetchErr);
      }
    } catch (err) {
      setError(friendlyAuthError(err));
    } finally {
      setLoginLoading(false);
    }
  };

  // Handles user signup
  const handleSignup = async () => {
    if (signupForm.password !== signupForm.confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setError(null);
    setStatusMessage(null);
    setSignupLoading(true);
    try {
      await signupWithEmailPassword({
        firstName: signupForm.firstName,
        lastName: signupForm.lastName,
        email: signupForm.email,
        password: signupForm.password,
      });
      setStatusMessage(
        "We sent a verification email. Please verify your address and then return here to continue.",
      );
      setTab("login");
      setLoginForm((prev) => ({ ...prev, email: signupForm.email.trim(), password: "" }));
      setSignupForm(initialSignupState);
    } catch (err) {
      setError(friendlyAuthError(err));
    } finally {
      setSignupLoading(false);
    }
  };

  // Handles resending the verification email; needed if email gets lost
  const handleResendVerification = async () => {
    if (!user) return;
    setError(null);
    setResendLoading(true);
    try {
      await resendVerificationEmail(user);
      setStatusMessage("Verification email re-sent. Please check your inbox.");
    } catch (err) {
      setError(friendlyAuthError(err));
    } finally {
      setResendLoading(false);
    }
  };

  // Handles checking if the user has verified their email
  const handleCheckVerification = async () => {
    setError(null);
    try {
      await refreshUser();
      // After refreshing, check if the email is verified
      if (auth.currentUser?.emailVerified) {
        setStatusMessage("Thanks! Redirecting you shortly.");
      } else {
        setStatusMessage("Still waiting for verification. Please try again after verifying.");
      }
    } catch (err) {
      setError(friendlyAuthError(err));
    }
  };

  const isLoginValid = Boolean(loginForm.email.trim() && loginForm.password);
  const isSignupValid =
    Boolean(
      signupForm.firstName &&
        signupForm.lastName &&
        signupForm.email &&
        signupForm.password &&
        signupForm.confirmPassword,
    ) && signupForm.password === signupForm.confirmPassword;

  return (
    <div className={styles.container}>
      <div className={styles.logoSection}>
        <div className={styles.logoCard}>
          <img 
            src="/faa logo.png" 
            alt="For All Ages Logo" 
            className={styles.logoImage}
          />
        </div>
      </div>
      
      <div className={styles.formSection}>
        <div className={styles.formCard}>
          <div className={styles.tabs}>
            <button
              className={`${styles.tab} ${tab === "login" ? styles.activeTab : ""}`}
              onClick={() => setTab("login")}
              type="button"
            >
              Log-In
            </button>
            <span className={styles.tabDivider}>|</span>
            <button
              className={`${styles.tab} ${tab === "signup" ? styles.activeTab : ""}`}
              onClick={() => setTab("signup")}
              type="button"
            >
              Sign Up
            </button>
          </div>

          <form onSubmit={handleSubmit} className={styles.form}>
            {tab === "login" ? (
              <>
                <div className={styles.inputGroup}>
                  <label htmlFor="loginEmail" className={styles.label}>
                    Email
                  </label>
                  <input
                    type="email"
                    id="loginEmail"
                    name="email"
                    className={styles.input}
                    value={loginForm.email}
                    onChange={handleLoginChange}
                    autoComplete="email"
                    required
                  />
                </div>

                <div className={styles.inputGroup}>
                  <label htmlFor="loginPassword" className={styles.label}>
                    Password
                  </label>
                  <input
                    type="password"
                    id="loginPassword"
                    name="password"
                    className={styles.input}
                    value={loginForm.password}
                    onChange={handleLoginChange}
                    autoComplete="current-password"
                    required
                  />
                </div>

                <button
                  type="submit"
                  className={`${styles.submitButton} ${!isLoginValid || loginLoading ? styles.disabled : ""}`}
                  disabled={!isLoginValid || loginLoading}
                >
                  {loginLoading ? "Logging In..." : "Log-In"}
                </button>
              </>
            ) : (
              <>
                <div className={styles.inputGroup}>
                  <label htmlFor="firstName" className={styles.label}>
                    First Name
                  </label>
                  <input
                    type="text"
                    id="firstName"
                    name="firstName"
                    className={styles.input}
                    value={signupForm.firstName}
                    onChange={handleSignupChange}
                    required
                  />
                </div>

                <div className={styles.inputGroup}>
                  <label htmlFor="lastName" className={styles.label}>
                    Last Name
                  </label>
                  <input
                    type="text"
                    id="lastName"
                    name="lastName"
                    className={styles.input}
                    value={signupForm.lastName}
                    onChange={handleSignupChange}
                    required
                  />
                </div>

                <div className={styles.inputGroup}>
                  <label htmlFor="signupEmail" className={styles.label}>
                    Email
                  </label>
                  <input
                    type="email"
                    id="signupEmail"
                    name="email"
                    className={styles.input}
                    value={signupForm.email}
                    onChange={handleSignupChange}
                    autoComplete="email"
                    required
                  />
                </div>

                <div className={styles.inputGroup}>
                  <label htmlFor="signupPassword" className={styles.label}>
                    Password
                  </label>
                  <input
                    type="password"
                    id="signupPassword"
                    name="password"
                    className={styles.input}
                    value={signupForm.password}
                    onChange={handleSignupChange}
                    autoComplete="new-password"
                    required
                  />
                </div>

                <div className={styles.inputGroup}>
                  <label htmlFor="confirmPassword" className={styles.label}>
                    Confirm Password
                  </label>
                  <input
                    type="password"
                    id="confirmPassword"
                    name="confirmPassword"
                    className={styles.input}
                    value={signupForm.confirmPassword}
                    onChange={handleSignupChange}
                    autoComplete="new-password"
                    required
                  />
                  {signupForm.password &&
                    signupForm.confirmPassword &&
                    signupForm.password !== signupForm.confirmPassword && (
                      <div className={styles.error}>Passwords don't match</div>
                    )}
                </div>

                <button
                  type="submit"
                  className={`${styles.submitButton} ${!isSignupValid || signupLoading ? styles.disabled : ""}`}
                  disabled={!isSignupValid || signupLoading}
                >
                  {signupLoading ? "Signing Up..." : "Sign Up"}
                </button>
              </>
            )}
          </form>

          {error && <div className={styles.errorBanner}>{error}</div>}

          {statusMessage && <div className={styles.statusMessage}>{statusMessage}</div>}

          {needsVerification && (
            <div className={styles.verificationPanel}>
              <p>Please verify your email before continuing. Check your inbox for the verification link.</p>
              <div className={styles.verificationActions}>
                <button
                  type="button"
                  onClick={handleResendVerification}
                  className={styles.auxButton}
                  disabled={resendLoading}
                >
                  {resendLoading ? "Sending..." : "Resend Email"}
                </button>
                <button type="button" onClick={handleCheckVerification} className={styles.auxButton}>
                  I've Verified
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default LoginSignup;
