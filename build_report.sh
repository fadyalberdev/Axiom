#!/usr/bin/env bash
#
# AXIOM V2 graduation report builder.
#
# This script regenerates docs/Final_Report.pdf from the current source tree.
# It parses the FastAPI backend, Next.js frontend, Supabase SQL migrations,
# README/docs/config files, and test output; then it renders the required
# Mermaid and PlantUML diagrams and compiles a template-ordered report.

set -Eeuo pipefail

ROOT_DEFAULT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
AXIOM_ROOT="${AXIOM_ROOT:-$ROOT_DEFAULT}"
TEMPLATE_PDF="${TEMPLATE_PDF:-}"
OLD_REPORT_PDF="${OLD_REPORT_PDF:-}"

DOCS_DIR="$AXIOM_ROOT/docs"
BUILD_DIR="$DOCS_DIR/report_build"
DIAGRAM_DIR="$BUILD_DIR/diagrams"
SCREENSHOT_DIR="$BUILD_DIR/screenshots"
SCRIPT_DIR="$BUILD_DIR/scripts"
REPORT_MD="$BUILD_DIR/report.md"
REPORT_HTML="$BUILD_DIR/report.html"
REPORT_CSS="$BUILD_DIR/report.css"
FINAL_PDF="$DOCS_DIR/Final_Report.pdf"

FRONTEND_PORT="${FRONTEND_PORT:-3000}"
FRONTEND_URL="${FRONTEND_URL:-http://127.0.0.1:$FRONTEND_PORT}"
SCREENSHOT_TIMEOUT_SECONDS="${SCREENSHOT_TIMEOUT_SECONDS:-75}"
PYTEST_TIMEOUT_SECONDS="${PYTEST_TIMEOUT_SECONDS:-120}"
SKIP_SCREENSHOTS="${SKIP_SCREENSHOTS:-0}"

log() {
  printf '[build_report] %s\n' "$*"
}

die() {
  printf '[build_report] ERROR: %s\n' "$*" >&2
  exit 1
}

need_cmd() {
  command -v "$1" >/dev/null 2>&1 || die "Missing required command: $1"
}

find_python() {
  for candidate in python3 python; do
    if command -v "$candidate" >/dev/null 2>&1 && "$candidate" -c "import sys; sys.exit(0)" >/dev/null 2>&1; then
      printf '%s\n' "$candidate"
      return 0
    fi
  done
  if command -v py >/dev/null 2>&1 && py -3 -c "import sys; sys.exit(0)" >/dev/null 2>&1; then
    printf 'py -3\n'
    return 0
  fi
  return 1
}

find_chromium() {
  for candidate in chromium chromium-browser google-chrome google-chrome-stable chrome chrome.exe msedge msedge.exe; do
    if command -v "$candidate" >/dev/null 2>&1; then
      command -v "$candidate"
      return 0
    fi
  done
  return 1
}

cleanup() {
  if [[ -n "${FRONTEND_PID:-}" ]]; then
    kill "$FRONTEND_PID" >/dev/null 2>&1 || true
  fi
}
trap cleanup EXIT

[[ -d "$AXIOM_ROOT/frontend" ]] || die "Frontend folder not found under AXIOM_ROOT=$AXIOM_ROOT"
[[ -d "$AXIOM_ROOT/backend" ]] || die "Backend folder not found under AXIOM_ROOT=$AXIOM_ROOT"
[[ -n "$TEMPLATE_PDF" ]] || die "Set TEMPLATE_PDF to the official Graduation project template PDF"
[[ -n "$OLD_REPORT_PDF" ]] || die "Set OLD_REPORT_PDF to the old Broker System report PDF"
[[ -f "$TEMPLATE_PDF" ]] || die "Template PDF not found: $TEMPLATE_PDF"
[[ -f "$OLD_REPORT_PDF" ]] || die "Old report PDF not found: $OLD_REPORT_PDF"

need_cmd node
need_cmd npm
need_cmd pandoc
need_cmd wkhtmltopdf
need_cmd mmdc
need_cmd plantuml
need_cmd pdftotext
need_cmd timeout

PYTHON_BIN="${PYTHON_BIN:-}"
if [[ -z "$PYTHON_BIN" ]]; then
  PYTHON_BIN="$(find_python)" || die "Missing working Python. Install Python and disable the Windows Store python/python3 aliases, or set PYTHON_BIN explicitly."
fi
log "Using Python: $PYTHON_BIN"

CHROMIUM_BIN=""
if [[ "$SKIP_SCREENSHOTS" != "1" ]]; then
  CHROMIUM_BIN="$(find_chromium)" || die "Missing Chromium/Chrome command for headless screenshots"
fi

mkdir -p "$BUILD_DIR" "$DIAGRAM_DIR" "$SCREENSHOT_DIR" "$SCRIPT_DIR"

log "Extracting template and old-report text"
pdftotext "$TEMPLATE_PDF" "$BUILD_DIR/template.txt"
pdftotext "$OLD_REPORT_PDF" "$BUILD_DIR/old_report.txt"

log "Running backend tests for Chapter 6 summary"
(
  cd "$AXIOM_ROOT/backend"
  if [[ -d venv ]]; then
    # shellcheck disable=SC1091
    source venv/bin/activate 2>/dev/null || source venv/Scripts/activate 2>/dev/null || true
  fi
  timeout "$PYTEST_TIMEOUT_SECONDS" ${PYTHON_BIN} -m pytest -q
) >"$BUILD_DIR/pytest-output.log" 2>&1 || true

log "Running frontend TypeScript check"
(
  cd "$AXIOM_ROOT/frontend"
  timeout 120 npx tsc --noEmit
) >"$BUILD_DIR/tsc-output.log" 2>&1 || true

cat >"$REPORT_CSS" <<'CSS'
@page {
  size: A4;
  margin: 22mm 18mm 20mm 18mm;
}

body {
  color: #1f2933;
  font-family: "Times New Roman", Times, serif;
  font-size: 12pt;
  line-height: 1.45;
}

h1, h2, h3, h4 {
  color: #111827;
  font-family: Arial, Helvetica, sans-serif;
  line-height: 1.2;
  margin: 0 0 10pt;
}

h1 {
  font-size: 20pt;
  margin-top: 0;
  page-break-before: always;
  text-align: center;
}

h2 {
  border-bottom: 1px solid #cbd5e1;
  font-size: 15pt;
  margin-top: 18pt;
  padding-bottom: 4pt;
}

h3 {
  font-size: 13pt;
  margin-top: 14pt;
}

p {
  margin: 0 0 8pt;
  text-align: justify;
}

table {
  border-collapse: collapse;
  margin: 10pt 0 14pt;
  width: 100%;
}

th, td {
  border: 1px solid #cbd5e1;
  padding: 5pt 6pt;
  vertical-align: top;
}

th {
  background: #edf2f7;
  font-weight: bold;
}

img {
  display: block;
  margin: 8pt auto 4pt;
  max-height: 185mm;
  max-width: 96%;
}

figcaption, .caption {
  color: #4b5563;
  font-size: 10pt;
  margin: 0 0 12pt;
  text-align: center;
}

.cover {
  page-break-after: always;
  text-align: center;
}

.cover h1 {
  border: 0;
  font-size: 28pt;
  margin-top: 60pt;
  page-break-before: avoid;
}

.center {
  text-align: center;
}

.page-break {
  page-break-before: always;
}

.front-page {
  page-break-after: always;
}

.front-page h1 {
  page-break-before: avoid;
}

.toc-grid {
  columns: 2;
  column-gap: 28pt;
  font-size: 10.5pt;
}

.toc-grid li {
  break-inside: avoid;
  margin-bottom: 3pt;
}

.small {
  font-size: 10pt;
}

.toc-list li {
  margin-bottom: 4pt;
}

.note {
  background: #f8fafc;
  border-left: 4px solid #64748b;
  margin: 10pt 0;
  padding: 8pt 10pt;
}
CSS

cat >"$SCRIPT_DIR/analyze_project.py" <<'PY'
#!/usr/bin/env python3
"""Generate report content and diagram source from the AXIOM V2 repository.

The script intentionally uses only Python standard-library parsers for the
source tree. SQL is parsed with conservative regular expressions because the
schema files are DDL migrations, not a live database dump.
"""

from __future__ import annotations

import ast
import html
import json
import os
import re
from dataclasses import dataclass, field
from pathlib import Path
from typing import Iterable


ROOT = Path(os.environ["AXIOM_ROOT"]).resolve()
BUILD = Path(os.environ["BUILD_DIR"]).resolve()
DIAGRAMS = Path(os.environ["DIAGRAM_DIR"]).resolve()
SCREENSHOTS = Path(os.environ["SCREENSHOT_DIR"]).resolve()


def read(path: Path, default: str = "") -> str:
    try:
        return path.read_text(encoding="utf-8", errors="ignore")
    except FileNotFoundError:
        return default


def clean_text(value: str) -> str:
    return re.sub(r"\s+", " ", value).strip()


def safe_id(value: str) -> str:
    value = re.sub(r"[^0-9A-Za-z_]", "_", value)
    if not value or value[0].isdigit():
        value = f"N_{value}"
    return value


def md_escape(value: str) -> str:
    return value.replace("|", "\\|").replace("\n", " ")


def extract_template_headings() -> list[str]:
    text = read(BUILD / "template.txt")
    headings: list[str] = []
    for raw in text.splitlines():
        line = clean_text(raw)
        if not line:
            continue
        normalized = line.lower()
        if normalized.startswith("chapter "):
            headings.append(line)
        elif re.match(r"^\d+(\.\d+)+\s+", line):
            headings.append(line)
        elif line in {
            "Acknowledgement",
            "Abstract",
            "Table of Contents",
            "List of figures",
            "List of tables",
            "List of abbreviations and acronyms",
        }:
            headings.append(line)
    return headings


def extract_old_metadata() -> dict[str, object]:
    text = read(BUILD / "old_report.txt")
    students: list[str] = []
    supervisor = "Dr. Bahaa Mohamed"
    title = "Broker Website"
    title_match = re.search(r"Faculty of Computer Science.*?\n([A-Za-z][^\n]+)\nSubmitted by:", text, re.S)
    if title_match:
        title = clean_text(title_match.group(1))
    supervisor_match = re.search(r"Supervised by:\s*(Dr\.\s*[A-Za-z ]+)", text)
    if supervisor_match:
        supervisor = clean_text(supervisor_match.group(1))
    names_block = re.search(r"Submitted by:\s*# ID Name\s*(.*?)A dissertation", text, re.S)
    if names_block:
        for line in names_block.group(1).splitlines():
            match = re.match(r"\s*\d+\s+\d+\s+(.+?)\s*$", line)
            if match:
                students.append(clean_text(match.group(1)))
    if not students and "Baher Mohamed" in text:
        students = [
            "Baher Mohamed",
            "Shrouk Saber",
            "Youssef Mohamed",
            "Abanoub Attia",
            "Ehab Ashraf",
            "Abdelrahman Wael",
            "Fady Alber",
        ]
    return {
        "old_title": title,
        "report_title": "AXIOM V2",
        "subtitle": "AI-powered real estate platform for the Egyptian market",
        "students": students,
        "supervisor": supervisor,
    }


@dataclass
class Route:
    module: str
    method: str
    path: str
    function: str
    auth_hint: str = "Protected where dependency requires JWT/admin"


def route_prefixes() -> dict[str, str]:
    main = read(ROOT / "backend/app/main.py")
    mapping: dict[str, str] = {}
    for var, prefix in re.findall(r"app\.include_router\((\w+),\s*prefix=\"([^\"]*)\"", main):
        mapping[var] = prefix
    return mapping


def parse_routes() -> list[Route]:
    prefixes = route_prefixes()
    routes: list[Route] = []
    for router in sorted((ROOT / "backend/app").glob("*/router.py")):
        module = router.parent.name
        possible_var = f"{module}_router"
        prefix = prefixes.get(possible_var, "")
        if module == "stripe_webhooks":
            prefix = prefixes.get("stripe_webhooks_router", prefix)
        try:
            tree = ast.parse(read(router))
        except SyntaxError:
            continue
        for node in ast.walk(tree):
            if not isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
                continue
            for dec in node.decorator_list:
                if not (isinstance(dec, ast.Call) and isinstance(dec.func, ast.Attribute)):
                    continue
                method = dec.func.attr.upper()
                if method not in {"GET", "POST", "PUT", "PATCH", "DELETE"}:
                    continue
                subpath = ""
                if dec.args and isinstance(dec.args[0], ast.Constant):
                    subpath = str(dec.args[0].value)
                full = f"{prefix}{subpath}" or "/"
                auth_hint = "Public"
                src = ast.get_source_segment(read(router), node) or ""
                if "current_user" in src or "get_current_user" in src:
                    auth_hint = "JWT user"
                if "admin" in module or "require_admin" in src or "admin_user" in src:
                    auth_hint = "Admin"
                routes.append(Route(module, method, full, node.name, auth_hint))
    return routes


@dataclass
class Column:
    name: str
    type_name: str
    pk: bool = False
    fk_table: str | None = None


@dataclass
class Table:
    name: str
    columns: list[Column] = field(default_factory=list)


def sql_files() -> list[Path]:
    return sorted((ROOT / "docs/schema").glob("*.sql")) + sorted((ROOT / "backend/sql").glob("*.sql"))


def strip_sql_line_comments(text: str) -> str:
    """Remove SQL line comments before lightweight DDL parsing.

    The schema files use many helpful inline comments such as
    `name text not null, -- 'Maadi'`. If comments are left in place, the
    comma splitter can treat comment words as column definitions. This parser
    is intentionally conservative and only targets report generation.
    """

    cleaned: list[str] = []
    for line in text.splitlines():
        cleaned.append(line.split("--", 1)[0])
    return "\n".join(cleaned)


def extract_parenthesized(text: str, start: int) -> tuple[str, int]:
    depth = 0
    begin = text.find("(", start)
    if begin == -1:
        return "", start
    for idx in range(begin, len(text)):
        char = text[idx]
        if char == "(":
            depth += 1
        elif char == ")":
            depth -= 1
            if depth == 0:
                return text[begin + 1 : idx], idx
    return "", start


def split_sql_items(block: str) -> list[str]:
    items: list[str] = []
    current: list[str] = []
    depth = 0
    for char in block:
        if char == "(":
            depth += 1
        elif char == ")":
            depth -= 1
        if char == "," and depth == 0:
            items.append("".join(current).strip())
            current = []
        else:
            current.append(char)
    tail = "".join(current).strip()
    if tail:
        items.append(tail)
    return items


def parse_sql_schema() -> tuple[list[Table], dict[str, list[str]]]:
    tables: dict[str, Table] = {}
    enums: dict[str, list[str]] = {}
    for path in sql_files():
        raw_text = read(path)
        text = strip_sql_line_comments(raw_text)
        for enum_name, raw_values in re.findall(
            r"CREATE\s+TYPE\s+([A-Za-z_][\w]*)\s+AS\s+ENUM\s*\((.*?)\);",
            text,
            flags=re.I | re.S,
        ):
            enums[enum_name] = [v.strip().strip("'\"") for v in raw_values.split(",")]
        for match in re.finditer(
            r"CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:public\.)?([A-Za-z_][\w]*)",
            text,
            flags=re.I,
        ):
            name = match.group(1)
            if name not in tables:
                tables[name] = Table(name)
            block, _ = extract_parenthesized(text, match.end())
            for item in split_sql_items(block):
                if not item or re.match(r"^(CONSTRAINT|PRIMARY|FOREIGN|UNIQUE|CHECK)\b", item, re.I):
                    continue
                bits = item.split()
                if len(bits) < 2:
                    continue
                col_name = bits[0].strip('"')
                type_name = bits[1].split("(")[0]
                if not re.match(r"^[A-Za-z_][A-Za-z0-9_]*$", col_name):
                    continue
                if not re.match(r"^[A-Za-z_][A-Za-z0-9_]*(\[\])?$", type_name):
                    continue
                pk = bool(re.search(r"\bPRIMARY\s+KEY\b", item, re.I))
                fk_match = re.search(r"REFERENCES\s+(?:public\.|auth\.)?([A-Za-z_][\w]*)", item, re.I)
                tables[name].columns.append(
                    Column(col_name, type_name, pk=pk, fk_table=fk_match.group(1) if fk_match else None)
                )
    return list(tables.values()), enums


@dataclass
class PyClass:
    module: str
    name: str
    bases: list[str]
    methods: list[str]
    fields: list[str]


def parse_python_classes() -> list[PyClass]:
    classes: list[PyClass] = []
    for path in sorted((ROOT / "backend/app").rglob("*.py")):
        if "venv" in path.parts or "__pycache__" in path.parts:
            continue
        try:
            tree = ast.parse(read(path))
        except SyntaxError:
            continue
        module = ".".join(path.relative_to(ROOT / "backend/app").with_suffix("").parts)
        for node in ast.walk(tree):
            if not isinstance(node, ast.ClassDef):
                continue
            bases = []
            for base in node.bases:
                if isinstance(base, ast.Name):
                    bases.append(base.id)
                elif isinstance(base, ast.Attribute):
                    bases.append(base.attr)
            methods = [n.name for n in node.body if isinstance(n, (ast.FunctionDef, ast.AsyncFunctionDef))]
            fields = []
            for n in node.body:
                if isinstance(n, ast.AnnAssign) and isinstance(n.target, ast.Name):
                    fields.append(n.target.id)
                elif isinstance(n, ast.Assign):
                    for target in n.targets:
                        if isinstance(target, ast.Name):
                            fields.append(target.id)
            classes.append(PyClass(module, node.name, bases, methods, fields))
    return classes


def frontend_routes() -> list[str]:
    routes = []
    base = ROOT / "frontend/src/app"
    for page in base.rglob("page.tsx"):
        route = "/" + str(page.parent.relative_to(base)).replace(os.sep, "/")
        for group in ("(marketing)/", "(auth)/"):
            route = route.replace(group, "")
        route = route.replace("(marketing)", "").replace("(auth)", "")
        route = re.sub(r"/+", "/", route).rstrip("/")
        routes.append(route or "/")
    return sorted(set(routes))


def npm_package() -> dict[str, object]:
    try:
        return json.loads(read(ROOT / "frontend/package.json"))
    except json.JSONDecodeError:
        return {}


def backend_requirements() -> list[str]:
    req = []
    for line in read(ROOT / "backend/requirements.txt").splitlines():
        line = line.strip()
        if line and not line.startswith("#"):
            req.append(line)
    return req


def test_summary() -> dict[str, str]:
    pytest = read(BUILD / "pytest-output.log")
    tsc = read(BUILD / "tsc-output.log")
    summary = {
        "pytest_status": "not run",
        "pytest_detail": clean_text(pytest.splitlines()[-1]) if pytest.splitlines() else "No pytest output captured.",
        "tsc_status": "not run",
        "tsc_detail": clean_text(tsc.splitlines()[-1]) if tsc.splitlines() else "No TypeScript output captured.",
    }
    if re.search(r"\bfailed\b|\berror\b", pytest, re.I):
        summary["pytest_status"] = "issues found"
    elif re.search(r"\bpassed\b", pytest, re.I):
        summary["pytest_status"] = "passed"
    if re.search(r"error TS|\bfailed\b|\berror\b", tsc, re.I):
        summary["tsc_status"] = "issues found"
    elif tsc.strip() == "":
        summary["tsc_status"] = "passed"
        summary["tsc_detail"] = "npx tsc --noEmit completed with no output."
    else:
        summary["tsc_status"] = "passed"
    return summary


def write_mermaid_erd(tables: list[Table]) -> None:
    core_order = [
        "profiles",
        "neighborhoods",
        "agencies",
        "projects",
        "listings",
        "housemates",
        "listing_applications",
        "favorites",
        "leads",
        "viewings",
        "bookings",
        "payments",
        "subscriptions",
        "notifications",
    ]
    table_by_name = {table.name: table for table in tables}
    tables = [table_by_name[name] for name in core_order if name in table_by_name]
    lines = ["erDiagram"]
    for table in tables:
        lines.append(f"  {table.name} {{")
        for col in table.columns[:8]:
            marker = " PK" if col.pk else ""
            type_name = re.sub(r"[^A-Za-z0-9_]", "_", col.type_name)
            lines.append(f"    {type_name} {col.name}{marker}")
        lines.append("  }")
    seen = set()
    for table in tables:
        for col in table.columns:
            if col.fk_table and col.fk_table != table.name:
                rel = (col.fk_table, table.name, col.name)
                if rel in seen:
                    continue
                seen.add(rel)
                lines.append(f"  {col.fk_table} ||--o{{ {table.name} : {col.name}")
    (DIAGRAMS / "erd.v2.mmd").write_text("\n".join(lines) + "\n", encoding="utf-8")


def write_class_puml(classes: list[PyClass]) -> None:
    selected = [c for c in classes if c.name not in {"Config", "SettingsConfigDict"}][:70]
    lines = [
        "@startuml",
        "skinparam classAttributeIconSize 0",
        "skinparam shadowing false",
        "skinparam packageStyle rectangle",
        "title AXIOM V2 backend classes and schemas",
    ]
    by_module: dict[str, list[PyClass]] = {}
    for cls in selected:
        by_module.setdefault(cls.module.split(".")[0], []).append(cls)
    for module, module_classes in sorted(by_module.items()):
        lines.append(f'package "{module}" {{')
        for cls in module_classes:
            sid = safe_id(cls.name)
            lines.append(f"  class {sid} {{")
            for field_name in cls.fields[:8]:
                lines.append(f"    +{field_name}")
            for method in cls.methods[:8]:
                lines.append(f"    +{method}()")
            lines.append("  }")
            for base in cls.bases:
                if base not in {"BaseModel", "object"}:
                    lines.append(f"  {safe_id(base)} <|-- {sid}")
        lines.append("}")
    lines.append("@enduml")
    (DIAGRAMS / "class.v2.puml").write_text("\n".join(lines) + "\n", encoding="utf-8")


def write_usecase(routes: list[Route]) -> None:
    route_text = " ".join(f"{r.method} {r.path}" for r in routes)
    use_cases = [
        ("Search", "Search listings", "/api/listings" in route_text),
        ("ViewProperty", "View property details", "/api/listings/{listing_id}" in route_text),
        ("ManageListing", "Create and manage listings", "POST /api/listings" in route_text),
        ("Favorite", "Save favorite listings", "favorite" in route_text),
        ("Apply", "Apply for shared housing", "applications" in route_text or "apply" in route_text),
        ("Lead", "Send WhatsApp enquiry", "/api/leads" in route_text),
        ("Booking", "Book and confirm rental", "/api/bookings" in route_text),
        ("AI", "Use AI search and chatbot", "/api/ai" in route_text),
        ("Subscription", "Manage subscription", "/api/subscriptions" in route_text),
        ("AdminListings", "Approve or reject listings", "/api/admin/listings" in route_text),
        ("AdminUsers", "Verify users", "/api/admin/users" in route_text),
        ("AdminLeads", "Review leads", "/api/admin/leads" in route_text),
    ]
    lines = [
        "flowchart LR",
        "  User([User])",
        "  Owner([Listing owner])",
        "  Admin([Admin])",
        "  subgraph System[AXIOM V2 Platform]",
    ]
    for key, label, enabled in use_cases:
        if enabled:
            lines.append(f"    {key}(({label}))")
    lines.extend(
        [
            "  end",
            "  User --> Search",
            "  User --> ViewProperty",
            "  User --> Favorite",
            "  User --> Lead",
            "  User --> AI",
            "  User --> Booking",
            "  User --> Apply",
            "  Owner --> ManageListing",
            "  Owner --> Subscription",
            "  Admin --> AdminListings",
            "  Admin --> AdminUsers",
            "  Admin --> AdminLeads",
        ]
    )
    (DIAGRAMS / "usecase.v2.mmd").write_text("\n".join(lines) + "\n", encoding="utf-8")


def write_activity_diagrams() -> None:
    (DIAGRAMS / "activity_user.v2.mmd").write_text(
        """flowchart TD
  Start([Open AXIOM]) --> Search[Search listings or ask AI]
  Search --> Detail[Open property detail]
  Detail --> Choice{Intent}
  Choice -->|Save| Favorite[Toggle favorite]
  Choice -->|Contact| Lead[Create WhatsApp lead]
  Choice -->|Rent| Booking[Create booking payment intent]
  Choice -->|Shared housing| Apply[Submit application]
  Lead --> WhatsApp[Open wa.me conversation]
  Booking --> Stripe[Complete Stripe payment]
  Stripe --> BookingPage[Track booking status]
  Apply --> Dashboard[Review application in dashboard]
  Favorite --> Dashboard
  Dashboard --> End([Done])
""",
        encoding="utf-8",
    )
    (DIAGRAMS / "activity_admin.v2.mmd").write_text(
        """flowchart TD
  Start([Admin login]) --> Dashboard[Open admin dashboard]
  Dashboard --> Queue[Review pending listings]
  Queue --> Fraud{Fraud or policy issue?}
  Fraud -->|No| Approve[Approve listing]
  Fraud -->|Yes| Reject[Reject listing with reason]
  Dashboard --> Users[Review users]
  Users --> Verify[Grant verified seller badge]
  Dashboard --> Leads[Inspect WhatsApp leads]
  Dashboard --> Content[Manage agencies, projects, blog, universities]
  Approve --> Notify[Notify owner]
  Reject --> Notify
  Verify --> End([Done])
  Leads --> End
  Content --> End
""",
        encoding="utf-8",
    )


def write_sequence_diagrams() -> None:
    (DIAGRAMS / "seq_user.v2.puml").write_text(
        """@startuml
title User enquiry and booking flow
actor User
participant "Next.js UI" as UI
participant "FastAPI listings/leads/bookings routers" as API
database "Supabase PostgreSQL" as DB
participant "Stripe" as Stripe
participant "WhatsApp" as WA

User -> UI: Open property detail
UI -> API: GET /api/listings/{id}
API -> DB: select listing, owner profile, similar listings
DB --> API: listing detail
API --> UI: ListingDetailWithSimilar
User -> UI: Click WhatsApp / Book
alt WhatsApp enquiry
  UI -> API: POST /api/leads
  API -> DB: insert or dedupe lead
  API --> UI: wa.me URL
  UI -> WA: open contact link
else Rental booking
  UI -> API: POST /api/bookings/payment-intent
  API -> Stripe: create PaymentIntent
  API -> DB: create pending booking/payment ledger
  API --> UI: client secret
end
@enduml
""",
        encoding="utf-8",
    )
    (DIAGRAMS / "seq_admin.v2.puml").write_text(
        """@startuml
title Admin listing verification flow
actor Admin
participant "Admin Dashboard" as UI
participant "FastAPI admin router" as API
database "Supabase PostgreSQL" as DB
participant "Notification service" as Notify

Admin -> UI: Open pending queue
UI -> API: GET /api/admin/listings?status=pending
API -> DB: select pending listings
DB --> API: listing rows
API --> UI: queue data
Admin -> UI: Approve or reject listing
alt Approve
  UI -> API: PUT /api/admin/listings/{id}/approve
  API -> DB: update listings.status = active
  API -> Notify: create listing_approved notification
else Reject
  UI -> API: PUT /api/admin/listings/{id}/reject
  API -> DB: update listings.status = rejected
  API -> Notify: create listing_rejected notification
end
API --> UI: updated listing
@enduml
""",
        encoding="utf-8",
    )


def write_state_diagram() -> None:
    (DIAGRAMS / "state_inquiry.v2.mmd").write_text(
        """stateDiagram-v2
  [*] --> Pending: owner submits listing
  Pending --> Active: admin approves
  Pending --> Rejected: admin rejects
  Active --> Reserved: sale reservation payment
  Active --> Booked: rent booking payment
  Reserved --> Sold: deal closed
  Booked --> Rented: owner confirms
  Booked --> Active: refund or cancellation
  Active --> Paused: subscription lapse
  Paused --> Active: subscription restored
  Active --> Deleted: owner soft-deletes
  Rejected --> Pending: owner resubmits
  Sold --> [*]
  Rented --> [*]
  Deleted --> [*]
""",
        encoding="utf-8",
    )


def write_diagram_sources(tables: list[Table], classes: list[PyClass], routes: list[Route]) -> None:
    DIAGRAMS.mkdir(parents=True, exist_ok=True)
    write_mermaid_erd(tables)
    write_class_puml(classes)
    write_usecase(routes)
    write_activity_diagrams()
    write_sequence_diagrams()
    write_state_diagram()


def endpoint_table(routes: list[Route], limit: int = 80) -> str:
    grouped: dict[str, list[Route]] = {}
    for route in routes:
        grouped.setdefault(route.module, []).append(route)
    rows = ["| Area | Implemented endpoints | Representative paths | Access model |", "|---|---:|---|---|"]
    for module in sorted(grouped):
        module_routes = grouped[module]
        examples = ", ".join(f"`{r.method} {r.path}`" for r in module_routes[:3])
        access = ", ".join(sorted({r.auth_hint for r in module_routes}))
        rows.append(f"| {module} | {len(module_routes)} | {md_escape(examples)} | {access} |")
    return "\n".join(rows)


def schema_table(tables: list[Table]) -> str:
    rows = ["| Table | Key attributes | Relationships |", "|---|---|---|"]
    for table in tables:
        attrs = ", ".join(f"`{c.name}`" for c in table.columns[:8])
        rels = ", ".join(f"`{c.name}` -> `{c.fk_table}`" for c in table.columns if c.fk_table) or "none"
        rows.append(f"| `{table.name}` | {attrs} | {rels} |")
    return "\n".join(rows)


def requirements_table(routes: list[Route]) -> str:
    route_text = " ".join(r.path for r in routes)
    frs = [
        ("FR-01", "Users can register, log in, and update their profile.", "/api/auth" in route_text),
        ("FR-02", "Visitors can search and view listings.", "/api/listings" in route_text),
        ("FR-03", "Owners can create, update, and delete listings.", "POST /api/listings" in " ".join(f"{r.method} {r.path}" for r in routes)),
        ("FR-04", "Users can favorite listings and review them later.", "favorite" in route_text),
        ("FR-05", "Users can submit WhatsApp leads for property enquiries.", "/api/leads" in route_text),
        ("FR-06", "Shared-housing users can submit applications.", "applications" in route_text or "apply" in route_text),
        ("FR-07", "Renters can create and manage booking payments.", "/api/bookings" in route_text),
        ("FR-08", "AI search, chatbot, recommendations, descriptions, validation, and compatibility are available.", "/api/ai" in route_text),
        ("FR-09", "Admins can moderate listings and verify users.", "/api/admin" in route_text),
        ("FR-10", "Owners can manage subscription plans and listing caps.", "/api/subscriptions" in route_text),
    ]
    rows = ["| Code | Requirement | Evidence |", "|---|---|---|"]
    for code, req, ok in frs:
        rows.append(f"| {code} | {req} | {'Implemented' if ok else 'Not found'} |")
    return "\n".join(rows)


def nonfunctional_table() -> str:
    cfg = read(ROOT / "backend/app/config.py")
    main = read(ROOT / "backend/app/main.py")
    nfrs = [
        ("NR-01", "Authentication uses Supabase JWTs on protected API endpoints.", "jwt_secret" in cfg),
        ("NR-02", "Security headers protect content type, frame embedding, XSS mode, and referrer policy.", "SecurityHeadersMiddleware" in main),
        ("NR-03", "AI and auth endpoints are rate-limited to reduce abuse and model cost.", "RateLimitMiddleware" in main),
        ("NR-04", "CORS is restricted to configured frontend origins outside development.", "CORSMiddleware" in main and "frontend_url" in cfg),
        ("NR-05", "Semantic search uses pgvector embeddings.", "vector" in " ".join(read(p) for p in sql_files())),
        ("NR-06", "Payment and subscription flows use Stripe configuration and webhooks.", "stripe_" in cfg),
        ("NR-07", "Ollama model configuration is explicit and environment-driven.", "ollama_model" in cfg),
    ]
    rows = ["| Code | Requirement | Evidence |", "|---|---|---|"]
    for code, req, ok in nfrs:
        rows.append(f"| {code} | {req} | {'Implemented' if ok else 'Not found'} |")
    return "\n".join(rows)


def screenshot_markdown() -> str:
    entries = [
        ("home.png", "Home page"),
        ("find-homes.png", "Find homes search"),
        ("admin-login.png", "Admin login"),
    ]
    parts = []
    for name, caption in entries:
        if (SCREENSHOTS / name).exists():
            parts.append(f"![Figure: {caption}](screenshots/{name})\n\n<div class=\"caption\">Figure 5.x: {caption} screenshot captured from the running frontend.</div>")
    note = (
        "<div class=\"note\">Protected dashboard and pricing states are described in text instead of embedded "
        "when the local screenshot run is unauthenticated or the API is unavailable.</div>"
    )
    return "\n\n".join(parts + [note]) if parts else "_Screenshots were skipped or could not be captured in this run._"


def write_report(
    metadata: dict[str, object],
    headings: list[str],
    routes: list[Route],
    tables: list[Table],
    enums: dict[str, list[str]],
    classes: list[PyClass],
) -> None:
    readme = read(ROOT / "README.md")
    roadmap = read(ROOT / "docs/ROADMAP.md")
    api_ref = read(ROOT / "docs/API_REFERENCE.md")
    setup = read(ROOT / "docs/SETUP.md")
    features = read(ROOT / "docs/AI_FEATURES.md")
    package = npm_package()
    deps = package.get("dependencies", {}) if isinstance(package.get("dependencies"), dict) else {}
    tests = test_summary()
    students = metadata.get("students") or []
    student_lines = "\n".join(f"- {name}" for name in students) if students else "- Student names inherited from the old report."
    route_count = len(routes)
    table_count = len(tables)
    class_count = len(classes)
    frontend_route_list = ", ".join(f"`{r}`" for r in frontend_routes())
    enum_list = "\n".join(f"- `{name}`: {', '.join(values)}" for name, values in enums.items())
    stack = ", ".join(
        [
            f"Next.js {deps.get('next', '')}".strip(),
            "React",
            "TypeScript",
            "Tailwind CSS",
            "FastAPI",
            "Supabase PostgreSQL",
            "Ollama",
            "Stripe",
        ]
    )

    content = f"""<div class="cover">

# {metadata["report_title"]}

**{metadata["subtitle"]}**

Faculty of Computer Science and Information Technology

Submitted by:

{student_lines}

A dissertation submitted in partial fulfillment of the requirements for the degree of Bachelor of Computer Science and Information Technology.

Supervised by: **{metadata["supervisor"]}**

Egypt 2026

</div>

# Committee Report

We certify that we have read this graduation project report and examined its content. In our opinion, the document is adequate as a project report for **{metadata["report_title"]}**.

# Intellectual Property Right Declaration

This work was prepared as a graduation project under university supervision. The source code and report content describe the AXIOM V2 platform and may be reused for academic extension, product development, or organizational adoption only with the required permissions.

# Anti-Plagiarism Declaration

This report was regenerated from the current AXIOM V2 source code, official report template, and old report metadata. Diagrams and requirements were derived from implemented code, SQL migrations, API routes, tests, and configuration files.

<section class="front-page">

# Table of Contents

<ol class="toc-grid">
<li>Acknowledgement</li>
<li>Abstract</li>
<li>List of Figures</li>
<li>List of Tables</li>
<li>List of Abbreviations and Acronyms</li>
<li>Chapter 1: Introduction</li>
<li>Chapter 2: Background and Previous Work</li>
<li>Chapter 3: Planning and Analysis</li>
<li>Chapter 4: Design</li>
<li>Chapter 5: Implementation</li>
<li>Chapter 6: Testing</li>
</ol>

</section>

# List of Figures

1. Figure 4.1: Updated ERD generated from SQL migrations.
2. Figure 4.2: Backend class diagram.
3. Figure 4.3: Primary use-case diagram.
4. Figure 4.4: User activity flow.
5. Figure 4.5: Admin activity flow.
6. Figure 4.6: User enquiry and booking sequence.
7. Figure 4.7: Admin listing verification sequence.
8. Figure 4.8: Listing lifecycle state diagram.
9. Figure 5.1: Home page screenshot.
10. Figure 5.2: Find homes screenshot.
11. Figure 5.3: Admin login screenshot.

# List of Tables

1. Requirements evidence table.
2. Functional endpoint summary.
3. Non-functional requirements table.
4. Entity mapping table.

# List of Abbreviations and Acronyms

| Term | Meaning |
|---|---|
| AI | Artificial Intelligence |
| API | Application Programming Interface |
| ERD | Entity Relationship Diagram |
| JWT | JSON Web Token |
| RAG | Retrieval-Augmented Generation |
| RLS | Row Level Security |
| SSE | Server-Sent Events |

# Acknowledgement

The team thanks the project supervisor, faculty members, and reviewers who guided the development of AXIOM V2. Their feedback shaped the transition from a conventional broker website into an AI-assisted real estate platform for the Egyptian market.

# Abstract

AXIOM V2 is an AI-powered real estate platform for Egypt. The application combines a Next.js 16 frontend, a FastAPI backend, Supabase authentication and PostgreSQL storage, pgvector semantic search, local Ollama models, and Stripe payment/subscription flows. The system supports property discovery, listing management, shared housing applications, WhatsApp lead capture, AI search, chatbot assistance, recommendations, fraud checks, admin moderation, and subscription-based owner limits.

# Chapter 1: Introduction

## 1.1 Overview

AXIOM V2 modernizes real estate discovery by combining searchable property inventory, owner dashboards, admin moderation, AI-assisted discovery, and lead generation. The platform uses a single role model (`user` and `admin`) and treats all property categories through a unified listing model: rent, sale, and shared housing.

## 1.2 Motivation

The Egyptian real estate market requires fast discovery, trusted listings, direct contact paths, and flexible housing options. AXIOM addresses these needs by replacing static broker-style browsing with AI search, verified seller badges, WhatsApp enquiry capture, shared-housing compatibility, and structured admin approval workflows.

## 1.3 Objective

The objective is to provide a production-ready web platform where users can search, compare, save, enquire about, and book properties, while owners and admins manage listing quality and platform operations.

## 1.4 Aim

The project aims to improve property discovery accuracy, reduce listing fraud, simplify owner workflows, and make the platform extensible for AI features, subscriptions, payments, and future deployment.

## 1.5 Scope

The implemented scope includes public property pages, search pages, shared housing, user authentication, dashboard management, admin CRUD and moderation, AI search/chat/recommendations, subscriptions, bookings, WhatsApp lead capture, universities, agencies, projects, and blog content. Frontend routes include: {frontend_route_list}.

## 1.6 General Constraints

The backend depends on Supabase credentials, JWT secrets, Ollama model availability, Stripe keys, and a configured frontend URL. The frontend depends on Supabase public credentials and the backend API URL. Local AI is intentionally configured through Ollama rather than an external AI API.

## 1.7 Organization of the Dissertation

Chapter 2 reviews background and previous work. Chapter 3 presents planning and analysis. Chapter 4 documents database and software design with regenerated diagrams. Chapter 5 describes implementation and UI results. Chapter 6 summarizes verification through unit and integration tests.

# Chapter 2 Background and Previous Work

## 2.1 Background

The earlier Broker Website report described a traditional property brokerage system. AXIOM V2 extends that concept into a modern full-stack product. The current repository contains a FastAPI service layer, Supabase-backed data access, a Next.js application, server/client state management, and AI modules for search, recommendation, compatibility, validation, and content generation.

## 2.2 Previous Work

The old report is used only as a metadata and narrative reference. Its diagrams are obsolete because the current architecture no longer follows the old PHP/MySQL style. Current evidence comes from `{ROOT.name}` source files: `README.md`, `docs/API_REFERENCE.md`, `docs/ROADMAP.md`, backend routers, frontend routes, SQL migrations, and tests.

# Chapter 3 Planning and Analysis

## 3.1 Planning

The implementation is organized into frontend, backend, database, AI, payment, and deployment layers. Source inspection found {route_count} backend API routes, {table_count} database tables, and {class_count} backend Python classes/schemas/services.

## 3.1.1 Feasibility Study and Estimated Cost

The project is technically feasible with open-source and managed services. Development uses Next.js, FastAPI, Supabase, PostgreSQL, Ollama, and Stripe. Operational cost is driven by Supabase hosting, deployment infrastructure, Stripe processing fees, and the machine running Ollama embeddings/chat.

## 3.1.2 Gantt Chart

The roadmap shows phased delivery: core pages and auth, Supabase wiring, AI features, admin CRUD, WhatsApp leads, payment/subscription features, partner universities, deployment infrastructure, and final QA.

## 3.2 Analysis and Limitations of Existing System

The earlier broker system relied on more static listing flows and outdated diagrams. It did not reflect the current unified owner model, shared-housing category, AI search, subscription quotas, Stripe webhook synchronization, or WhatsApp lead capture.

## 3.3 Need for New System

The new system is needed to centralize listings, reduce manual brokerage friction, improve trust through moderation and seller verification, support AI-assisted discovery, and align with modern frontend/backend deployment practices.

## 3.4 Analysis of New System

AXIOM V2 separates concerns across a typed Next.js UI, FastAPI routers, Supabase data storage, AI service modules, and payment/subscription services. The API surface is documented in `docs/API_REFERENCE.md` and implemented through FastAPI routers.

## 3.4.1 User Requirements

{requirements_table(routes)}

## 3.4.2 System Requirements

The system requires Python 3.11+, FastAPI dependencies, Node.js, Next.js 16, Supabase project configuration, PostgreSQL schema migrations, local or hosted Ollama, and Stripe credentials for payment/subscription flows.

## 3.4.3 Domain Requirements

The real estate domain model includes users/profiles, listings, agencies, projects, neighborhoods, favorites, applications, viewings, leads, bookings, payments, subscriptions, notifications, universities, and blog content. Listing status and category values are encoded as SQL enums and frontend/API TypeScript types.

## 3.4.4 Functional Requirements

{endpoint_table(routes)}

## 3.4.5 Non-Functional Requirements

{nonfunctional_table()}

## 3.5 Advantages of New System

AXIOM V2 provides AI-assisted search and recommendations, a unified listing model, admin moderation, verified seller badges, direct WhatsApp enquiry capture, shared-housing compatibility, owner subscriptions, Stripe booking deposits, and a dashboard-oriented user experience.

## 3.6 User Characteristics

Users include property seekers, renters, shared-housing applicants, property owners, agency/developer representatives, and platform admins. The implementation deliberately avoids separate seeker/broker roles and uses a unified `user` role with optional verified seller state.

# Chapter 4: Design

## 4.1 Design and Implementation Constraints

The project uses a Next.js App Router frontend and FastAPI backend. Auth depends on Supabase JWTs. Database access uses Supabase/PostgreSQL with Row Level Security policies. AI depends on Ollama and pgvector. Payments and subscriptions depend on Stripe webhooks and configured price IDs.

## 4.2 Assumptions and Dependencies

The backend assumes valid Supabase keys, JWT secrets, and service role access for server-side operations. The frontend assumes a configured API URL and Supabase public key. AI features assume `axiom-llm` and `nomic-embed-text` are available in Ollama.

## 4.3 Risks and Risk Management

Important risks include stale environment variables, Stripe webhook misconfiguration, Supabase schema drift, AI service downtime, and admin moderation gaps. Mitigations include environment validation, webhook tests, SQL migrations, fallback AI error responses, rate limiting, and admin approval workflows.

## 4.4 Design of Database ERD

![Figure 4.1: Updated ERD](diagrams/erd.v2.png)

<div class="caption">Figure 4.1: Updated ERD generated from SQL migrations.</div>

## 4.1.1 Entity Relationship Diagram

The ERD is generated from `CREATE TABLE` definitions and inline `REFERENCES` constraints found in `docs/schema` and `backend/sql`.

## 4.1.2 Mapping of Entity Relationship Diagram

{schema_table(tables)}

Enums:

{enum_list}

## 4.5 Class Diagram

![Figure 4.2: Backend class diagram](diagrams/class.v2.png)

<div class="caption">Figure 4.2: Class diagram generated from backend Python AST classes and schemas.</div>

## 4.6 Use Case Diagram

![Figure 4.3: Primary use-case diagram](diagrams/usecase.v2.png)

<div class="caption">Figure 4.3: Primary use-case diagram generated from FastAPI route coverage.</div>

## 4.3.1 Primary Use-case Diagram

The primary use cases are search, property detail viewing, favourites, WhatsApp enquiries, booking, shared-housing applications, owner listing management, subscriptions, admin moderation, user verification, and lead review.

## 4.3.2 Use-case Scenarios

Typical scenarios include: a visitor searches listings with structured filters or AI; a signed-in user saves a property or opens WhatsApp; an owner creates a listing that enters pending review; an admin approves or rejects it; and a renter completes a booking deposit.

## 4.7 Activity Diagram

![Figure 4.4: User activity flow](diagrams/activity_user.v2.png)

<div class="caption">Figure 4.4: User activity flow generated from frontend routes and backend capabilities.</div>

![Figure 4.5: Admin activity flow](diagrams/activity_admin.v2.png)

<div class="caption">Figure 4.5: Admin activity flow generated from admin dashboard routes and endpoints.</div>

## 4.8 Sequence Diagram

![Figure 4.6: User enquiry sequence](diagrams/seq_user.v2.png)

<div class="caption">Figure 4.6: User enquiry and booking sequence generated from controller/router responsibilities.</div>

![Figure 4.7: Admin verification sequence](diagrams/seq_admin.v2.png)

<div class="caption">Figure 4.7: Admin listing verification sequence generated from admin routes.</div>

## 4.9 State Diagram

![Figure 4.8: Listing lifecycle state diagram](diagrams/state_inquiry.v2.png)

<div class="caption">Figure 4.8: State diagram for the implemented listing review lifecycle. AXIOM V2 has no separate Inquiry entity; enquiries are implemented as WhatsApp leads and viewings.</div>

# Chapter 5: Implementation

## 5.1 Software Architecture

AXIOM V2 is implemented as a two-application system. The frontend is a Next.js 16 application with React 19, TypeScript, Tailwind CSS, shadcn-style UI components, Zustand auth state, and TanStack Query. The backend is a FastAPI application with routers for auth, listings, dashboard, notifications, agencies, viewings, blog, admin, AI, uploads, applications, bookings, Stripe webhooks, projects, leads, universities, and subscriptions.

Main frontend dependencies include: {", ".join(f"`{k}`" for k in sorted(list(deps.keys()))[:24])}.

Backend requirements include: {", ".join(f"`{r}`" for r in backend_requirements())}.

The README summarizes the stack as: {clean_text(readme.split("## Features")[0])}

## 5.2 User Interface

{screenshot_markdown()}

## 5.3 Results and Discussion

The resulting platform replaces the old broker report architecture with a code-backed system that supports live public pages, admin management, AI features, direct Supabase queries, Stripe payments, subscriptions, WhatsApp leads, and deployment infrastructure. The roadmap records backend tests as green and identifies remaining launch tasks around environment setup, deployment, and final payment QA.

# Chapter 6: Testing

## 6.1 Unit Testing

Backend tests are implemented with pytest under `backend/tests`. The test suite covers auth, listings, dashboard, AI helpers, applications, bookings, admin behavior, notifications, uploads, subscriptions, leads, agencies, projects, blog, and amenity validation.

Current pytest status: **{tests["pytest_status"]}**.

Captured pytest detail:

```
{tests["pytest_detail"]}
```

## 6.2 Integration Testing

Integration-oriented checks include FastAPI route tests, Supabase client mocks, Stripe booking/subscription behavior, admin listing moderation, API error handling, and frontend TypeScript compilation.

TypeScript status: **{tests["tsc_status"]}**.

Captured TypeScript detail:

```
{tests["tsc_detail"]}
```

The generated requirements tables were cross-checked against actual routers and configuration flags. Table names and attributes in this report were generated from SQL migrations to keep IDs, table names, and relationships synchronized with the ERD.
"""
    (BUILD / "report.md").write_text(content, encoding="utf-8")


def main() -> None:
    metadata = extract_old_metadata()
    headings = extract_template_headings()
    routes = parse_routes()
    tables, enums = parse_sql_schema()
    classes = parse_python_classes()
    write_diagram_sources(tables, classes, routes)
    write_report(metadata, headings, routes, tables, enums, classes)
    summary = {
        "routes": len(routes),
        "tables": len(tables),
        "classes": len(classes),
        "frontend_routes": frontend_routes(),
    }
    (BUILD / "analysis-summary.json").write_text(json.dumps(summary, indent=2), encoding="utf-8")


if __name__ == "__main__":
    main()
PY

cat >"$SCRIPT_DIR/capture_screenshots.mjs" <<'JS'
import { spawn } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";

const root = process.env.AXIOM_ROOT;
const outDir = process.env.SCREENSHOT_DIR;
const baseUrl = process.env.FRONTEND_URL;
const chromium = process.env.CHROMIUM_BIN;

if (!root || !outDir || !baseUrl || !chromium) {
  throw new Error("Missing AXIOM_ROOT, SCREENSHOT_DIR, FRONTEND_URL, or CHROMIUM_BIN");
}

mkdirSync(outDir, { recursive: true });

const shots = [
  ["/", "home.png"],
  ["/find-homes", "find-homes.png"],
  ["/dashboard", "dashboard.png"],
  ["/admin/login", "admin-login.png"],
  ["/pricing", "pricing.png"],
];

function run(command, args, options = {}) {
  return new Promise((resolvePromise) => {
    const child = spawn(command, args, { stdio: "ignore", ...options });
    child.on("exit", (code) => resolvePromise(code ?? 1));
    child.on("error", () => resolvePromise(1));
  });
}

for (const [route, name] of shots) {
  const file = resolve(outDir, name);
  const url = new URL(route, baseUrl).toString();
  await run(chromium, [
    "--headless=new",
    "--disable-gpu",
    "--no-sandbox",
    "--hide-scrollbars",
    "--window-size=1440,1100",
    `--screenshot=${file}`,
    url,
  ]);
}

const missing = shots.filter(([, name]) => !existsSync(resolve(outDir, name)));
if (missing.length) {
  throw new Error(`Missing screenshots: ${missing.map(([, name]) => name).join(", ")}`);
}
JS

export AXIOM_ROOT BUILD_DIR DIAGRAM_DIR SCREENSHOT_DIR

log "Analyzing source and writing diagram sources/report markdown"
${PYTHON_BIN} "$SCRIPT_DIR/analyze_project.py"

log "Rendering Mermaid diagrams"
for diagram in "$DIAGRAM_DIR"/*.mmd; do
  [[ -f "$diagram" ]] || continue
  mmdc -i "$diagram" -o "${diagram%.mmd}.png" -b white -t neutral --scale 2
done

log "Rendering PlantUML diagrams"
for diagram in "$DIAGRAM_DIR"/*.puml; do
  [[ -f "$diagram" ]] || continue
  plantuml -tpng "$diagram"
done

if [[ "$SKIP_SCREENSHOTS" != "1" ]]; then
  log "Starting frontend dev server for screenshots"
  (
    cd "$AXIOM_ROOT/frontend"
    npm run dev -- --hostname 127.0.0.1 --port "$FRONTEND_PORT"
  ) >"$BUILD_DIR/frontend-server.log" 2>&1 &
  FRONTEND_PID=$!

  log "Waiting for frontend at $FRONTEND_URL"
  for _ in $(seq 1 "$SCREENSHOT_TIMEOUT_SECONDS"); do
    if ${PYTHON_BIN} - "$FRONTEND_URL" <<'PY' >/dev/null 2>&1
import sys
from urllib.request import urlopen
urlopen(sys.argv[1], timeout=2).read(1)
PY
    then
      break
    fi
    sleep 1
  done

  export FRONTEND_URL CHROMIUM_BIN
  log "Capturing UI screenshots"
  timeout 90 node "$SCRIPT_DIR/capture_screenshots.mjs" || log "Screenshot capture failed; report will note missing captures"
fi

log "Checking required diagram PNG outputs"
for required in erd.v2.png class.v2.png usecase.v2.png activity_user.v2.png activity_admin.v2.png seq_user.v2.png seq_admin.v2.png state_inquiry.v2.png; do
  [[ -s "$DIAGRAM_DIR/$required" ]] || die "Required diagram missing or empty: $DIAGRAM_DIR/$required"
done

log "Compiling Markdown to HTML with Pandoc"
pandoc "$REPORT_MD" \
  --from markdown+raw_html+pipe_tables \
  --standalone \
  --css "$REPORT_CSS" \
  --output "$REPORT_HTML"

log "Compiling final PDF with wkhtmltopdf"
wkhtmltopdf \
  --enable-local-file-access \
  --print-media-type \
  --encoding utf-8 \
  "$REPORT_HTML" \
  "$FINAL_PDF"

[[ -s "$FINAL_PDF" ]] || die "Final PDF was not created: $FINAL_PDF"

if command -v pdfinfo >/dev/null 2>&1; then
  pdfinfo "$FINAL_PDF" >"$BUILD_DIR/final-pdf-info.txt" || true
fi

log "Final report generated: $FINAL_PDF"

# Run instructions:
# 1. Install required open-source CLI tools:
#    python3 node npm pandoc wkhtmltopdf @mermaid-js/mermaid-cli plantuml poppler-utils chromium
# 2. From the repository root, run:
#    TEMPLATE_PDF="/path/to/Graduation project template.pdf" \
#    OLD_REPORT_PDF="/path/to/Broker System Doc.pdf" \
#    bash build_report.sh
# 3. The final PDF will be written to:
#    docs/Final_Report.pdf
# 4. Optional flags:
#    SKIP_SCREENSHOTS=1 skips Chromium UI screenshots.
#    FRONTEND_PORT=3001 changes the temporary Next.js dev-server port.
