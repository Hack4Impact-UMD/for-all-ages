import styles from "./Profile.module.css";
import { useState, useEffect } from "react";
import { phoneNumberRegex, emailRegex, dateRegex } from "../../regex";
import EditIcon from "@mui/icons-material/Edit";
import {
  signOut,
  onAuthStateChanged,
  updatePassword,
  reauthenticateWithCredential,
  EmailAuthProvider,
  verifyBeforeUpdateEmail,
} from "firebase/auth";
import type { User as FirebaseUser } from "firebase/auth";
import { auth, db } from "../../firebase";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { useNavigate } from "react-router-dom";
import { getMatchesByParticipant, getPartnerId } from "../../services/matches";
import EmailReauthModal from "./components/EmailReauthModal/EmailReauthModal";
import MatchInterestsModal from "./components/MatchInterestsModal/MatchInterestsModal";

interface UserProfile {
  uid: string;
  name: string;
  email: string;
  pronouns: string;
  phone: string;
  birthday: string;

  addressLine1: string;
  addressCity: string;
  addressState: string;
  addressPostalCode: string;
  addressCountry: string;

  interests: string;
  startDate: string;
  endDate: string;
  status: string;
  matchName?: string;
  matchInterests?: string;
}

type ErrorState = {
  email?: string;
  phone?: string;
  birthday?: string;
  addressLine1?: string;
  addressCity?: string;
  addressState?: string;
  addressPostalCode?: string;
  addressCountry?: string;
};

// convert birthday to same format as firebase
const normalizeBirthday = (raw: string | undefined | null): string => {
  if (!raw) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  const m = raw.match(
    /^(0[1-9]|1[0-2])[/\-](0[1-9]|[12]\d|3[01])[/\-](\d{4})$/,
  );
  if (m) {
    const [, mm, dd, yyyy] = m;
    return `${yyyy}-${mm}-${dd}`;
  }
  return raw;
};

const Profile = () => {
  const navigate = useNavigate();

  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [user, setUser] = useState<UserProfile | null>(null);

  const [errors, setErrors] = useState<ErrorState>({});
  const [editingField, setEditingField] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [logoutError, setLogoutError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [showInterestsModal, setShowInterestsModal] = useState(false);

  // password change
  const [passwordCurrent, setPasswordCurrent] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null);
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);

  // email reauth modal
  const [showEmailReauthModal, setShowEmailReauthModal] = useState(false);
  const [emailReauthPassword, setEmailReauthPassword] = useState("");
  const [emailReauthError, setEmailReauthError] = useState<string | null>(null);
  const [isEmailReauthing, setIsEmailReauthing] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (fbUser) => {
      if (!fbUser) {
        setFirebaseUser(null);
        setUser(null);
        setLoading(false);
        return;
      }

      setFirebaseUser(fbUser);

      try {
        const participantRef = doc(db, "participants", fbUser.uid);
        const snap = await getDoc(participantRef);

        if (!snap.exists()) {
          console.warn("No participant doc for uid:", fbUser.uid);
          const fallback: UserProfile = {
            uid: fbUser.uid,
            name: fbUser.displayName ?? "",
            email: fbUser.email ?? "",
            pronouns: "",
            phone: "",
            birthday: "",
            addressLine1: "",
            addressCity: "",
            addressState: "",
            addressPostalCode: "",
            addressCountry: "",
            interests: "",
            startDate: "",
            endDate: "",
            status: "Participant",
          };
          setUser(fallback);
          setLoading(false);
          return;
        }

        const data: any = snap.data();
        const addr = data.address ?? {};

        let matchName = "";
        let matchInterests = "";

        try {
          const matches = await getMatchesByParticipant(fbUser.uid);
          if (matches.length > 0) {
            const firstMatch = matches[0];
            const partnerId = getPartnerId(firstMatch, fbUser.uid);

            const partnerRef = doc(db, "participants", partnerId);
            const partnerSnap = await getDoc(partnerRef);
            if (partnerSnap.exists()) {
              const partnerData: any = partnerSnap.data();
              matchName =
                partnerData.displayName ??
                partnerData.name ??
                [partnerData.firstName, partnerData.lastName]
                  .filter(Boolean)
                  .join(" ");
              matchInterests =
                partnerData.interests ?? partnerData.freeResponse ?? "";
            }
          }
        } catch (matchErr) {
          console.error("Error fetching match info:", matchErr);
        }

        const profile: UserProfile = {
          uid: fbUser.uid,
          name: data.displayName ?? data.name ?? fbUser.displayName ?? "",
          email: data.email ?? fbUser.email ?? "",
          pronouns: data.pronouns ?? "",
          phone: data.phoneNumber ?? "",
          // normalize when loading from Firestore
          birthday: normalizeBirthday(data.dateOfBirth),
          addressLine1: addr.line1 ?? "",
          addressCity: addr.city ?? "",
          addressState: addr.state ?? "",
          addressPostalCode: addr.postalCode ?? "",
          addressCountry: addr.country ?? "",
          interests: data.interests ?? "",
          startDate: data.startDate ?? "",
          endDate: data.endDate ?? "",
          status: data.type ?? "Participant",
          matchName,
          matchInterests,
        };

        setUser(profile);
      } catch (err) {
        console.error("Error loading user profile:", err);
        const fallback: UserProfile = {
          uid: fbUser.uid,
          name: fbUser.displayName ?? "",
          email: fbUser.email ?? "",
          pronouns: "",
          phone: "",
          birthday: "",
          addressLine1: "",
          addressCity: "",
          addressState: "",
          addressPostalCode: "",
          addressCountry: "",
          interests: "",
          startDate: "",
          endDate: "",
          status: "Participant",
        };
        setUser(fallback);
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  // live password mismatch validation
  useEffect(() => {
    if (!newPassword && !confirmNewPassword) {
      setPasswordError(null);
      return;
    }
    if (newPassword !== confirmNewPassword) {
      setPasswordError("New password and confirmation do not match.");
    } else {
      setPasswordError(null);
    }
  }, [newPassword, confirmNewPassword]);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => {
    if (!user) return;
    const { name, value } = e.target;
    setUser({ ...user, [name]: value });
  };

  const validateProfile = () => {
    if (!user) return { hasErrors: true, newErrors: {} as ErrorState };

    const newErrors: ErrorState = {};
    if (!emailRegex.test(user.email)) newErrors.email = "Invalid email format";
    if (!phoneNumberRegex.test(user.phone))
      newErrors.phone = "Invalid phone format";

    if (user.birthday && !dateRegex.test(user.birthday))
      newErrors.birthday = "Invalid date format";

    if (!user.addressLine1.trim())
      newErrors.addressLine1 = "Street address cannot be empty";
    if (!user.addressCity.trim())
      newErrors.addressCity = "City cannot be empty";
    if (!user.addressState.trim())
      newErrors.addressState = "State cannot be empty";
    if (!user.addressPostalCode.trim())
      newErrors.addressPostalCode = "Postal code cannot be empty";
    if (!user.addressCountry.trim())
      newErrors.addressCountry = "Country cannot be empty";

    const hasErrors = Object.keys(newErrors).length > 0;
    return { hasErrors, newErrors };
  };

  const performProfileUpdate = async (
    passwordForEmail?: string,
  ): Promise<void> => {
    if (!user) return;

    const authUser = auth.currentUser;
    if (!authUser) {
      window.alert("You are not signed in. Please log in again.");
      return;
    }

    const emailChanged = authUser.email !== user.email;

    const normalizedBirthday = normalizeBirthday(user.birthday);

    if (normalizedBirthday !== user.birthday) {
      setUser({ ...user, birthday: normalizedBirthday });
    }

    if (emailChanged && !passwordForEmail) {
      setEmailReauthError(null);
      setEmailReauthPassword("");
      setShowEmailReauthModal(true);
      return;
    }

    try {
      if (emailChanged && passwordForEmail) {
        if (!authUser.email) {
          setEmailReauthError(
            "Your account is missing an email address. Please sign out and sign back in.",
          );
          setShowEmailReauthModal(true);
          return;
        }

        setIsEmailReauthing(true);
        const credential = EmailAuthProvider.credential(
          authUser.email,
          passwordForEmail,
        );

        await reauthenticateWithCredential(authUser, credential);

        // verify email before updating in firebase auth
        await verifyBeforeUpdateEmail(authUser, user.email);

        setShowEmailReauthModal(false);
        setEmailReauthPassword("");
        setEmailReauthError(null);

        window.alert(
          `Profile saved. We’ve emailed a verification link to ${user.email}. Please confirm it to finish updating your login email.`,
        );
      }

      const userRef = doc(db, "participants", user.uid);
      await updateDoc(userRef, {
        displayName: user.name,
        email: user.email,
        pronouns: user.pronouns,
        phoneNumber: user.phone,
        dateOfBirth: normalizedBirthday,
        interests: user.interests,
        address: {
          line1: user.addressLine1,
          city: user.addressCity,
          state: user.addressState,
          postalCode: user.addressPostalCode,
          country: user.addressCountry,
        },
      });

      if (!emailChanged) {
        window.alert("Profile updated successfully.");
      }
    } catch (err: any) {
      console.error("Error updating profile (email/profile):", err);

      const code = err?.code as string | undefined;
      const msg = err?.message as string | undefined;

      if (code === "auth/wrong-password") {
        setEmailReauthError("Current password is incorrect.");
        setShowEmailReauthModal(true);
      } else if (code === "auth/requires-recent-login") {
        setEmailReauthError(
          "For security reasons, please sign out and sign back in, then try again.",
        );
        setShowEmailReauthModal(true);
      } else if (code === "auth/email-already-in-use") {
        setEmailReauthError(
          "That email is already associated with another account.",
        );
        setShowEmailReauthModal(true);
      } else if (code === "auth/invalid-email") {
        setEmailReauthError("Please enter a valid email address.");
        setShowEmailReauthModal(true);
      } else if (code === "auth/operation-not-allowed") {
        setEmailReauthError(
          "Email changes are currently disabled for this project. Please contact an administrator.",
        );
        setShowEmailReauthModal(true);
      } else if (code === "permission-denied") {
        setEmailReauthError(
          "You do not have permission to update this profile. Please contact an admin.",
        );
        setShowEmailReauthModal(true);
      } else {
        setEmailReauthError(
          msg || "Unexpected error updating profile. Please try again.",
        );
        if (emailChanged && passwordForEmail) {
          setShowEmailReauthModal(true);
        }
      }
    } finally {
      if (passwordForEmail) {
        setIsEmailReauthing(false);
      }
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    const { hasErrors, newErrors } = validateProfile();
    if (hasErrors) {
      setErrors(newErrors);
      return;
    }

    setErrors({});
    setEditingField(null);
    setIsEditing(false);

    await performProfileUpdate();
  };

  const handleLogout = async () => {
    setLogoutError(null);
    const confirmed = window.confirm("To log out, please confirm.");
    if (!confirmed) return;

    try {
      await signOut(auth);
      navigate("/", { replace: true });
    } catch (error) {
      console.error("Failed to log out", error);
      setLogoutError("Could not log out. Please try again.");
    }
  };

  const handlePasswordSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (passwordError || !newPassword) return;

    const authUser = auth.currentUser;
    if (!authUser) {
      setPasswordError("You are not signed in. Please log in again.");
      return;
    }

    if (!passwordCurrent) {
      setPasswordError("Please enter your current password.");
      return;
    }

    if (!authUser.email) {
      setPasswordError("Missing email for re-authentication.");
      return;
    }

    try {
      setIsUpdatingPassword(true);
      setPasswordSuccess(null);
      setPasswordError(null);

      const credential = EmailAuthProvider.credential(
        authUser.email,
        passwordCurrent,
      );
      await reauthenticateWithCredential(authUser, credential);
      await updatePassword(authUser, newPassword);

      setPasswordSuccess("Password updated successfully.");
      setPasswordCurrent("");
      setNewPassword("");
      setConfirmNewPassword("");
    } catch (err: any) {
      console.error("Error updating password:", err);

      if (err?.code === "auth/wrong-password") {
        setPasswordError("Current password is incorrect.");
      } else if (err?.code === "auth/too-many-requests") {
        setPasswordError("Too many attempts. Please wait a bit and try again.");
      } else if (err?.code === "auth/requires-recent-login") {
        setPasswordError(
          "Please sign out and sign back in, then try changing your password again.",
        );
      } else {
        setPasswordError(err?.message || "Error updating password.");
      }
    } finally {
      setIsUpdatingPassword(false);
    }
  };

  const canSubmitPassword =
    !!passwordCurrent &&
    !!newPassword &&
    !!confirmNewPassword &&
    !passwordError &&
    !isUpdatingPassword;

  if (loading) {
    return <div className={styles.page}>Loading profile...</div>;
  }

  if (!user) {
    return (
      <div className={styles.page}>
        <p>No user is signed in.</p>
      </div>
    );
  }

  const personalFields = [
    { label: "Name", name: "name", value: user.name },
    { label: "E-mail", name: "email", value: user.email },
    { label: "Pronouns", name: "pronouns", value: user.pronouns },
    { label: "Phone Number", name: "phone", value: user.phone },
    { label: "Birthday", name: "birthday", value: user.birthday },
    { label: "Street Address", name: "addressLine1", value: user.addressLine1 },
    { label: "City", name: "addressCity", value: user.addressCity },
    { label: "State", name: "addressState", value: user.addressState },
    {
      label: "Postal Code",
      name: "addressPostalCode",
      value: user.addressPostalCode,
    },
    { label: "Country", name: "addressCountry", value: user.addressCountry },
  ] as const;

  const isEditingPersonalField =
    isEditing && personalFields.some((f) => f.name === editingField);

  return (
    <div className={styles.page}>
      <div className={styles.container}>
        {/* LEFT COLUMN */}
        <div className={styles.leftColumn}>
          <div className={styles.infoCard}>
            <img
              src="https://thumbs.dreamstime.com/b/default-profile-picture-avatar-photo-placeholder-vector-illustration-default-profile-picture-avatar-photo-placeholder-vector-189495158.jpg"
              alt="Profile"
              className={styles.profileImage}
            />
            <h2 className={styles.profileName}>{user.name}</h2>
            <span className={styles.statusTag}>{user.status}</span>
          </div>

          <div className={styles.infoCard}>
            <h3>Your Match</h3>
            <div className={styles.matchCircle}></div>
            <p className={styles.matchText}>
              {user.matchName && user.matchName.trim().length > 0
                ? user.matchName
                : "No match assigned yet"}
            </p>

            {user.matchName && user.matchName.trim().length > 0 && (
              <button
                type="button"
                className={styles.viewInterestsButton}
                onClick={() => setShowInterestsModal(true)}
              >
                View their interests
              </button>
            )}
          </div>

          <div className={styles.infoCard}>
            <h3>Program Info</h3>
            <p>
              <strong>Start Date:</strong>
              <br />
              <span className={styles.date}>{user.startDate}</span>
            </p>
            <p>
              <strong>End Date:</strong>
              <br />
              <span className={styles.date}>{user.endDate}</span>
            </p>
          </div>

          <div className={styles.infoCard}>
            <h3>Account</h3>
            <button
              type="button"
              className={styles.logoutButton}
              onClick={handleLogout}
            >
              Log Out
            </button>
            {logoutError && <p className={styles.logoutError}>{logoutError}</p>}
          </div>
        </div>

        {/* RIGHT COLUMN */}
        <form className={styles.rightColumn} onSubmit={handleSave}>
          {/* Personal information */}
          <div className={styles.infoSection}>
            <h3 className={styles.sectionTitle}>Personal Information</h3>
            <div className={styles.grid}>
              {personalFields.map((field) => (
                <div key={field.name} className={styles.fieldBox}>
                  {editingField === field.name ? (
                    <input
                      type={field.name === "birthday" ? "date" : "text"}
                      name={field.name}
                      value={user[field.name as keyof UserProfile] as string}
                      onChange={handleChange}
                      autoFocus
                      className={styles.input}
                    />
                  ) : (
                    <div className={styles.boxContent}>
                      <div className={styles.boxHeader}>
                        <span className={styles.boxLabel}>{field.label}</span>
                        <EditIcon
                          className={styles.editIcon}
                          onClick={() => {
                            setEditingField(field.name);
                            setIsEditing(true);
                          }}
                        />
                      </div>
                      <span className={styles.boxValue}>{field.value}</span>
                    </div>
                  )}
                  {errors[field.name as keyof ErrorState] && (
                    <span className={styles.error}>
                      {errors[field.name as keyof ErrorState]}
                    </span>
                  )}
                </div>
              ))}
            </div>

            {isEditingPersonalField && (
              <div className={styles.buttons}>
                <button type="submit" className={styles.save}>
                  Save
                </button>
              </div>
            )}
          </div>

          {/* About Me */}
          <div className={styles.infoSection}>
            <h3 className={styles.sectionTitle}>About Me</h3>
            <div className={styles.fieldBox}>
              {editingField === "interests" ? (
                <textarea
                  name="interests"
                  value={user.interests}
                  onChange={handleChange}
                  rows={3}
                  autoFocus
                  className={styles.textarea}
                />
              ) : (
                <div className={styles.boxContent}>
                  <div className={styles.boxHeader}>
                    <span className={styles.boxLabel}>Interests</span>
                    <EditIcon
                      className={styles.editIcon}
                      onClick={() => {
                        setEditingField("interests");
                        setIsEditing(true);
                      }}
                    />
                  </div>
                  <span className={styles.boxValue}>{user.interests}</span>
                </div>
              )}
            </div>

            {isEditing && editingField === "interests" && (
              <div className={styles.buttons}>
                <button type="submit" className={styles.save}>
                  Save
                </button>
              </div>
            )}
          </div>

          {/* Change Password */}
          <div className={styles.infoSection}>
            <h3 className={styles.sectionTitle}>Change Password</h3>

            <div className={styles.fieldBox}>
              <div className={styles.boxContent}>
                <div className={styles.boxHeader}>
                  <span className={styles.boxLabel}>Current Password</span>
                </div>
                <input
                  type="password"
                  className={styles.input}
                  value={passwordCurrent}
                  onChange={(e) => setPasswordCurrent(e.target.value)}
                />
              </div>
            </div>

            <div className={styles.fieldBox}>
              <div className={styles.boxContent}>
                <div className={styles.boxHeader}>
                  <span className={styles.boxLabel}>New Password</span>
                </div>
                <input
                  type="password"
                  className={styles.input}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                />
              </div>
            </div>

            <div className={styles.fieldBox}>
              <div className={styles.boxContent}>
                <div className={styles.boxHeader}>
                  <span className={styles.boxLabel}>Confirm New Password</span>
                </div>
                <input
                  type="password"
                  className={styles.input}
                  value={confirmNewPassword}
                  onChange={(e) => setConfirmNewPassword(e.target.value)}
                />
              </div>
            </div>

            {passwordError && (
              <span className={styles.error}>{passwordError}</span>
            )}
            {passwordSuccess && (
              <span className={styles.success}>{passwordSuccess}</span>
            )}

            <div className={styles.buttons}>
              <button
                type="button"
                className={styles.save}
                disabled={!canSubmitPassword}
                onClick={handlePasswordSubmit}
              >
                {isUpdatingPassword ? "Updating..." : "Change Password"}
              </button>
            </div>
          </div>
        </form>
      </div>

      <MatchInterestsModal
        open={showInterestsModal}
        matchName={user.matchName}
        matchInterests={user.matchInterests}
        onClose={() => setShowInterestsModal(false)}
      />

      <EmailReauthModal
        open={showEmailReauthModal}
        loading={isEmailReauthing}
        error={emailReauthError}
        password={emailReauthPassword}
        onPasswordChange={setEmailReauthPassword}
        onCancel={() => {
          if (!isEmailReauthing) {
            setShowEmailReauthModal(false);
            setEmailReauthPassword("");
            setEmailReauthError(null);
          }
        }}
        onConfirm={() => {
          if (!emailReauthPassword) {
            setEmailReauthError("Please enter your password.");
            return;
          }
          setEmailReauthError(null);
          void performProfileUpdate(emailReauthPassword);
        }}
      />
    </div>
  );
};

export default Profile;
