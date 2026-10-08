import re
from pathlib import Path

from app.routers.admin import AUDIT_CATEGORIES

APP = Path(__file__).resolve().parents[1] / "app"
SOURCE = "\n".join(p.read_text(encoding="utf-8") for p in APP.rglob("*.py"))
CATEGORISED = {a for actions in AUDIT_CATEGORIES.values() for a in actions}


def _logged_actions() -> set:
    """Action names passed to log_action: action="x", action="x" if ... else "y",
    and the action argument of thread_service._log_status."""
    names = set(re.findall(r'action="([a-z_]+)"', SOURCE))
    for first, second in re.findall(r'action="([a-z_]+)" if [^"]+ else "([a-z_]+)"', SOURCE):
        names |= {first, second}
    names |= set(re.findall(r'"(thread_[a-z]+ed)"', SOURCE))
    return names


def test_every_logged_action_belongs_to_a_filter_category():
    missing = _logged_actions() - CATEGORISED
    assert not missing, f"Audit actions with no filter category: {sorted(missing)}"


def test_categories_only_name_actions_that_exist():
    unknown = {a for a in CATEGORISED if f'"{a}"' not in SOURCE.replace(f'"{a}",', "", 1)}
    assert not unknown, f"Categories name actions that are never logged: {sorted(unknown)}"
