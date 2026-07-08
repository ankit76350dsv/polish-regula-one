import { Outlet } from "react-router-dom";
import Header from "./Header";
import Footer from "./Footer";

// The shell that wraps every signed-in page: a fixed header, the page content,
// and a footer. The top padding leaves room for the fixed header.
export default function Layout() {
  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900">
      <Header />
      <main className="flex-1 pt-[65px]">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <Outlet />
        </div>
      </main>
      <Footer />
    </div>
  );
}
