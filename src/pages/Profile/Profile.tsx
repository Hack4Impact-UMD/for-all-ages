import styles from "./Profile.module.css";
import Navbar from "../../components/Navbar";
import { useState } from "react";
import { phoneNumberRegex, emailRegex, dateRegex } from "../../regex";
import EditIcon from "@mui/icons-material/Edit";

interface UserProfile {
  name: string;
  email: string;
  password: string;
  pronouns: string;
  phone: string;
  birthday: string;
  address: string;
  interests: string;
  startDate: string;
  endDate: string;
  status: string;
}

type ErrorState = {
  email?: string;
  phone?: string;
  birthday?: string;
  address?: string;
};

const Profile = () => {
  const [user, setUser] = useState<UserProfile>({
    name: "Hermione Granger",
    email: "ron@hotmail.com",
    password: "************",
    pronouns: "She/Her",
    phone: "(321) 654-6767",
    birthday: "01/08/1995",
    address: "7901 Regents Drive, College Park, MD 20742",
    interests: "Reading, Running, Crocheting",
    startDate: "September 15, 2025",
    endDate: "December 1, 2025",
    status: "Participant",
  });

  const [errors, setErrors] = useState<ErrorState>({});
  const [editingField, setEditingField] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setUser({ ...user, [name]: value });
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();

    const newErrors: ErrorState = {};
    if (!emailRegex.test(user.email)) newErrors.email = "Invalid email format";
    if (!phoneNumberRegex.test(user.phone))
      newErrors.phone = "Invalid phone format";
    if (!dateRegex.test(user.birthday))
      newErrors.birthday = "Invalid date (MM/DD/YYYY)";
    if (!user.address.trim()) newErrors.address = "Address cannot be empty";

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setErrors({});
    setEditingField(null);
    setIsEditing(false);
  };

  return (
    <div className={styles.page}>
      <Navbar />

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
            <p className={styles.matchText}>No match assigned yet</p>
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
            <div className={styles.activeTag}>Active</div>
          </div>
        </div>

        {/* RIGHT COLUMN */}
        <form className={styles.rightColumn} onSubmit={handleSave}>
          {/* personal info */}
          <div className={styles.infoSection}>
            <h3 className={styles.sectionTitle}>Personal Information</h3>
            <div className={styles.grid}>
              {[
                { label: "E-mail", name: "email", value: user.email },
                { label: "Password", name: "password", value: user.password },
                { label: "Pronouns", name: "pronouns", value: user.pronouns },
                { label: "Phone Number", name: "phone", value: user.phone },
                { label: "Birthday", name: "birthday", value: user.birthday },
                { label: "Address", name: "address", value: user.address },
              ].map((field) => (
                <div key={field.name} className={styles.fieldBox}>
                  {editingField === field.name ? (
                    <input
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
                        {(field.name === "email" ||
                          field.name === "password" ||
                          field.name === "address" ||
                          field.name === "phone" ||
                          field.name === "pronouns") && (
                          <EditIcon
                            className={styles.editIcon}
                            onClick={() => {
                              setEditingField(field.name);
                              setIsEditing(true);
                            }}
                          />
                        )}
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
          </div>

          {/* interests */}
          <div className={styles.infoSection}>
            <h3 className={styles.sectionTitle}>About Me</h3>
            <div className={styles.fieldBox}>
              {editingField === "interests" ? (
                <textarea
                  name="interests"
                  value={user.interests}
                  onChange={(e) =>
                    setUser({
                      ...user,
                      interests: e.target.value,
                    })
                  }
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
          </div>

          {isEditing && (
            <div className={styles.buttons}>
              <button type="submit" className={styles.save}>
                Save
              </button>
            </div>
          )}
        </form>
      </div>
    </div>
  );
};

export default Profile;
