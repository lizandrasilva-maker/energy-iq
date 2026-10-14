export function Select({ value, onValueChange, children }) {
  return (
    <select 
      value={value} 
      onChange={(e) => onValueChange(e.target.value)}
      className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
    >
      {children}
    </select>
  );
}

export function SelectTrigger({ children }) { return children; }
export function SelectValue() { return null; }
export function SelectContent({ children }) { return children; }
export function SelectItem({ value, children }) {
  return <option value={value}>{children}</option>;
}