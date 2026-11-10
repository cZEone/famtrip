import "./globals.css";

export const metadata = {
  title: "Family Trip 2026",
  description: "Our shared board of places to eat, go and do.",
};

export const viewport = { width: "device-width", initialScale: 1 };

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
