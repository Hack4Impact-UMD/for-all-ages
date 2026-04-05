export default function LongInput({
  name,
  required,
  className,
  id,
}: {
  name: string;
  required: boolean;
  className?: string;
  id?: string;
}) {
  return (
    <textarea
      id={id}
      name={name}
      maxLength={1000}
      rows={5}
      required={required}
      className={className}
    />
  );
}