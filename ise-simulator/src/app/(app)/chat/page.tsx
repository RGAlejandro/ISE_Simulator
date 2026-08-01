import { ChatClient } from "./chat-client";

export const metadata = {
  title: "Chat — ISE Simulator",
  description: "Ask anything about English: grammar, vocabulary, pronunciation and Trinity ISE exam tips.",
};

export default function ChatPage() {
  return <ChatClient />;
}
