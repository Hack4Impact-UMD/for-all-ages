import { useEffect, useState } from "react";
import styles from "../../Profile.module.css";

const ProfilePicture = ({
  uid,
  size = 64,
  version,
}: {
  uid?: string;
  size?: number;
  version?: number;
}) => {
  const [imageError, setImageError] = useState(false);

  useEffect(() => {
    setImageError(false);
  }, [uid, version]);

  const defaultSrc =
    "https://i.pinimg.com/474x/33/f8/26/33f8266681c946cd80de486c499fe992.jpg";

  const src = uid
    ? `https://storage.googleapis.com/for-all-ages-cdn/profile-pictures/${uid}${version !== undefined ? `?t=${version}` : ""}`
    : "";

  return (
    <img
      src={!uid || imageError ? defaultSrc : src}
      alt="Profile"
      className={styles.profileImage}
      style={{ width: size, height: size }}
      onError={() => setImageError(true)}
    />
  );
};

export default ProfilePicture;
