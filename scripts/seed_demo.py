#!/usr/bin/env python3
"""Create an optional, entirely fictional demo in this checkout's local storage.

There is no database import or destination command-line option. Re-running a
completed seed is a read-only no-op, including after a user edits demo records.
An existing database with unrecognized business records is rejected unchanged.
"""
from __future__ import annotations

import json
from contextlib import closing
from pathlib import Path
import secrets
import sqlite3
import sys

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
import server

VERSION = "public-synthetic-demo-v1"
MARKER_COLLECTION = "public_demo_seed"
MARKER_ID = "synthetic-example-v1"
SYNTHETIC_NOTICE = "全部为虚构教学数据，不代表任何真实组织、人员或作业标准。"


def _existing_state(core):
    """Inspect only this application's target before allowing initialization."""
    if core.DB.is_symlink() or core.DB.parent.is_symlink():
        raise RuntimeError("演示库及其目录不能为符号链接，未修改任何数据。")
    if not core.DB.exists() or core.DB.stat().st_size == 0:
        return None
    uri = core.DB.resolve().as_uri() + "?mode=ro"
    with closing(sqlite3.connect(uri, uri=True)) as connection:
        exists = connection.execute(
            "SELECT 1 FROM sqlite_master WHERE type='table' AND name='documents'"
        ).fetchone()
        if not exists:
            raise RuntimeError("目标文件不是新的演示库；未导入、覆盖或初始化该文件。")
        marker = connection.execute(
            "SELECT payload FROM documents WHERE collection=? AND id=?",
            (MARKER_COLLECTION, MARKER_ID),
        ).fetchone()
        if marker:
            result = json.loads(marker[0])
            if result.get("version") != VERSION or result.get("synthetic") is not True:
                raise RuntimeError("演示数据标记不匹配，未修改已有数据。")
            return dict(result, created=False)
        business = connection.execute(
            "SELECT COUNT(*) FROM documents WHERE collection NOT IN ('major_workshops','users')"
        ).fetchone()[0]
        users = connection.execute(
            "SELECT COUNT(*) FROM documents WHERE collection='users'"
        ).fetchone()[0]
        if business or users > 1:
            raise RuntimeError("已有非演示业务数据，拒绝混入示例；未修改已有记录。")
        return None


def _create(core, connection, administrator, kind, body):
    record = core.validate(connection, kind, body, user=administrator)
    if kind == "questions":
        core.question_authorship(record, administrator)
        core.check_question_write(connection, record)
    record.update(synthetic=True, demo_version=VERSION)
    core.put(connection, kind, record)
    return record


def _question_rows(item):
    """Generic learning examples, authored here rather than imported."""
    return [
        ("knowledge", "single", "开始任务前，应该先做什么？", "Apa yang dilakukan sebelum tugas dimulai?",
         [("A", "阅读任务说明", "Membaca petunjuk tugas"), ("B", "跳过任务说明", "Melewati petunjuk")], ["A"]),
        ("operation", "multiple", "哪些做法有助于完成演示任务？", "Tindakan mana yang membantu menyelesaikan tugas demo?",
         [("A", "按步骤执行", "Mengikuti langkah"), ("B", "猜测未确认内容", "Menebak informasi"),
          ("C", "核对执行结果", "Memeriksa hasil")], ["A", "C"]),
        ("safety", "true_false", "未核实的信息不应标记为已经确认。", "Informasi yang belum diperiksa tidak boleh ditandai terkonfirmasi.",
         [("T", "正确", "Benar"), ("F", "错误", "Salah")], ["T"]),
        ("quality", "single", "怎样判断保存已经完成？", "Bagaimana memastikan penyimpanan selesai?",
         [("A", "核对保存成功提示和记录", "Memeriksa konfirmasi dan catatan"), ("B", "只看按钮被点击", "Hanya melihat tombol diklik")], ["A"]),
        ("troubleshooting", "single", "缺少必要信息时，应该怎样处理？", "Apa yang dilakukan jika informasi wajib belum tersedia?",
         [("A", "随意填写", "Mengisi secara acak"), ("B", "先核实再继续", "Memeriksa sebelum melanjutkan")], ["B"]),
    ]


def seed_demo(core=server):
    """Seed once; callers may supply an isolated server module for testing."""
    with core.LOCK:
        previous = _existing_state(core)
        if previous is not None:
            return previous
        core.init_db()
        with closing(core.connect()) as connection, connection:
            connection.execute("BEGIN IMMEDIATE")
            administrator = next(
                user for user in core.all_docs(connection, "users") if user["role"] == "admin"
            )
            groups = sorted(core.all_docs(connection, "major_workshops"), key=lambda value: value.get("sort_order", 0))
            if not groups:
                raise RuntimeError("请先配置公开演示分类。")
            major = groups[0]
            units = [
                _create(core, connection, administrator, "workshops", {
                    "major_workshop_id": major["id"], "code": "DEMO-" + letter,
                    "name": "演示小组" + letter, "name_id": "Tim Demo " + letter,
                    "manager": "", "description": SYNTHETIC_NOTICE,
                }) for letter in ("A", "B")
            ]
            position = _create(core, connection, administrator, "positions", {
                "major_workshop_id": major["id"], "workshop_id": "",
                "name": "演示任务员", "name_id": "Pelaksana Tugas Demo",
                "description": SYNTHETIC_NOTICE,
            })
            item_specs = [
                ("任务步骤确认", "Konfirmasi Langkah Tugas", "exam_practical", "operation"),
                ("演示记录核对", "Pemeriksaan Catatan Demo", "exam_practical", "operation"),
                ("桌面整理检查", "Pemeriksaan Kerapian Meja", "direct", "inspection"),
                ("演示数据记录", "Pencatatan Data Demo", "direct", "data"),
            ]
            items = []
            for index, (name, translated, mode, category) in enumerate(item_specs):
                items.append(_create(core, connection, administrator, "work_items", {
                    "position_id": position["id"], "name": name, "name_id": translated,
                    "description": SYNTHETIC_NOTICE,
                    "practical_standard_zh": "仅用于演示：说明步骤，完成示例任务，并核对结果。",
                    "practical_standard_id": "Demo saja: jelaskan langkah, lakukan tugas contoh, lalu periksa hasil.",
                    "sort_order": index + 1, "active": True,
                    "assessment_mode": mode, "skill_category": category,
                }))
            questions = []
            for item in items[:2]:
                for dimension, question_type, title, translated, options, answers in _question_rows(item):
                    questions.append(_create(core, connection, administrator, "questions", {
                        "work_item_id": item["id"], "dimension": dimension, "type": question_type,
                        "title_zh": item["name"] + "：" + title,
                        "title_id": item["name_id"] + ": " + translated,
                        "options": [{"key": key, "text_zh": zh, "text_id": indonesian}
                                    for key, zh, indonesian in options],
                        "correct_answer": answers, "reference_answer_zh": "", "reference_answer_id": "",
                        "points": 10, "status": "active",
                    }))
            employees = []
            for letter in "ABCDEFG":
                employees.append(_create(core, connection, administrator, "employees", {
                    "workshop_id": units[letter == "G"]["id"], "position_id": position["id"],
                    "employee_no": "DEMO-" + letter, "name": "演示成员" + letter,
                    "language": "zh", "active": True, "assessment_category": "operator",
                }))
            rounds = [
                _create(core, connection, administrator, "exam_rounds", {
                    "major_workshop_id": major["id"], "workshop_ids": [unit["id"]],
                    "position_ids": [position["id"]], "round_number": 1,
                    "title": unit["name"] + "教学体验", "title_id": unit["name_id"] + " · Latihan",
                    "duration_minutes": 30, "status": "open",
                }) for unit in units
            ]
            # Exercise the same registration, submission and assessment rules
            # as real requests. Every mark below is labelled synthetic.
            for practical_score, employee in enumerate(employees[:5], 1):
                request_key = secrets.token_urlsafe(32)
                path = core.register_exam_entry(connection, dict(
                    name=employee["name"], employee_no=employee["employee_no"],
                    workshop_id=employee["workshop_id"], position_id=position["id"],
                    language="zh", assessment_category="operator", request_key=request_key,
                ), "127.0.0.1")
                assignment = core.find_token(connection, path.rsplit("/", 1)[-1])
                client = secrets.token_urlsafe(24)
                core.start_exam(assignment, {"client_id": client})
                # One wrong answer per five-question item gives 80% theory.
                answers = {q["id"]: ([] if q["dimension"] == "troubleshooting" else q["correct_answer"])
                           for q in assignment["details"]["questions"]}
                core.submit_exam(assignment, {"client_id": client, "revision": 1, "answers": answers})
                assignment.update(synthetic=True, demo_version=VERSION)
                core.put(connection, "assignments", assignment)
                for item in items:
                    body = {"employee_id": employee["id"], "work_item_id": item["id"],
                            "score": practical_score, "expected_reviewed_at": "",
                            "note": "虚构演示评分，仅用于展示功能。"}
                    if item["assessment_mode"] == "exam_practical":
                        body["assignment_id"] = assignment["id"]
                    core.score_practical(connection, administrator, body)
            for collection in ("question_banks", "practical_scores", "practical_history", "direct_scores", "direct_history"):
                for record in core.all_docs(connection, collection):
                    record.update(synthetic=True, demo_version=VERSION)
                    core.put(connection, collection, record)
            result = {
                "id": MARKER_ID, "version": VERSION, "synthetic": True,
                "notice": SYNTHETIC_NOTICE, "created": True,
                "units": [unit["id"] for unit in units], "position": position["id"],
                "items": [item["id"] for item in items], "employees": [person["id"] for person in employees],
                "rounds": [round_["id"] for round_ in rounds],
                "counts": {"workshops": 2, "positions": 1, "work_items": 4, "questions": 10,
                           "employees": 7, "completed_demo_exams": 5},
            }
            core.put(connection, MARKER_COLLECTION, result)
            connection.commit()
            return result


def main():
    if len(sys.argv) != 1:
        raise SystemExit("用法：python3 scripts/seed_demo.py（不接受数据库、导入文件或目标路径参数）")
    expected = ROOT / "runtime" / "framework.sqlite3"
    if server.DB.resolve() != expected.resolve():
        raise SystemExit("仅允许初始化此公开副本自己的 runtime 演示库。")
    result = seed_demo()
    print("已创建全虚构教学数据。" if result["created"] else "演示已存在，未覆盖任何已有记录。")
    print(SYNTHETIC_NOTICE)
    print("DEMO-A 至 DEMO-E：五档评分示例；DEMO-F：可试考；DEMO-G：另一演示小组。")
    print("初始管理员凭据仅保存在本机 runtime/initial-admin.json，请勿上传 runtime。")


if __name__ == "__main__":
    main()
