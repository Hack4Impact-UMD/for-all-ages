export default function MediumInput({
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
      maxLength={320}
      required={required}
      className={className}
    />
  );
}