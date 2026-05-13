import { useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import api from "../../api/axios";

const ROLE_ENDPOINTS = {
  patient: "/auth/register",
  doctor: "/auth/register/doctor",
  medical_center: "/auth/register/medical-center",
};

function Field({ label, name, type = "text", placeholder, value, onChange, error }) {
  return (
    <div className="mb-4">
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      <input
        type={type}
        name={name}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className={`w-full px-4 py-2.5 border rounded-lg text-sm
                    focus:outline-none focus:ring-2 focus:ring-blue-500 transition
                    ${error ? "border-red-400 bg-red-50" : "border-gray-300 bg-white"}`}
      />
      {error && <p className="text-red-500 text-xs mt-1">{error}</p>}
    </div>
  );
}

const ROLE_LABELS = {
  patient: "Patient",
  doctor: "Doctor",
  medical_center: "Hospital / Clinic",
};

function RegisterPage() {
  const navigate = useNavigate();
  const { role } = useParams();

  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
    specialization: "",
    license_number: "",
    address: "",
    date_of_birth: "",
    blood_group: "",
    gender: "",
    emergency_contact_name: "",
    emergency_contact_phone: "",
  });

  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState("");
  const [loading, setLoading] = useState(false);

  // ── Validation ──────────────────────────────────────
  const validate = () => {
    const e = {};

    if (!formData.name.trim()) e.name = "Full name is required.";
    else if (formData.name.trim().length < 2) e.name = "Name must be at least 2 characters.";

    if (!formData.email.trim()) e.email = "Email is required.";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) e.email = "Enter a valid email address.";

    if (!formData.password) e.password = "Password is required.";
    else if (formData.password.length < 8) e.password = "Password must be at least 8 characters.";
    else if (!/(?=.*[A-Z])(?=.*[0-9])/.test(formData.password))
      e.password = "Password must contain at least one uppercase letter and one number.";

    if (!formData.confirmPassword) e.confirmPassword = "Please confirm your password.";
    else if (formData.password !== formData.confirmPassword) e.confirmPassword = "Passwords do not match.";

    if (role === "doctor") {
      if (!formData.specialization.trim()) e.specialization = "Specialization is required.";
      if (!formData.license_number.trim()) e.license_number = "License number is required.";
    }

    if (role === "medical_center") {
      if (!formData.license_number.trim()) e.license_number = "License number is required.";
      if (!formData.address.trim()) e.address = "Address is required.";
    }

    return e;
  };

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    setErrors({ ...errors, [e.target.name]: "" });
    setServerError("");
  };

  // ── Handle Submit ────────────────────────────────────
  const handleSubmit = async (e) => {
    e.preventDefault();
    const validationErrors = validate();
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    const payload = { name: formData.name, email: formData.email, password: formData.password };
    if (role === "patient") {
      if (formData.date_of_birth) payload.date_of_birth = formData.date_of_birth;
      if (formData.blood_group) payload.blood_group = formData.blood_group;
      if (formData.gender) payload.gender = formData.gender;
      if (formData.emergency_contact_name) payload.emergency_contact_name = formData.emergency_contact_name;
      if (formData.emergency_contact_phone) payload.emergency_contact_phone = formData.emergency_contact_phone;
    }
    if (role === "doctor") {
      payload.specialization = formData.specialization;
      payload.license_number = formData.license_number;
    }
    if (role === "medical_center") {
      payload.center_name = formData.name;
      payload.license_number = formData.license_number;
      payload.address = formData.address;
    }

    setLoading(true);
    try {
      await api.post(ROLE_ENDPOINTS[role], payload);
      navigate("/login", { state: { registered: true } });
    } catch (err) {
      if (err.response?.status === 409 || err.response?.status === 400) {
        const detail = err.response?.data?.detail;
        setServerError(detail || "An account with this email already exists. Please log in.");
      } else {
        setServerError("Registration failed. Please try again later.");
      }
    } finally {
      setLoading(false);
    }
  };

  // ── Render ───────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100
                    flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-lg p-8">

        {/* Logo + Title */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16
                          bg-blue-600 rounded-2xl mb-4">
            <span className="text-white text-2xl font-bold">M</span>
          </div>
          <h1 className="text-3xl font-bold text-gray-800">MedLock</h1>
          <p className="text-gray-500 mt-1 text-sm">Registering as <span className="font-semibold text-blue-600">{ROLE_LABELS[role]}</span></p>
        </div>

        {/* Server Error Banner */}
        {serverError && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">
            {serverError}
          </div>
        )}

        <form onSubmit={handleSubmit} noValidate>

          <Field
            label={role === "medical_center" ? "Center / Hospital Name" : "Full Name"}
            name="name"
            placeholder={role === "medical_center" ? "City General Hospital" : "Muhammad Ali"}
            value={formData.name}
            onChange={handleChange}
            error={errors.name}
          />
          <Field label="Email Address" name="email" type="email" placeholder="you@example.com" value={formData.email} onChange={handleChange} error={errors.email} />

          {/* Patient extra fields */}
          {role === "patient" && (
            <>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">Date of Birth <span className="text-gray-400 font-normal">(optional)</span></label>
                <input
                  type="date"
                  name="date_of_birth"
                  value={formData.date_of_birth}
                  onChange={handleChange}
                  max={new Date().toISOString().split("T")[0]}
                  className="w-full px-4 py-2.5 border border-gray-300 bg-white rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
                />
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">Gender <span className="text-gray-400 font-normal">(optional)</span></label>
                <select
                  name="gender"
                  value={formData.gender}
                  onChange={handleChange}
                  className="w-full px-4 py-2.5 border border-gray-300 bg-white rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition text-gray-700"
                >
                  <option value="">Select gender</option>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                  <option value="other">Other</option>
                </select>
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">Blood Group <span className="text-gray-400 font-normal">(optional)</span></label>
                <select
                  name="blood_group"
                  value={formData.blood_group}
                  onChange={handleChange}
                  className="w-full px-4 py-2.5 border border-gray-300 bg-white rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition text-gray-700"
                >
                  <option value="">Select blood group</option>
                  {["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"].map((g) => (
                    <option key={g} value={g}>{g}</option>
                  ))}
                </select>
              </div>

              <div className="mb-1">
                <p className="text-sm font-medium text-gray-700 mb-2">Emergency Contact <span className="text-gray-400 font-normal">(optional)</span></p>
                <Field
                  label="Contact Name"
                  name="emergency_contact_name"
                  placeholder="e.g. Ahmed Ali"
                  value={formData.emergency_contact_name}
                  onChange={handleChange}
                  error={errors.emergency_contact_name}
                />
                <Field
                  label="Contact Phone"
                  name="emergency_contact_phone"
                  placeholder="e.g. +92 300 1234567"
                  value={formData.emergency_contact_phone}
                  onChange={handleChange}
                  error={errors.emergency_contact_phone}
                />
              </div>
            </>
          )}

          {/* Doctor extra fields */}
          {role === "doctor" && (
            <>
              <Field label="Specialization" name="specialization" placeholder="e.g. Cardiology" value={formData.specialization} onChange={handleChange} error={errors.specialization} />
              <Field label="Medical License Number" name="license_number" placeholder="PKM-12345" value={formData.license_number} onChange={handleChange} error={errors.license_number} />
            </>
          )}

          {/* Medical Center extra fields */}
          {role === "medical_center" && (
            <>
              <Field label="License Number" name="license_number" placeholder="MC-98765" value={formData.license_number} onChange={handleChange} error={errors.license_number} />
              <Field label="Address" name="address" placeholder="123 Main St, Karachi" value={formData.address} onChange={handleChange} error={errors.address} />
            </>
          )}

          <Field label="Password" name="password" type="password" placeholder="Min 8 chars, 1 uppercase, 1 number" value={formData.password} onChange={handleChange} error={errors.password} />

          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Confirm Password
            </label>
            <input
              type="password"
              name="confirmPassword"
              value={formData.confirmPassword}
              onChange={handleChange}
              placeholder="••••••••"
              className={`w-full px-4 py-2.5 border rounded-lg text-sm
                          focus:outline-none focus:ring-2 focus:ring-blue-500 transition
                          ${errors.confirmPassword ? "border-red-400 bg-red-50" : "border-gray-300 bg-white"}`}
            />
            {errors.confirmPassword && (
              <p className="text-red-500 text-xs mt-1">{errors.confirmPassword}</p>
            )}
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white
                       font-semibold py-2.5 rounded-lg transition
                       disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin h-4 w-4 text-white"
                  xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10"
                    stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                </svg>
                Creating account...
              </span>
            ) : "Create Account"}
          </button>
        </form>

        <div className="flex flex-col items-center gap-2 mt-6">
          <p className="text-center text-sm text-gray-500">
            Already have an account?{" "}
            <Link to="/login" className="text-blue-600 hover:underline font-medium">
              Sign in here
            </Link>
          </p>
          <button
            onClick={() => navigate("/register")}
            className="text-sm text-gray-400 hover:text-gray-600 hover:underline"
          >
            ← Choose a different role
          </button>
        </div>
      </div>
    </div>
  );
}

export default RegisterPage;
