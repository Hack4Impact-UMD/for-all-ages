export default function LongInput({
  name,
  required,
  className,
  id,
  defaultValue,
}: {
  name: string;
  required: boolean;
  className?: string;
  id?: string;
  defaultValue?: string;
}) {
  return (
    <textarea
      id={id}
      name={name}
      maxLength={1000}
      rows={5}
      defaultValue={defaultValue}
      required={required}
      className={className}
    />
  );
}