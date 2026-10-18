import { ArrowUp } from "lucide-react";
import { Button } from "@/components/ui/button";

const BackToTopButton = ({ visible }) => {
  if (!visible) {
    return null;
  }

  return (
    <Button
      onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
      size="icon"
      variant="outline"
      className="fixed right-6 bottom-6 z-20 size-10 rounded-full bg-popover shadow-lg"
      aria-label="Back to top"
    >
      <ArrowUp />
    </Button>
  );
};

export default BackToTopButton;
