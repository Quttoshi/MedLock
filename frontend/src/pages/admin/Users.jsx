import { useEffect, useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { getAdminUsers } from "../../api/admin";
import FilterChips from "../../components/ui/FilterChips";

const ROLE_FILTERS = [
  { label: "All", value: "" },
  { label: "Patients", value: "patient" },
  { label: "Doctors", value: "doctor" },
  { label: "Medical centers", value: "medical_center" },
  { label: "Admins", value: "admin" },
];

const roleTone = {
  patient: "pill-brand",
  doctor: "pill-ok",
  medical_center: "pill-warn",
  admin: "pill-plain",
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
    <div className="mx-auto max-w-6xl">
      <h1 className="display text-[28px] leading-[1.15] text-ink sm:text-[32px]">
        All <em>users</em>
      </h1>
      <p className="mt-3 text-sm text-muted">Every registered account on the platform.</p>

      <div className="mt-8">
        <FilterChips label="Filter by role" options={ROLE_FILTERS} value={filter} onChange={setFilter} />
      </div>

      {loading ? (
        <p className="mt-10 text-center text-muted">Loading...</p>
      ) : users.length === 0 ? (
        <div className="card card-pad mt-6 text-center text-sm text-muted">No users found.</div>
      ) : (
        <div className="card mt-6 overflow-x-auto">
          <table className="w-full text-sm">
            <caption className="sr-only">Registered users</caption>
            <thead className="!bg-inset">
              <tr>
                {["Name", "Email", "Role", "Joined"].map((h) => (
                  <th key={h} scope="col" className="px-5 py-3 text-left text-[13px] font-bold !text-muted">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {users.map((u) => (
                <tr key={u.id}>
                  <td className="px-5 py-4 font-bold text-ink">{u.name}</td>
                  <td className="px-5 py-4 text-ink-soft">{u.email}</td>
                  <td className="px-5 py-4">
                    <span className={`pill capitalize ${roleTone[u.role] || "pill-plain"}`}>
                      {u.role?.replace("_", " ")}
                    </span>
                  </td>
                  <td className="px-5 py-4 text-ink-soft">
                    {u.created_at ? new Date(u.created_at).toLocaleDateString() : "-"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default Users;
