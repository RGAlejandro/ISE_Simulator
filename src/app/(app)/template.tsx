import { PageTurn } from "@/components/layout/page-turn";

/** Re-mounted on every navigation inside the app: plays the page-turn animation. */
export default function AppTemplate({ children }: { children: React.ReactNode }) {
  return <PageTurn>{children}</PageTurn>;
}
