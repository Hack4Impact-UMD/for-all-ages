export default function DropdownInput({
  name,
  options,
  required,
  className,
  defaultValue,
}: {
  name: string;
  options: string[];
  required: boolean;
  className?: string;
  defaultValue?: string;
}) {
  return (
    <select name={name} required={required} className={className} defaultValue={defaultValue ?? ""}>
      <option value="">
        Select an option
      </option>
      {options.map((opt) => (
        <option key={opt} value={opt}>
          {opt}
        </option>
      ))}
    </select>
  );
}
