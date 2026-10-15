import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "Clipmax — Make every moment count",
  description:
    "Turn your long-form videos into short clips and original voice-over scripts.",
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
