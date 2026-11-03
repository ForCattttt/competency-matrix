"""Public-edition contracts using only temporary, synthetic databases.

Run with ``python3 -m unittest discover -s tests -v``. No existing runtime or
external service is used, and every test listener binds an ephemeral loopback port.
"""
from __future__ import annotations

import hashlib
from contextlib import closing
import http.client
import importlib.util
import io
import json
from pathlib import Path
import re
import secrets
import sqlite3
import stat
import sys
import tempfile
import threading
import unittest
from urllib.parse import urlencode
from xml.etree import ElementTree as ET
import zipfile

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
import server
import workshop_xlsx

_spec = importlib.util.spec_from_file_location("public_demo_seed", ROOT / "scripts" / "seed_demo.py")
demo = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(demo)


class PublicDemoContract(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix="matrix-public-test-")
        self.previous_db = server.DB
        server.DB = Path(self.temp.name) / "runtime" / "framework.sqlite3"
        self.addCleanup(self.restore_storage)
        for cache in (server.LOGIN_FAILURES, server.LOGIN_IP_FAILURES,
                      server.EXAM_ENTRY_FAILURES, server.EXAM_REGISTRATION_CREATES):
            cache.clear()
        self.seed = demo.seed_demo(server)
        self.start_http()
        self.addCleanup(self.stop_http)
        self.credentials_path = server.DB.parent / "initial-admin.json"
        self.credentials = json.loads(self.credentials_path.read_text(encoding="utf-8"))
        self.admin_cookie = self.login(self.credentials["username"], self.credentials["password"])

    def start_http(self):
        self.httpd = server.ThreadingHTTPServer(("127.0.0.1", 0), server.Handler)
        self.httpd.lan_networks = ()
        self.httpd.lan_hosts = server.LOCAL_HTTP_HOSTS
        self.httpd.network_io_timeout = 3
        self.thread = threading.Thread(target=self.httpd.serve_forever, daemon=True)
        self.thread.start()

    def stop_http(self):
        self.httpd.shutdown()
        self.httpd.server_close()
        self.thread.join(timeout=5)
        self.assertFalse(self.thread.is_alive(), "temporary test listener did not stop")

    def restore_storage(self):
        server.DB = self.previous_db
        self.temp.cleanup()

    def request(self, method, path, body=None, cookie=None, headers=None):
        connection = http.client.HTTPConnection("127.0.0.1", self.httpd.server_port, timeout=5)
        supplied = dict(headers or {})
        if cookie:
            supplied["Cookie"] = cookie
        if body is not None:
            supplied.setdefault("Content-Type", "application/json")
            encoded = json.dumps(body, ensure_ascii=False).encode("utf-8")
        else:
            encoded = None
        if method not in ("GET", "HEAD"):
            supplied.setdefault("Origin", "http://127.0.0.1:" + str(self.httpd.server_port))
        try:
            connection.request(method, path, body=encoded, headers=supplied)
            response = connection.getresponse()
            content = response.read()
            response_headers = dict(response.getheaders())
            value = json.loads(content) if content and "application/json" in response.getheader("Content-Type", "") else content
            return response.status, value, response_headers
        finally:
            connection.close()

    def login(self, username, password):
        status, value, headers = self.request("POST", "/api/login", {"username": username, "password": password})
        self.assertEqual(status, 200, value)
        cookie = headers["Set-Cookie"].split(";", 1)[0]
        self.assertIn("HttpOnly", headers["Set-Cookie"])
        self.assertIn("SameSite=Strict", headers["Set-Cookie"])
        return cookie

    def documents(self, collection):
        with closing(server.connect()) as connection, connection:
            return server.all_docs(connection, collection)

    def document(self, collection, ident):
        with closing(server.connect()) as connection, connection:
            return server.get(connection, collection, ident)

    def matrix(self, unit=None):
        query = urlencode({"position_id": self.seed["position"], "workshop_id": unit or self.seed["units"][0]})
        status, value, _ = self.request("GET", "/api/matrix?" + query, cookie=self.admin_cookie)
        self.assertEqual(status, 200, value)
        return value

    def test_seed_is_entirely_fictional_and_has_teaching_examples(self):
        self.assertTrue(self.seed["synthetic"])
        self.assertTrue(self.seed["created"])
        employees = self.documents("employees")
        self.assertEqual({person["employee_no"] for person in employees}, {"DEMO-" + letter for letter in "ABCDEFG"})
        self.assertEqual({person["name"] for person in employees}, {"演示成员" + letter for letter in "ABCDEFG"})
        for collection in ("workshops", "positions", "work_items", "question_banks", "questions", "employees",
                           "exam_rounds", "assignments", "practical_scores", "practical_history", "direct_scores", "direct_history"):
            for record in self.documents(collection):
                self.assertIs(record["synthetic"], True)
                self.assertEqual(record["demo_version"], demo.VERSION)
        self.assertEqual(len(self.documents("questions")), 10)
        self.assertEqual({q["type"] for q in self.documents("questions")}, {"single", "multiple", "true_false"})
        self.assertEqual(len(self.documents("assignments")), 5)

    def test_seed_rerun_and_restart_preserve_existing_edits(self):
        with closing(server.connect()) as connection, connection:
            employee = server.get(connection, "employees", self.seed["employees"][0])
            employee["name"] = "演示成员A（本地修改）"
            server.put(connection, "employees", employee)
        with closing(server.connect()) as connection, connection:
            before = list(connection.execute("SELECT collection,id,payload FROM documents ORDER BY collection,id"))
        credential_bytes = self.credentials_path.read_bytes()
        self.stop_http()
        server.init_db()
        self.start_http()
        rerun = demo.seed_demo(server)
        self.assertFalse(rerun["created"])
        self.assertEqual(self.seed["employees"], rerun["employees"])
        self.assertEqual(credential_bytes, self.credentials_path.read_bytes())
        with closing(server.connect()) as connection, connection:
            after = list(connection.execute("SELECT collection,id,payload FROM documents ORDER BY collection,id"))
            self.assertEqual([tuple(row) for row in before], [tuple(row) for row in after])
            ready = server.shared_banks.assert_position_banks_ready(connection, vars(server))
        self.assertTrue(ready["ready"])
        status, current, _ = self.request("GET", "/api/me", cookie=self.admin_cookie)
        self.assertEqual(status, 200, "a persisted authenticated session should survive a listener restart")
        self.assertEqual(current["user"]["role"], "admin")

    def test_unknown_existing_database_is_rejected_without_changes(self):
        actual = server.DB
        unknown = Path(self.temp.name) / "unrecognized.sqlite3"
        with closing(sqlite3.connect(unknown)) as connection, connection:
            connection.execute("CREATE TABLE documents(collection TEXT,id TEXT,payload TEXT)")
            connection.execute("INSERT INTO documents VALUES(?,?,?)", ("employees", "existing-record", "{}"))
        before = hashlib.sha256(unknown.read_bytes()).digest()
        server.DB = unknown
        try:
            with self.assertRaises(RuntimeError):
                demo.seed_demo(server)
        finally:
            server.DB = actual
        self.assertEqual(before, hashlib.sha256(unknown.read_bytes()).digest())
        self.assertFalse((unknown.parent / "initial-admin.json").exists())

    def test_random_initial_administrator_authentication(self):
        password = self.credentials["password"]
        self.assertGreaterEqual(len(password), 20)
        self.assertNotEqual(password, "admin")
        status, _, _ = self.request("POST", "/api/login", {"username": "admin", "password": "admin"})
        self.assertEqual(status, 401)
        status, current, _ = self.request("GET", "/api/me", cookie=self.admin_cookie)
        self.assertEqual(status, 200)
        self.assertEqual(current["user"]["role"], "admin")
        with closing(server.connect()) as connection, connection:
            stored = connection.execute("SELECT password_hash FROM credentials").fetchone()[0]
            self.assertTrue(server.check_password(password, stored))
            self.assertNotIn(password, "".join(row[0] for row in connection.execute("SELECT payload FROM documents")))
        if sys.platform != "win32":
            self.assertEqual(stat.S_IMODE(self.credentials_path.stat().st_mode), 0o600)

    def test_organization_and_question_banks_survive_initialization(self):
        server.init_db()
        with closing(server.connect()) as connection, connection:
            state = server.shared_banks.assert_position_banks_ready(connection, vars(server))
            items = server.all_docs(connection, "work_items")
            banks = {bank["id"]: bank for bank in server.all_docs(connection, "question_banks")}
            questions = server.all_docs(connection, "questions")
            self.assertTrue(state["ready"])
            self.assertEqual(len(banks), 2)
            for item in items:
                if item["assessment_mode"] == "direct":
                    self.assertFalse(item.get("question_bank_id"))
                    continue
                bank = banks[item["question_bank_id"]]
                self.assertEqual(bank["position_id"], self.seed["position"])
                associated = [q for q in questions if q["work_item_id"] == item["id"]]
                self.assertEqual(len(associated), 5)
                self.assertEqual({q["question_bank_id"] for q in associated}, {bank["id"]})

    def test_five_level_matrix_and_independent_direct_assessments(self):
        matrix = self.matrix()
        rows = {row["employee"]["employee_no"]: row for row in matrix["rows"]}
        for level, letter in enumerate("ABCDE"):
            cells = rows["DEMO-" + letter]["cells"]
            self.assertEqual({cell["level"] for cell in cells}, {level})
            for cell in cells:
                self.assertEqual(cell["assessment_status"], "completed")
                if cell["assessment_mode"] == "direct":
                    self.assertIsNone(cell["final_percent"])
                    self.assertIsNone(cell["theory_exam_percent"])
                else:
                    self.assertEqual(cell["theory_item_percent"], 80)
                    self.assertEqual(cell["practical_score"], level + 1)
                    self.assertEqual(cell["final_percent"], 50 + 10 * level)
        self.assertTrue(all(cell["level"] is None for cell in rows["DEMO-F"]["cells"]))
        self.assertNotIn("DEMO-G", rows)

    def test_http_exam_submission_practical_and_direct_scoring(self):
        employee = self.document("employees", self.seed["employees"][5])
        registration = {key: employee[key] for key in ("name", "employee_no", "workshop_id", "position_id", "assessment_category", "language")}
        registration["request_key"] = secrets.token_urlsafe(32)
        status, result, _ = self.request("POST", "/api/exam/register", registration)
        self.assertEqual(status, 200, result)
        token = result["path"].rsplit("/", 1)[-1]
        status, paper, _ = self.request("GET", "/api/take/" + token)
        self.assertEqual(status, 200, paper)
        self.assertNotIn("correct_answer", json.dumps(paper))
        client = secrets.token_urlsafe(24)
        status, _, _ = self.request("POST", "/api/take/" + token + "/start", {"client_id": client})
        self.assertEqual(status, 200)
        with closing(server.connect()) as connection, connection:
            assignment = server.find_token(connection, token)
        answers = {q["id"]: q["correct_answer"] for q in assignment["details"]["questions"]}
        status, _, _ = self.request("POST", "/api/take/" + token + "/draft", {
            "client_id": secrets.token_urlsafe(24), "revision": 1, "answers": answers,
        })
        self.assertEqual(status, 409)
        status, submitted, _ = self.request("POST", "/api/take/" + token + "/submit", {
            "client_id": client, "revision": 1, "answers": answers,
        })
        self.assertEqual(status, 200, submitted)
        with closing(server.connect()) as connection, connection:
            completed = server.find_token(connection, token)
        self.assertEqual(completed["status"], "completed")
        self.assertEqual(completed["percent"], 100)
        scoring = {"employee_id": employee["id"], "work_item_id": self.seed["items"][0],
                   "assignment_id": completed["id"], "score": 3, "expected_reviewed_at": "",
                   "note": "仅用于公开版自动测试的虚构评分。"}
        status, assessment, _ = self.request("POST", "/api/practical/score", scoring, self.admin_cookie)
        self.assertEqual(status, 200, assessment)
        self.assertEqual(assessment["assessment"]["final_percent"], 80)
        self.assertEqual(assessment["assessment"]["level"], 3)
        stale = dict(scoring, score=4)
        status, _, _ = self.request("POST", "/api/practical/score", stale, self.admin_cookie)
        self.assertEqual(status, 409)
        status, direct, _ = self.request("POST", "/api/direct/score", {
            "employee_id": employee["id"], "work_item_id": self.seed["items"][2],
            "score": 5, "expected_reviewed_at": "", "note": "独立直接评分演示。",
        }, self.admin_cookie)
        self.assertEqual(status, 200, direct)
        self.assertEqual(direct["assessment"]["level"], 4)
        self.assertIsNone(direct["assessment"]["theory_item_percent"])
        # An idempotent request key resumes the exact paper, not a second exam.
        status, repeated, _ = self.request("POST", "/api/exam/register", registration)
        self.assertEqual(status, 200)
        self.assertEqual(repeated["path"], result["path"])
        status, _, _ = self.request("POST", "/api/exam/register", dict(registration, request_key=secrets.token_urlsafe(32)))
        self.assertEqual(status, 409)

    def test_generated_xlsx_has_only_new_parts_and_selected_demo_members(self):
        query = urlencode({"workshop_id": self.seed["units"][0], "position_id": self.seed["position"],
                           "employee_ids": ",".join(self.seed["employees"][index] for index in (0, 1, 5))})
        status, content, headers = self.request("GET", "/api/export/matrix.xlsx?" + query, cookie=self.admin_cookie)
        self.assertEqual(status, 200)
        self.assertIn("spreadsheetml", headers["Content-Type"])
        with zipfile.ZipFile(io.BytesIO(content)) as archive:
            self.assertIsNone(archive.testzip())
            names = archive.namelist()
            self.assertEqual(len(names), len(set(names)))
            permitted = re.compile(r"(?:\[Content_Types\]\.xml|_rels/\.rels|xl/(?:workbook\.xml|styles\.xml|_rels/workbook\.xml\.rels|worksheets/sheet\d+\.xml|worksheets/_rels/sheet\d+\.xml\.rels|drawings/drawing\d+\.xml|drawings/_rels/drawing\d+\.xml\.rels|media/moon[0-4]\.png))$")
            self.assertTrue(all(permitted.fullmatch(name) for name in names), names)
            text = ""
            for name in names:
                if name.endswith((".xml", ".rels")):
                    root = ET.fromstring(archive.read(name))
                    self.assertFalse(any(node.get("TargetMode") == "External" for node in root.iter()))
                    text += "".join(root.itertext())
            for letter in "ABF":
                self.assertIn("演示成员" + letter, text)
            self.assertNotIn("演示成员G", text)
            self.assertNotIn("/" + "Users" + "/", text)
            for level in range(5):
                media = "xl/media/moon" + str(level) + ".png"
                if media in names:
                    self.assertEqual(archive.read(media), workshop_xlsx.png_moon(level))

    def test_unauthenticated_cross_department_and_path_boundaries(self):
        for path in ("/api/bootstrap", "/api/employees", "/api/export/matrix.xlsx"):
            status, _, _ = self.request("GET", path)
            self.assertEqual(status, 401, path)
        for path in ("/runtime/initial-admin.json", "/static/../runtime/initial-admin.json",
                     "/static/%2e%2e/server.py", "/static/%2e%2e/reference/rating_rules.json",
                     "/api/take/invalid-token"):
            status, _, _ = self.request("GET", path)
            self.assertEqual(status, 404, path)
        status, _, _ = self.request("POST", "/api/login", self.credentials, headers={"Origin": "https://example.invalid"})
        self.assertEqual(status, 403)
        status, _, _ = self.request("GET", "/api/health", headers={"Host": "example.invalid"})
        self.assertEqual(status, 403)
        scoped_password = secrets.token_urlsafe(24)
        status, scoped, _ = self.request("POST", "/api/users", {
            "username": "demo-test-reviewer", "name": "演示评分员", "role": "workshop_admin",
            "workshop_id": self.seed["units"][0], "active": True, "password": scoped_password,
        }, self.admin_cookie)
        self.assertEqual(status, 201, scoped)
        scoped_cookie = self.login("demo-test-reviewer", scoped_password)
        status, bootstrap, _ = self.request("GET", "/api/bootstrap", cookie=scoped_cookie)
        self.assertEqual(status, 200)
        self.assertNotIn("DEMO-G", json.dumps(bootstrap))
        outsider = self.seed["employees"][6]
        status, _, _ = self.request("GET", "/api/employees/" + outsider, cookie=scoped_cookie)
        self.assertEqual(status, 403)
        status, _, _ = self.request("POST", "/api/direct/score", {
            "employee_id": outsider, "work_item_id": self.seed["items"][2],
            "score": 5, "expected_reviewed_at": "", "note": "应拒绝的越权测试。",
        }, scoped_cookie)
        self.assertEqual(status, 403)
        query = urlencode({"workshop_id": self.seed["units"][1]})
        status, _, _ = self.request("GET", "/api/export/matrix.xlsx?" + query, cookie=scoped_cookie)
        self.assertEqual(status, 403)


if __name__ == "__main__":
    unittest.main()
