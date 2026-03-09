import { useRef, useState, useEffect } from "react";
import styles from "./ProfilePictureEdit.module.css";
import EditIcon from "@mui/icons-material/Edit";

interface ProfilePictureEditProps {
  uid: string;
}

export default function ProfilePictureEdit({ uid }: ProfilePictureEditProps) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploaded, setUploaded] = useState(false);
	const [file, setFile] = useState<File | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

	useEffect(() => {
		if (!uid) return;
		const cdnUrl = `https://storage.googleapis.com/for-all-ages-cdn/profile-pictures/${uid}?t=${Date.now()}`;

		const img = new Image();
		img.onload = () => setPreviewUrl(cdnUrl);
		img.onerror = () => {}; // no image yet, stay at default empty state
		img.src = cdnUrl;
	}, [uid]);

	const handleEditClick = () => {
		fileInputRef.current?.click()
	}

	const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		const f = e.target.files?.[0];
		console.log("file change", f);
		if (!f) return;
		setFile(f);
		setPreviewUrl(URL.createObjectURL(f));
		setUploaded(false);
	};

	const handleUpload = async () => {
		console.log("handleUpload called", { file, uid });
		if (!file) {
			console.warn("no file – not uploading");
			return;
		}
		if (!uid) {
			console.warn("no uid – not uploading");
			return;
		}
		console.log("uploading file", file.name, file.type, file.size);
		setUploading(true);

		const formData = new FormData();
		formData.append("file", file);
		formData.append("uid", uid);

		try {
			const res = await fetch(
				"https://us-central1-for-all-ages-8a4e2.cloudfunctions.net/uploadProfilePicture",
				{ method: "POST", body: formData }
			);
			if (!res.ok) throw new Error(await res.text());
			setUploaded(true);
		} catch (err) {
			console.error("Upload failed:", err);
		} finally {
			setUploading(false);
		}
	};

  const handleRemove = () => {
    setPreviewUrl(null);
    setUploaded(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  return (
    <div className={styles.wrapper}>
      <div className={styles.pfpCircle}>
				{previewUrl && (
					<img src={previewUrl} alt="Profile preview" className={styles.previewImage} />
				)}
			</div>
          
			<button className={styles.editIconBox} onClick={handleEditClick}>
				<EditIcon className={styles.editIcon} />
			</button>

			<input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        style={{ display: "none" }}
        onChange={handleFileChange}
      />

      {previewUrl && (
        <div className={styles.actions}>
          <button onClick={handleUpload} disabled={uploading || uploaded}>
            {uploading ? "Uploading..." : uploaded ? "Uploaded!" : "Upload"}
          </button>
          <button onClick={handleRemove}>Remove</button>
        </div>
      )}
    </div>
  );
}
