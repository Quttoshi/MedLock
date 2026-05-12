import { useAuth } from "../context/AuthContext";

function DoctorNavbar({ onMenuClick }) {
  const { user } = useAuth();

  return (
    <header className="h-16 bg-white border-b border-gray-100 shadow-sm flex items-center px-4 md:px-6 gap-4 sticky top-0 z-10">
      <button
        onClick={onMenuClick}
        className="lg:hidden text-gray-500 hover:text-gray-700 transition"
      >
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>

      <div className="flex-1">
        <h2 className="text-base font-semibold text-gray-700">
          Welcome back,{" "}
          <span className="text-green-600">
            {user?.name?.split(" ")[0] || "Doctor"}
          </span>
        </h2>
      </div>

      <div className="w-9 h-9 rounded-full bg-green-100 flex items-center justify-center">
        <span className="text-green-600 font-semibold text-sm">
          {user?.name?.charAt(0).toUpperCase() || "D"}
        </span>
      </div>
    </header>
  );
}

export default DoctorNavbar;