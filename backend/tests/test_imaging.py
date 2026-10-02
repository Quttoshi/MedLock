import io
import uuid
import zipfile
from types import SimpleNamespace
from unittest.mock import MagicMock

import pydicom
import pytest
from fastapi import HTTPException
from PIL import Image
from pydicom.data import get_testdata_file
from pydicom.uid import generate_uid

from app.config import settings
from app.services import dicom_service, imaging_service
from app.services.encryption_service import encrypt_file

CT = get_testdata_file("CT_small.dcm")
MR = get_testdata_file("MR_small.dcm")


def _variant(path, series_uid=None, sop_uid=None, instance_number=None) -> bytes:
    """A copy of a sample file with new UIDs, to build multi-file / multi-series studies."""
    ds = pydicom.dcmread(path)
    ds.SOPInstanceUID = sop_uid or generate_uid()
    if series_uid:
        ds.SeriesInstanceUID = series_uid
    if instance_number is not None:
        ds.InstanceNumber = instance_number
    out = io.BytesIO()
    ds.save_as(out, enforce_file_format=True)
    return out.getvalue()


def _zip(files: dict) -> bytes:
    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, "w") as archive:
        for name, data in files.items():
            archive.writestr(name, data)
    return buffer.getvalue()


def _two_series_study() -> dict:
    series_a, series_b = generate_uid(), generate_uid()
    return {
        "study/a1.dcm": _variant(CT, series_a, instance_number=1),
        "study/a2.dcm": _variant(CT, series_a, instance_number=2),
        "study/b1.dcm": _variant(CT, series_b, instance_number=1),
        "study/notes.txt": b"not dicom",
    }


# ── Parsing and validation ────────────────────────────────────────────────────

class TestParseUpload:
    def test_single_dcm_file(self):
        parsed = dicom_service.parse_upload("scan.dcm", open(CT, "rb").read())
        assert len(parsed.instances) == 1
        assert parsed.study_uid

    def test_zip_study_skips_non_dicom_files(self):
        parsed = dicom_service.parse_upload("study.zip", _zip(_two_series_study()))
        assert len(parsed.instances) == 3
        assert parsed.skipped_files == 1

    def test_identical_files_are_counted_once(self):
        data = open(CT, "rb").read()
        parsed = dicom_service.parse_upload("study.zip", _zip({"a.dcm": data, "copy/a.dcm": data}))
        assert len(parsed.instances) == 1

    def test_non_dicom_file_is_rejected(self):
        with pytest.raises(HTTPException) as exc:
            dicom_service.parse_upload("scan.dcm", b"definitely not a dicom file")
        assert exc.value.status_code == 400

    def test_wrong_extension_is_rejected(self):
        with pytest.raises(HTTPException):
            dicom_service.parse_upload("report.pdf", open(CT, "rb").read())

    def test_zip_without_dicom_is_rejected(self):
        with pytest.raises(HTTPException, match=None) as exc:
            dicom_service.parse_upload("study.zip", _zip({"readme.txt": b"hello"}))
        assert "No valid DICOM" in exc.value.detail

    def test_damaged_zip_is_rejected(self):
        with pytest.raises(HTTPException) as exc:
            dicom_service.parse_upload("study.zip", b"PK\x03\x04 broken")
        assert "damaged" in exc.value.detail

    def test_unsafe_zip_paths_are_rejected(self):
        with pytest.raises(HTTPException) as exc:
            dicom_service.parse_upload("study.zip", _zip({"../../etc/evil.dcm": open(CT, "rb").read()}))
        assert "unsafe" in exc.value.detail

    def test_too_many_files_is_rejected(self, monkeypatch):
        monkeypatch.setattr(settings, "IMAGING_MAX_FILES", 2)
        with pytest.raises(HTTPException) as exc:
            dicom_service.parse_upload("study.zip", _zip(_two_series_study()))
        assert "more than 2 files" in exc.value.detail

    def test_zip_bomb_size_is_rejected(self, monkeypatch):
        monkeypatch.setattr(settings, "IMAGING_MAX_UNPACKED_MB", 0)
        with pytest.raises(HTTPException) as exc:
            dicom_service.parse_upload("study.zip", _zip(_two_series_study()))
        assert "unpacks to more than" in exc.value.detail

    def test_two_studies_in_one_upload_are_rejected(self):
        files = {"ct.dcm": open(CT, "rb").read(), "mr.dcm": open(MR, "rb").read()}
        with pytest.raises(HTTPException) as exc:
            dicom_service.parse_upload("study.zip", _zip(files))
        assert "more than one imaging study" in exc.value.detail


# ── Metadata, grouping, previews ──────────────────────────────────────────────

class TestMetadata:
    def test_study_metadata_from_ct(self):
        parsed = dicom_service.parse_upload("study.zip", _zip(_two_series_study()))
        meta = dicom_service.study_metadata(parsed)
        assert meta["modality"] == "CT"
        assert meta["series_count"] == 2
        assert meta["instance_count"] == 3
        assert meta["study_uid"] == parsed.study_uid

    def test_series_are_grouped_and_ordered(self):
        parsed = dicom_service.parse_upload("study.zip", _zip(_two_series_study()))
        groups = dicom_service.group_series(parsed.instances)
        sizes = sorted(len(g.instances) for g in groups)
        assert sizes == [1, 2]
        two = next(g for g in groups if len(g.instances) == 2)
        assert [int(i.header.InstanceNumber) for i in two.instances] == [1, 2]

    def test_mri_series_metadata(self):
        parsed = dicom_service.parse_upload("scan.dcm", open(MR, "rb").read())
        meta = dicom_service.series_metadata(dicom_service.group_series(parsed.instances)[0])
        assert meta["modality"] == "MR"
        assert meta["sequence_name"]
        assert meta["rows"] and meta["columns"]

    def test_ct_series_has_no_mri_fields(self):
        parsed = dicom_service.parse_upload("scan.dcm", open(CT, "rb").read())
        meta = dicom_service.series_metadata(dicom_service.group_series(parsed.instances)[0])
        assert meta["sequence_name"] is None and meta["echo_time_ms"] is None

    @pytest.mark.parametrize("path", [CT, MR])
    def test_preview_is_a_bounded_png(self, path):
        parsed = dicom_service.parse_upload("scan.dcm", open(path, "rb").read())
        png = dicom_service.render_preview(dicom_service.group_series(parsed.instances)[0])
        image = Image.open(io.BytesIO(png))
        assert image.format == "PNG"
        assert max(image.size) <= settings.IMAGING_PREVIEW_MAX_PX


class TestSlices:
    def test_every_image_becomes_a_jpeg_slice_in_scan_order(self):
        parsed = dicom_service.parse_upload("study.zip", _zip(_two_series_study()))
        group = next(g for g in dicom_service.group_series(parsed.instances) if len(g.instances) == 2)
        slices = dicom_service.render_slices(group)
        assert len(slices) == 2
        assert all(s[:3] == bytes([0xFF, 0xD8, 0xFF]) for s in slices)

    def test_slices_respect_size_limit(self):
        parsed = dicom_service.parse_upload("scan.dcm", open(MR, "rb").read())
        slices = dicom_service.render_slices(dicom_service.group_series(parsed.instances)[0])
        image = Image.open(io.BytesIO(slices[0]))
        assert max(image.size) <= settings.IMAGING_SLICE_MAX_PX

    def test_pack_slices_numbers_files_in_order(self):
        archive = zipfile.ZipFile(io.BytesIO(dicom_service.pack_slices([b"a", b"b", b"c"])))
        assert archive.namelist() == ["00001.jpg", "00002.jpg", "00003.jpg"]
        assert archive.read("00002.jpg") == b"b"


class TestPacking:
    def test_parts_reassemble_to_the_original(self, monkeypatch):
        monkeypatch.setattr(settings, "IMAGING_PART_MAX_MB", 0.002)  # ~2 KB parts
        data = bytes(range(256)) * 40
        parts = dicom_service.split_parts(data)
        assert len(parts) > 1
        assert b"".join(parts) == data

    def test_manifest_bytes_are_canonical(self):
        assert dicom_service.manifest_bytes({"b": 1, "a": [2]}) == dicom_service.manifest_bytes({"a": [2], "b": 1})


# ── Storage round trip and integrity (in-memory fake storage) ─────────────────

@pytest.fixture
def storage(monkeypatch):
    store = {}
    monkeypatch.setattr(imaging_service, "upload_file", lambda data, path, content_type=None: store.__setitem__(path, data))
    monkeypatch.setattr(imaging_service, "download_file", lambda path: store[path])
    monkeypatch.setattr(imaging_service, "delete_file", lambda path: store.pop(path, None))
    return store


@pytest.fixture
def stored_study(storage, monkeypatch):
    """A two-series study stored in small parts, plus its encrypted manifest."""
    monkeypatch.setattr(settings, "IMAGING_PART_MAX_MB", 0.002)
    files = _two_series_study()
    parsed = dicom_service.parse_upload("study.zip", _zip(files))
    report = SimpleNamespace(id=uuid.uuid4(), patient_id=uuid.uuid4(), report_type="imaging")
    report.file_url = imaging_service._storage_prefix(report.patient_id, report.id) + "manifest.enc"
    study = SimpleNamespace(id=uuid.uuid4(), series_count=0, instance_count=0)

    db = MagicMock()
    manifest = imaging_service._store_series(study, report, parsed, [], db)
    series_rows = [call.args[0] for call in db.add.call_args_list]  # the ImagingSeries records created
    encrypted, report.encryption_key_ref = encrypt_file(dicom_service.manifest_bytes(manifest))
    storage[report.file_url] = encrypted
    originals = {i.sop_uid: i.data for i in parsed.instances}
    return SimpleNamespace(
        report=report, study=study, manifest=manifest, originals=originals, storage=storage, series=series_rows,
    )


class TestStorageRoundTrip:
    def test_every_stored_object_is_encrypted(self, stored_study):
        for path, data in stored_study.storage.items():
            assert b"DICM" not in data, f"{path} looks unencrypted"

    def test_series_are_split_into_multiple_parts(self, stored_study):
        assert any(len(s["parts"]) > 1 for s in stored_study.manifest["series"])
        assert stored_study.study.series_count == 2
        assert stored_study.study.instance_count == 3

    def test_download_rebuilds_the_original_files(self, stored_study):
        archive = zipfile.ZipFile(io.BytesIO(imaging_service.build_study_archive(stored_study.report)))
        rebuilt = {name.split("/")[-1][:-4]: archive.read(name) for name in archive.namelist()}
        assert rebuilt == stored_study.originals

    def test_integrity_check_passes_for_untouched_study(self, stored_study):
        check = imaging_service.check_stored_parts(stored_study.report)
        assert check["passed"] is True
        assert "All 3 image files" in check["label"]

    def test_integrity_check_catches_a_modified_part(self, stored_study):
        part_path = stored_study.manifest["series"][0]["parts"][0]["path"]
        tampered = bytearray(stored_study.storage[part_path])
        tampered[-1] ^= 0xFF
        stored_study.storage[part_path] = bytes(tampered)
        check = imaging_service.check_stored_parts(stored_study.report)
        assert check["passed"] is False

    def test_delete_removes_every_stored_object(self, stored_study):
        stored_study.report.imaging_study = SimpleNamespace(series=stored_study.series, staging_path=None)
        imaging_service.delete_study_files(stored_study.report)
        assert stored_study.storage == {}

    def test_viewer_slices_are_stored_and_readable(self, stored_study):
        by_size = sorted(stored_study.series, key=lambda s: s.instance_count)
        for row in by_size:
            assert row.slice_count == row.instance_count  # one slice per single-frame image
            stack = zipfile.ZipFile(io.BytesIO(imaging_service.read_slice_stack(row)))
            names = stack.namelist()
            assert names == sorted(names) and len(names) == row.slice_count
            assert stack.read(names[0])[:3] == bytes([0xFF, 0xD8, 0xFF])  # JPEG

    def test_tampered_slice_stack_is_refused(self, stored_study):
        row = stored_study.series[0]
        path = row.slice_stack_parts[0]["path"]
        data = bytearray(stored_study.storage[path])
        data[-1] ^= 0xFF
        stored_study.storage[path] = bytes(data)
        with pytest.raises(ValueError):
            imaging_service.read_slice_stack(row)


# ── Failure handling ──────────────────────────────────────────────────────────

class TestProcessingFailure:
    def _study(self, attempts):
        report = SimpleNamespace(
            original_filename="ct.zip", medical_center=None, patient=SimpleNamespace(user_id=uuid.uuid4()),
        )
        return SimpleNamespace(
            processing_attempts=attempts, processing_status="processing", processing_error=None,
            staging_path=None, medical_report=report,
        )

    def _fail(self, study, monkeypatch, exc=RuntimeError("storage down")):
        notify = MagicMock()
        monkeypatch.setattr(imaging_service, "create_notification", notify)
        db = MagicMock()
        db.query.return_value.filter.return_value.first.return_value = study
        imaging_service._handle_failure(uuid.uuid4(), exc, [], db)
        return notify

    def test_transient_failure_is_retried(self, monkeypatch):
        study = self._study(attempts=1)
        notify = self._fail(study, monkeypatch)
        assert study.processing_status == "pending"
        notify.assert_not_called()

    def test_failure_after_max_attempts_notifies_uploader(self, monkeypatch):
        study = self._study(attempts=settings.IMAGING_MAX_PROCESSING_ATTEMPTS)
        notify = self._fail(study, monkeypatch)
        assert study.processing_status == "failed"
        assert notify.call_args.args[2] == "imaging_processing_failed"

    def test_invalid_upload_is_not_retried(self, monkeypatch):
        study = self._study(attempts=1)
        self._fail(study, monkeypatch, exc=HTTPException(status_code=400, detail="bad"))
        assert study.processing_status == "failed"


class TestUploadLimits:
    def test_oversized_upload_is_rejected(self, monkeypatch):
        monkeypatch.setattr(settings, "IMAGING_MAX_UPLOAD_MB", 0)
        upload = SimpleNamespace(file=io.BytesIO(b"x" * 10), filename="ct.dcm")
        with pytest.raises(HTTPException) as exc:
            imaging_service._read_limited(upload)
        assert "must not exceed" in exc.value.detail
