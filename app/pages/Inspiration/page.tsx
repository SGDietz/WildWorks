import { notFound } from "next/navigation";

const inspirationSubpageDormant = true;

export default function InspirationPage() {
  if (inspirationSubpageDormant) {
    notFound();
  }

  return null;
}
