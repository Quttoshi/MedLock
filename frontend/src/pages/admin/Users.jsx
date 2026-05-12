import { useEffect, useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { getAdminUsers } from "../../api/admin";

const roleBadge = {
  patient: "bg-blue-100 text-blue-700",
  doctor: "bg-green-100 text-green-700",
  medical_center: "bg-purple-100 text-purple-700",
  admin: "bg-red-100 text-red-700",
};

function Users() {
  const { token } = useAuth();
  const [users, setUsers] = useState([]);
  const [filter, setFilter] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    getAdminUsers(token, filter)
      .then((res) => setUsers(res.data))
      .catch(() => setUsers([]))
      .finally(() => setLoading(false));
  }, [token, filter]);

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Users</h1>
        <p className="text-gray-500 text-sm mt-1">All registered users on the platform.</p>
      </div>

      {/* Filter */}
      <div className="flex gap-2 mb-6 flex-wrap">
        {[
          { label: "All", value: "" },
          { label: "Patients", value: "patient" },
          { label: "Doctors", value: "doctor" },
          { label: "Medical Centers", value: "medical_center" },
          { label: "Admins", value: "admin" },
        ].map((f) => (
          <button
            key={f.value}
            onClick={() => setFilter(f.value)}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition
              ${filter === f.value
                ? "bg-red-600 text-white shadow-sm"
                : "bg-white text-gray-600 border border-gray-200 hover:bg-gray-50"
              }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        {loading ? (
          <div className="p-10 text-center text-gray-400 text-sm">Loading...</div>
        ) : users.length === 0 ? (
          <div className="p-10 text-center text-gray-400 text-sm">No users found.</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="text-left px-5 py-3 text-gray-500 font-medium">Name</th>
                <th className="text-left px-5 py-3 text-gray-500 font-medium">Email</th>
                <th className="text-left px-5 py-3 text-gray-500 font-medium">Role</th>
                <th className="text-left px-5 py-3 text-gray-500 font-medium">Joined</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {users.map((u) => (
                <tr key={u.id} className="hover:bg-gray-50 transition">
                  <td className="px-5 py-4 font-medium text-gray-800">{u.name}</td>
                  <td className="px-5 py-4 text-gray-500">{u.email}</td>
                  <td className="px-5 py-4">
                    <span className={`px-2.5 py-1 rounded-full text-xs font-semibold capitalize ${roleBadge[u.role] || "bg-gray-100 text-gray-600"}`}>
                      {u.role?.replace("_", " ")}
                    </span>
                  </td>
                  <td className="px-5 py-4 text-gray-500">
                    {u.created_at ? new Date(u.created_at).toLocaleDateString() : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

export default Users;