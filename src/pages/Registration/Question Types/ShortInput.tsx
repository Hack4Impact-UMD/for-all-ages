export default function ShortInput({
  name,
  required,
  className,
}: {
  name: string;
  required: boolean;
  className?: string;
}) {
  return (
    <input
      type="text"
      name={name}
      maxLength={160}
      required={required}
      className={className}
    />
  );
}