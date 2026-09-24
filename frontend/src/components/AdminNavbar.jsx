import { useAuth } from "../context/AuthContext";

function AdminNavbar({ onMenuClick }) {
  const { user } = useAuth();

  return (
    <header className="app-topbar flex items-center px-4 md:px-6 gap-4 sticky top-0 z-10">
      <button
        onClick={onMenuClick}
        className="lg:hidden text-gray-500 hover:text-gray-800 transition"
      >
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>

      <div className="flex-1">
        <h2 className="text-base font-semibold text-gray-700">
          Welcome back,{" "}
          <span className="text-gray-700">
            {user?.name?.split(" ")[0] || "Admin"}
          </span>
        </h2>
      </div>

      <div className="w-9 h-9 rounded-full bg-gray-100 ring-1 ring-gray-200 flex items-center justify-center">
        <span className="text-gray-700 font-semibold text-sm">
          {user?.name?.charAt(0).toUpperCase() || "A"}
        </span>
      </div>
    </header>
  );
}

export default AdminNavbar;



