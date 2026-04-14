import type { Metadata } from "next";
import { APP_NAME } from "@household/config";
import { WebQueryProvider } from "../components/query-provider";
import "./globals.css";

export const metadata: Metadata = {
  title: APP_NAME,
  description: "한국 사용자 대상 가계부 서비스 MVP"
};

export default function RootLayout({
  children
  // NOTE: Mixed React type versions in workspace require a permissive boundary here.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
}: Readonly<{ children: any }>) {
  return (
    <html lang="ko">
      <body>
        <WebQueryProvider>{children}</WebQueryProvider>
      </body>
    </html>
  );
}
