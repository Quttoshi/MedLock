import { useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import api from "../../api/axios";
import PasswordInput from "../../components/PasswordInput";
import AuthShell from "../../components/shell/AuthShell";
import { AlertCircle, ArrowLeft } from "lucide-react";

const ROLE_ENDPOINTS = {
  patient: "/auth/register",
  doctor: "/auth/register/doctor",
  medical_center: "/auth/register/medical-center",
};

function Field({ label, name, type = "text", placeholder, value, onChange, error, optional }) {
  const Input = type === "password" ? PasswordInput : "input";
  const id = `f-${name}`;
  return (
    <div>
      <label htmlFor={id} className="field-label">
        {label}
        {optional && <span className="ml-1.5 font-normal text-muted">(optional)</span>}
      </label>
      <Input
        id={id}
        type={type}
        name={name}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        aria-invalid={error ? "true" : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        className="field"
      />
      {error && <p id={`${id}-error`} className="field-error">{error}</p>}
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
      const res = await api.post(ROLE_ENDPOINTS[role], payload);
      navigate("/login", {
        state: {
          registered: true,
          verifyEmail: res.data.email_verification_required,
          email: payload.email,
        },
      });
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
    <AuthShell>
      <h1 className="display text-[40px] leading-tight text-ink">Create your account</h1>
      <p className="mt-2 text-sm text-muted">
        Registering as <span className="font-bold text-ink">{ROLE_LABELS[role]}</span>
      </p>

      {serverError && (
        <div role="alert" className="mt-6 flex items-start gap-2.5 rounded-xl bg-bad-subtle p-3.5 text-sm font-semibold text-bad-ink">
          <AlertCircle aria-hidden="true" size={18} className="mt-0.5 flex-shrink-0" />
          {serverError}
        </div>
      )}

      <form onSubmit={handleSubmit} noValidate className="mt-6 space-y-5">
        <Field
          label={role === "medical_center" ? "Center or hospital name" : "Full name"}
          name="name"
          placeholder={role === "medical_center" ? "City General Hospital" : "Muhammad Ali"}
          value={formData.name}
          onChange={handleChange}
          error={errors.name}
        />
        <Field label="Email" name="email" type="email" placeholder="you@example.com" value={formData.email} onChange={handleChange} error={errors.email} />

        {/* Patient extra fields */}
        {role === "patient" && (
          <>
            <div>
              <label htmlFor="f-date_of_birth" className="field-label">
                Date of birth <span className="ml-1.5 font-normal text-muted">(optional)</span>
              </label>
              <input
                id="f-date_of_birth"
                type="date"
                name="date_of_birth"
                value={formData.date_of_birth}
                onChange={handleChange}
                max={new Date().toISOString().split("T")[0]}
                className="field"
              />
            </div>

            <div>
              <label htmlFor="f-gender" className="field-label">
                Gender <span className="ml-1.5 font-normal text-muted">(optional)</span>
              </label>
              <select id="f-gender" name="gender" value={formData.gender} onChange={handleChange} className="field">
                <option value="">Select gender</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="other">Other</option>
              </select>
            </div>

            <div>
              <label htmlFor="f-blood_group" className="field-label">
                Blood group <span className="ml-1.5 font-normal text-muted">(optional)</span>
              </label>
              <select id="f-blood_group" name="blood_group" value={formData.blood_group} onChange={handleChange} className="field">
                <option value="">Select blood group</option>
                {["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"].map((g) => (
                  <option key={g} value={g}>{g}</option>
                ))}
              </select>
            </div>

            <fieldset className="card-inset space-y-5 p-4">
              <legend className="px-1 text-sm font-bold text-ink">
                Emergency contact <span className="ml-1.5 font-normal text-muted">(optional)</span>
              </legend>
              <Field
                label="Contact name"
                name="emergency_contact_name"
                placeholder="e.g. Ahmed Ali"
                value={formData.emergency_contact_name}
                onChange={handleChange}
                error={errors.emergency_contact_name}
              />
              <Field
                label="Contact phone"
                name="emergency_contact_phone"
                placeholder="e.g. +92 300 1234567"
                value={formData.emergency_contact_phone}
                onChange={handleChange}
                error={errors.emergency_contact_phone}
              />
            </fieldset>
          </>
        )}

        {/* Doctor extra fields */}
        {role === "doctor" && (
          <>
            <Field label="Specialization" name="specialization" placeholder="e.g. Cardiology" value={formData.specialization} onChange={handleChange} error={errors.specialization} />
            <Field label="Medical license number" name="license_number" placeholder="PKM-12345" value={formData.license_number} onChange={handleChange} error={errors.license_number} />
          </>
        )}

        {/* Medical Center extra fields */}
        {role === "medical_center" && (
          <>
            <Field label="License number" name="license_number" placeholder="MC-98765" value={formData.license_number} onChange={handleChange} error={errors.license_number} />
            <Field label="Address" name="address" placeholder="123 Main St, Karachi" value={formData.address} onChange={handleChange} error={errors.address} />
          </>
        )}

        <div>
          <Field label="Password" name="password" type="password" placeholder="" value={formData.password} onChange={handleChange} error={errors.password} />
          <p className="field-hint">At least 8 characters, with one uppercase letter and one number.</p>
        </div>

        <Field label="Confirm password" name="confirmPassword" type="password" placeholder="" value={formData.confirmPassword} onChange={handleChange} error={errors.confirmPassword} />

        <button type="submit" disabled={loading} className="btn btn-primary btn-lg w-full">
          {loading ? "Creating account..." : "Create account"}
        </button>
      </form>

      <div className="mt-6 flex flex-col items-center gap-3 text-sm text-muted">
        <p>
          Already have an account?{" "}
          <Link to="/login" className="link">Sign in</Link>
        </p>
        <button type="button" onClick={() => navigate("/register")} className="link inline-flex items-center gap-1.5 no-underline hover:underline">
          <ArrowLeft aria-hidden="true" size={16} />
          Choose a different role
        </button>
      </div>
    </AuthShell>
  );
}

export default RegisterPage;
