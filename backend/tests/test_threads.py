import operator
import uuid
from datetime import datetime, timedelta

import pytest
from fastapi import HTTPException

from app.models.access_request import AccessRequest
from app.models.doctor import Doctor
from app.models.medical_report import MedicalReport
from app.models.patient import Patient
from app.models.report_thread import ReportThread, ReportThreadMessage
from app.models.user import User
from app.services import thread_service as ts


# ── A tiny in-memory session ──────────────────────────────────────────────────

class FakeQuery:
    def __init__(self, items):
        self.items = list(items)

    def filter(self, *clauses):
        for clause in clauses:
            # Only the equality filters thread_service uses (column == value).
            if clause.operator is operator.eq:
                key, value = clause.left.key, clause.right.value
                self.items = [i for i in self.items if getattr(i, key, None) == value]
        return self

    def order_by(self, *_):
        return self

    def options(self, *_):
        return self

    def first(self):
        return self.items[0] if self.items else None

    def all(self):
        return self.items


class FakeDB:
    def __init__(self, tables):
        self.tables = {model: list(rows) for model, rows in tables.items()}

    def query(self, model):
        return FakeQuery(self.tables.get(model, []))

    def add(self, obj):
        if isinstance(obj, ReportThread):
            self.tables.setdefault(ReportThread, []).append(obj)
        if isinstance(obj, ReportThreadMessage):
            thread = next(t for t in self.tables[ReportThread] if t.id == obj.thread_id)
            thread.messages.append(obj)

    def commit(self):
        pass


# ── The world: one patient, a report, two doctors ─────────────────────────────

def _user(name, role):
    return User(id=uuid.uuid4(), full_name=name, role=role, email=f"{uuid.uuid4().hex}@example.com")


def _doctor(name, verified=True):
    user = _user(name, "doctor")
    doctor = Doctor(id=uuid.uuid4(), user_id=user.id, specialization="Cardiology",
                    license_number=uuid.uuid4().hex, is_verified=verified)
    doctor.user = user
    return doctor


@pytest.fixture
def world(monkeypatch):
    patient_user = _user("Ayesha Khan", "patient")
    patient = Patient(id=uuid.uuid4(), user_id=patient_user.id)
    patient.user = patient_user
    report = MedicalReport(id=uuid.uuid4(), patient_id=patient.id, original_filename="CBC report.pdf",
                           report_type="blood_test", is_approved=True)
    report.patient = patient
    ahmed, sara = _doctor("Ahmed"), _doctor("Sara")
    grants = [AccessRequest(id=uuid.uuid4(), doctor_id=d.id, patient_id=patient.id, status="approved") for d in (ahmed, sara)]
    for grant, doctor in zip(grants, (ahmed, sara)):
        grant.doctor = doctor

    # Revoking or re-approving a doctor's access changes their grant, as the access
    # request endpoints do.
    by_doctor = {g.doctor_id: g for g in grants}

    class Access:
        def discard(self, doctor_id):
            by_doctor[doctor_id].status = "revoked"

        def add(self, doctor_id):
            by_doctor[doctor_id].status = "approved"

    access = Access()
    notifications, audit = [], []
    monkeypatch.setattr(
        ts, "create_notification",
        lambda db, recipient_id, notification_type, message, link=None, send_email=True: notifications.append(
            {"user_id": recipient_id, "kind": notification_type, "message": message, "link": link, "email": send_email}),
    )
    monkeypatch.setattr(ts, "log_action", lambda db, **kw: audit.append(kw["action"]))

    db = FakeDB({Patient: [patient], Doctor: [ahmed, sara], MedicalReport: [report], AccessRequest: grants, ReportThread: []})

    class World:
        pass
    w = World()
    w.db, w.report, w.patient, w.ahmed, w.sara = db, report, patient, ahmed, sara
    w.access, w.notifications, w.audit = access, notifications, audit
    w.as_patient = ts.Viewer(patient_user, "patient", patient)
    w.as_ahmed = ts.Viewer(ahmed.user, "doctor", ahmed)
    w.as_sara = ts.Viewer(sara.user, "doctor", sara)
    return w


def _patient_asks(w, doctor=None, body="Is my hemoglobin low?"):
    doctor = doctor or w.ahmed
    return ts.start_thread(w.report.id, w.as_patient, body, str(doctor.id), w.db)


def _thread(w, doctor):
    return next(t for t in w.db.tables[ReportThread] if t.doctor_id == doctor.id)


# ── Who can see and post ──────────────────────────────────────────────────────

class TestStarting:
    def test_patient_can_ask_a_doctor_with_access(self, world):
        summary = _patient_asks(world)
        thread = _thread(world, world.ahmed)
        assert summary["doctor"]["name"] == "Ahmed"
        assert len(thread.messages) == 1
        # Stored encrypted, read back as text
        assert b"hemoglobin" not in thread.messages[0].body_encrypted
        assert ts.get_messages(thread.id, world.as_patient, world.db)["messages"][0]["body"] == "Is my hemoglobin low?"
        assert world.audit == ["thread_started"]

    def test_patient_cannot_ask_a_doctor_without_access(self, world):
        world.access.discard(world.ahmed.id)
        with pytest.raises(HTTPException) as exc:
            _patient_asks(world)
        assert exc.value.status_code == 403

    def test_patient_cannot_ask_an_unverified_doctor(self, world):
        world.ahmed.is_verified = False
        with pytest.raises(HTTPException) as exc:
            _patient_asks(world)
        assert exc.value.status_code == 403

    def test_unapproved_upload_cannot_be_discussed(self, world):
        world.report.is_approved = False
        with pytest.raises(HTTPException) as exc:
            _patient_asks(world)
        assert exc.value.status_code == 400

    def test_doctor_with_access_can_ask_the_patient(self, world):
        ts.start_thread(world.report.id, world.as_ahmed, "Any chest pain lately?", None, world.db)
        note = world.notifications[-1]
        assert note["user_id"] == world.patient.user.id
        assert note["kind"] == "report_question"
        assert note["link"] == f"/patient/reports/{world.report.id}#questions"

    def test_doctor_without_access_and_no_thread_sees_nothing(self, world):
        world.access.discard(world.ahmed.id)
        with pytest.raises(HTTPException) as exc:
            ts.list_threads(world.report.id, world.as_ahmed, world.db)
        assert exc.value.status_code == 404
        with pytest.raises(HTTPException):
            ts.start_thread(world.report.id, world.as_ahmed, "Hello", None, world.db)

    def test_asking_again_adds_to_the_same_thread(self, world):
        _patient_asks(world)
        _patient_asks(world, body="Also, what about my platelets?")
        assert len(world.db.tables[ReportThread]) == 1
        assert len(_thread(world, world.ahmed).messages) == 2

    def test_medical_centers_cannot_use_threads(self, world):
        with pytest.raises(HTTPException) as exc:
            ts.get_viewer(_user("City Hospital", "medical_center"), world.db)
        assert exc.value.status_code == 403


class TestVisibility:
    def test_patient_sees_every_thread_and_who_they_can_ask(self, world):
        _patient_asks(world, world.ahmed)
        _patient_asks(world, world.sara)
        world.sara.is_verified = False
        result = ts.list_threads(world.report.id, world.as_patient, world.db)
        assert {t["doctor"]["name"] for t in result["threads"]} == {"Ahmed", "Sara"}
        assert [d["name"] for d in result["askable_doctors"]] == ["Ahmed"]
        assert result["askable_doctors"][0]["has_thread"] is True

    def test_doctor_sees_only_their_own_thread(self, world):
        _patient_asks(world, world.ahmed)
        _patient_asks(world, world.sara)
        mine = ts.list_threads(world.report.id, world.as_sara, world.db)["threads"]
        assert [t["doctor"]["name"] for t in mine] == ["Sara"]
        with pytest.raises(HTTPException) as exc:
            ts.get_messages(_thread(world, world.ahmed).id, world.as_sara, world.db)
        assert exc.value.status_code == 404


class TestReadOnly:
    def test_revoked_access_makes_the_thread_read_only_for_both(self, world):
        _patient_asks(world)
        thread = _thread(world, world.ahmed)
        world.access.discard(world.ahmed.id)
        for viewer in (world.as_patient, world.as_ahmed):
            with pytest.raises(HTTPException) as exc:
                ts.post_message(thread.id, viewer, "Hello?", world.db)
            assert exc.value.status_code == 403
        assert ts.list_threads(world.report.id, world.as_patient, world.db)["threads"][0]["can_post"] is False

    def test_doctor_keeps_reading_their_thread_after_access_ends(self, world):
        _patient_asks(world)
        world.access.discard(world.ahmed.id)
        result = ts.list_threads(world.report.id, world.as_ahmed, world.db)
        assert result["can_start"] is False
        assert result["threads"][0]["can_post"] is False
        messages = ts.get_messages(_thread(world, world.ahmed).id, world.as_ahmed, world.db)["messages"]
        assert messages[0]["body"] == "Is my hemoglobin low?"

    def test_regranted_access_reopens_posting(self, world):
        _patient_asks(world)
        thread = _thread(world, world.ahmed)
        world.access.discard(world.ahmed.id)
        world.access.add(world.ahmed.id)
        ts.post_message(thread.id, world.as_ahmed, "It is slightly low.", world.db)
        assert len(thread.messages) == 2

    def test_lapsed_verification_makes_the_thread_read_only(self, world):
        _patient_asks(world)
        world.ahmed.is_verified = False
        with pytest.raises(HTTPException) as exc:
            ts.post_message(_thread(world, world.ahmed).id, world.as_patient, "Hello?", world.db)
        assert exc.value.status_code == 403


class TestMessages:
    def test_message_length_limit(self, world):
        _patient_asks(world, body="x" * ts.MAX_MESSAGE_LENGTH)
        with pytest.raises(HTTPException) as exc:
            _patient_asks(world, body="x" * (ts.MAX_MESSAGE_LENGTH + 1))
        assert exc.value.status_code == 400

    def test_empty_message_is_refused(self, world):
        with pytest.raises(HTTPException) as exc:
            _patient_asks(world, body="   ")
        assert exc.value.status_code == 400

    def test_resolve_and_reopen(self, world):
        _patient_asks(world)
        thread = _thread(world, world.ahmed)
        assert ts.set_resolved(thread.id, world.as_ahmed, True, world.db)["status"] == "resolved"
        assert thread.resolved_by_user_id == world.ahmed.user.id
        assert ts.set_resolved(thread.id, world.as_patient, False, world.db)["status"] == "open"
        assert world.audit[-2:] == ["thread_resolved", "thread_reopened"]

    def test_new_message_reopens_a_resolved_thread(self, world):
        _patient_asks(world)
        thread = _thread(world, world.ahmed)
        ts.set_resolved(thread.id, world.as_ahmed, True, world.db)
        ts.post_message(thread.id, world.as_patient, "One more question", world.db)
        assert thread.status == "open"
        assert thread.resolved_at is None
        assert world.audit[-1] == "thread_reopened"


class TestUnread:
    def test_unread_counts_follow_reading(self, world):
        _patient_asks(world)
        report_id = str(world.report.id)
        assert ts.unread_counts(world.as_ahmed, world.db) == {report_id: 1}
        assert ts.unread_counts(world.as_patient, world.db) == {}
        ts.get_messages(_thread(world, world.ahmed).id, world.as_ahmed, world.db)
        assert ts.unread_counts(world.as_ahmed, world.db) == {}


class TestNotifications:
    def test_notifications_never_contain_the_message(self, world):
        _patient_asks(world, body="Secret worry about my hemoglobin")
        thread = _thread(world, world.ahmed)
        ts.post_message(thread.id, world.as_ahmed, "Private advice about iron", world.db)
        texts = [n["message"] for n in world.notifications]
        assert texts == ["Ayesha Khan asked you a question about CBC report.pdf.", "Dr. Ahmed replied about CBC report.pdf."]
        assert all("hemoglobin" not in t and "iron" not in t for t in texts)
        assert world.notifications[0]["link"] == f"/doctor/patients/{world.patient.id}/reports/{world.report.id}/view#questions"
        assert world.notifications[1]["kind"] == "report_reply"

    def test_at_most_one_email_per_side_per_thread_a_day(self, world):
        _patient_asks(world)
        thread = _thread(world, world.ahmed)
        ts.post_message(thread.id, world.as_patient, "Follow-up", world.db)
        assert [n["email"] for n in world.notifications] == [True, False]
        thread.doctor_last_emailed_at = datetime.utcnow() - timedelta(hours=25)
        ts.post_message(thread.id, world.as_patient, "Another day", world.db)
        assert world.notifications[-1]["email"] is True

    def test_notification_waits_until_after_the_response(self, world):
        from fastapi import BackgroundTasks
        background = BackgroundTasks()
        ts.start_thread(world.report.id, world.as_patient, "Hello", str(world.ahmed.id), world.db, background=background)
        assert world.notifications == []
        assert len(background.tasks) == 2  # the audit entry and the doctor's notification

    def test_send_returns_the_new_message(self, world):
        result = _patient_asks(world, body="Is this normal?")
        assert result["message"]["body"] == "Is this normal?"
        assert result["message"]["is_mine"] is True


class TestExpiry:
    def test_expired_access_counts_as_no_access(self, world):
        _patient_asks(world)
        grant = next(g for g in world.db.tables[AccessRequest] if g.doctor_id == world.ahmed.id)
        grant.expires_at = datetime.utcnow() - timedelta(minutes=1)
        with pytest.raises(HTTPException) as exc:
            ts.post_message(_thread(world, world.ahmed).id, world.as_patient, "Hello?", world.db)
        assert exc.value.status_code == 403
