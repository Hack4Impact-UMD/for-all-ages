import { useRef, useState } from "react";
import styles from "./ProfilePictureEdit.module.css";
import EditIcon from "@mui/icons-material/Edit";
import ProfilePicture from "../ProfilePicture/ProfilePicture";

interface ProfilePictureEditProps {
  uid: string;
}

export default function ProfilePictureEdit({ uid }: ProfilePictureEditProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [menuOpen, setMenuOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [removed, setRemoved] = useState(false);
  const [version, setVersion] = useState<number | undefined>(undefined);

  const handleEditClick = () => {
    setMenuOpen((prev) => !prev);
  };

  const handleSelectUpload = () => {
    setMenuOpen(false);
    setRemoved(false);
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile || !uid) return;

    const formData = new FormData();
    formData.append("file", selectedFile);
    formData.append("uid", uid);

    try {
      setLoading(true);

      const res = await fetch(
        "https://us-central1-for-all-ages-8a4e2.cloudfunctions.net/uploadProfilePicture",
        {
          method: "POST",
          body: formData,
        },
      );

      if (!res.ok) {
        throw new Error(await res.text());
      }

      setRemoved(false);
      setMenuOpen(false);
      setVersion(Date.now());
    } catch (err) {
      console.error("Upload failed:", err);
    } finally {
      setLoading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleRemove = async () => {
    if (!uid) return;

    try {
      setLoading(true);
      setMenuOpen(false);

      const res = await fetch(
        "https://us-central1-for-all-ages-8a4e2.cloudfunctions.net/removeProfilePicture",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ uid }),
        },
      );

      const text = await res.text();

      if (!res.ok) {
        throw new Error(text);
      }

      setRemoved(true);

      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    } catch (err) {
      console.error("Remove failed:", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.pictureWrapper}>
        <ProfilePicture uid={removed ? undefined : uid} size={190} version={version} />

        <button
          type="button"
          className={styles.editButton}
          onClick={handleEditClick}
          disabled={loading}
        >
          <EditIcon />
        </button>

        {menuOpen && (
          <div className={styles.popupMenu}>
            <button
              type="button"
              onClick={handleSelectUpload}
              disabled={loading}
            >
              Upload
            </button>
            <button type="button" onClick={handleRemove} disabled={loading}>
              Remove
            </button>
          </div>
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          hidden
          onChange={handleFileChange}
        />
      </div>

      {loading && <p className={styles.uploadingText}>Working...</p>}
    </div>
  );
}
