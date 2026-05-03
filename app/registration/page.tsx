import { Suspense } from "react";
import RegistrationPageContent from "@/screens/02_Registration/page";

export default function RegistrationPage() {
  return (
    <Suspense>
      <RegistrationPageContent />
    </Suspense>
  );
}
