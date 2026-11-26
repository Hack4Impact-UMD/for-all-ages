export default function MediumInput({
  name,
  required,
  className,
  defaultValue,
}: {
  name: string;
  required: boolean;
  className?: string;
  defaultValue?: string;
}) {
  return (
    <input
      type="text"
      name={name}
      maxLength={320}
      defaultValue={defaultValue}
      required={required}
      className={className}
    />
  );
}