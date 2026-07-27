import { Link } from "react-router-dom";

export default function NotFound() {
  return (
    <div className="max-w-xl mx-auto px-4 py-24 text-center">
      <p className="text-5xl font-extrabold text-indigo-600">404</p>
      <h1 className="text-xl font-bold text-slate-800 mt-3">Page not found</h1>
      <p className="text-slate-500 mt-2">The page you were looking for does not exist.</p>
      <Link
        to="/"
        className="inline-block mt-6 px-5 py-2.5 rounded-xl bg-gradient-to-r from-indigo-500 to-blue-500 text-white font-semibold"
      >
        Back to Clock
      </Link>
    </div>
  );
}
