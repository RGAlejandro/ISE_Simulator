import { PronunciationClient } from "./pronunciation-client";

export const metadata = {
  title: "Pronunciation — ISE Simulator",
  description: "Practise your English pronunciation in RP or American accent with instant feedback.",
};

export default function PronunciationPage() {
  return <PronunciationClient />;
}
