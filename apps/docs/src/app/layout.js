import './globals.css';
export const metadata = {
    title: 'HelpNest Docs',
    description: 'HelpNest documentation',
};
export default function RootLayout({ children }) {
    return (<html lang="en">
      <body>{children}</body>
    </html>);
}
