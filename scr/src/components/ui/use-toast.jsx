export function useToast() {
  const toast = ({ title, description, variant }) => {
    if (variant === "destructive") {
      console.error(`[Toast Error] ${title}: ${description || ""}`);
    } else {
      console.log(`[Toast] ${title}: ${description || ""}`);
    }
  };

  return { toast };
}