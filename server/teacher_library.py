from __future__ import annotations

import hashlib
import hmac
import json
import secrets
from datetime import datetime, timedelta, timezone

from fastapi import HTTPException


TEACHERS = {"fanjiaqi": "地理老师-范佳琪", "dengyongchun": "地理老师-邓永春"}

BOOKS = [
    ("地理必修第一册（自然地理）", [
        ("第一章 宇宙中的地球", ["第一节 地球的宇宙环境", "第二节 太阳对地球的影响", "第三节 地球的历史", "第四节 地球的圈层结构"]),
        ("第二章 地球上的大气", ["第一节 大气的组成和垂直分层", "第二节 大气受热过程和大气运动"]),
        ("第三章 地球上的水", ["第一节 水循环", "第二节 海水的性质", "第三节 海水的运动"]),
        ("第四章 地貌", ["第一节 常见地貌类型", "第二节 地貌的观察"]),
        ("第五章 植被与土壤", ["第一节 植被", "第二节 土壤"]),
        ("第六章 自然灾害", ["第一节 气象灾害", "第二节 地质灾害", "第三节 防灾减灾", "第四节 地理信息技术在防灾减灾中的应用"]),
    ]),
    ("地理必修第二册（人文地理）", [
        ("第一章 人口", ["第一节 人口分布", "第二节 人口迁移", "第三节 人口容量", "问题研究：如何看待农民工现象"]),
        ("第二章 乡村和城镇", ["第一节 乡村和城镇空间结构", "第二节 城镇化", "第三节 地域文化与城乡景观"]),
        ("第三章 产业区位因素", ["第一节 农业区位因素及其变化", "第二节 工业区位因素及其变化", "第三节 服务业区位因素及其变化"]),
        ("第四章 交通运输布局与区域发展", ["第一节 区域发展对交通运输布局的影响", "第二节 交通运输布局对区域发展的影响", "问题研究：城市交通如何疏堵"]),
        ("第五章 环境与发展", ["第一节 人类面临的主要环境问题", "第二节 走向人地协调——可持续发展", "第三节 中国国家发展战略举例", "问题研究：低碳食品知多少"]),
    ]),
]


def initial_library() -> dict:
    books = [{"id": f"book-{bi}", "name": name, "chapters": [
        {"id": f"chapter-{bi}-{ci}", "name": chapter, "sections": [
            {"id": f"section-{bi}-{ci}-{si}", "name": section, "title": section, "materials": []}
            for si, section in enumerate(sections)
        ]} for ci, (chapter, sections) in enumerate(chapters)
    ]} for bi, (name, chapters) in enumerate(BOOKS)]
    return {"books": books, "selectedSectionId": books[0]["chapters"][0]["sections"][0]["id"]}


def hash_password(password: str, salt: str) -> str:
    return hashlib.pbkdf2_hmac("sha256", password.encode(), bytes.fromhex(salt), 200_000).hex()


def seed_teachers(db) -> None:
    for username, name in TEACHERS.items():
        salt = secrets.token_hex(16)
        db.execute("INSERT OR IGNORE INTO teachers VALUES (?, ?, ?, ?, ?)",
                   (username, name, salt, hash_password("1234", salt), json.dumps(initial_library(), ensure_ascii=False)))


def teacher_for_token(db, authorization: str | None):
    token = (authorization or "").removeprefix("Bearer ")
    row = db.execute("SELECT teachers.username, teachers.name, teachers.library FROM teacher_sessions JOIN teachers ON teachers.username = teacher_sessions.username WHERE teacher_sessions.token = ? AND teacher_sessions.expires_at > ?", (token, datetime.now(timezone.utc).timestamp())).fetchone()
    if not row:
        raise HTTPException(401, "请重新登录教师账号")
    return row


def login(db, username: str, password: str) -> dict:
    row = db.execute("SELECT username, name, salt, password_hash FROM teachers WHERE username = ?", (username,)).fetchone()
    if not row or not hmac.compare_digest(hash_password(password, row["salt"]), row["password_hash"]):
        raise HTTPException(401, "账号或密码错误")
    token = secrets.token_urlsafe(32)
    expires = (datetime.now(timezone.utc) + timedelta(days=7)).timestamp()
    db.execute("INSERT INTO teacher_sessions VALUES (?, ?, ?)", (token, username, expires))
    return {"token": token, "teacher": {"username": username, "name": row["name"]}}


def validate_library(library: dict) -> None:
    if not isinstance(library, dict) or not isinstance(library.get("books"), list):
        raise HTTPException(400, "课程目录格式错误")
    ids = set()
    for book in library["books"]:
        if not isinstance(book.get("chapters"), list):
            raise HTTPException(400, "章节格式错误")
        for chapter in book["chapters"]:
            if not isinstance(chapter.get("sections"), list):
                raise HTTPException(400, "小节格式错误")
            for section in chapter["sections"]:
                if not all(isinstance(section.get(key), str) and section[key].strip() for key in ("id", "name", "title")) or not isinstance(section.get("materials"), list):
                    raise HTTPException(400, "课程文件夹格式错误")
                if section["id"] in ids:
                    raise HTTPException(400, "课程文件夹 ID 重复")
                ids.add(section["id"])
                for material in section["materials"]:
                    if not isinstance(material, dict) or not all(isinstance(material.get(key), str) for key in ("id", "name", "type")):
                        raise HTTPException(400, "课程资料格式错误")
    if library.get("selectedSectionId") not in ids:
        raise HTTPException(400, "请选择有效的课程文件夹")
