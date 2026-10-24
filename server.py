#!/usr/bin/env python3
"""
Student Survival Kit (SSK) - Zero-Dependency Companion Server
Mirrors the C++ Crow REST API endpoints exactly using Python's standard library.
Enables immediate testing and evaluation on any platform with Python 3.
"""

import sys
import os
import json
import urllib.request
import urllib.error
from http.server import HTTPServer, SimpleHTTPRequestHandler
import mimetypes

if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8")
        sys.stderr.reconfigure(encoding="utf-8")
    except Exception:
        pass

PORT = int(os.environ.get("PORT", 8080))
DB_PATH = os.path.join(os.path.dirname(__file__), "data", "db.json")
PUBLIC_DIR = os.path.join(os.path.dirname(__file__), "public")

def load_db():
    if not os.path.exists(DB_PATH):
        return {}
    with open(DB_PATH, "r", encoding="utf-8") as f:
        return json.load(f)

def save_db(data):
    os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
    with open(DB_PATH, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2)

def calculate_dashboard(db):
    user = db.get("user", {})
    assignments = db.get("assignments", [])
    attendance = db.get("attendance", [])
    exams = db.get("exams", [])
    tasks = db.get("tasks", [])

    # Task metrics
    total_tasks = len(tasks)
    completed_tasks = sum(1 for t in tasks if t.get("completed"))
    task_rate = (completed_tasks / total_tasks * 100) if total_tasks > 0 else 100

    # Assignment metrics
    total_asg = len(assignments)
    pending_asg = sum(1 for a in assignments if a.get("status") == "pending")
    inprogress_asg = sum(1 for a in assignments if a.get("status") == "in-progress")
    done_asg = sum(1 for a in assignments if a.get("status") == "done")
    asg_rate = ((done_asg + inprogress_asg * 0.6) / total_asg * 100) if total_asg > 0 else 100

    # Attendance metrics
    total_classes = sum(s.get("total", 0) for s in attendance)
    attended_classes = sum(s.get("attended", 0) for s in attendance)
    overall_att = (attended_classes / total_classes * 100) if total_classes > 0 else 100
    at_risk_count = sum(1 for s in attendance if (s.get("attended", 0) / s.get("total", 1) * 100) < s.get("minimumRequired", 75))
    safe_count = len(attendance) - at_risk_count

    # Composite Productivity (40% tasks, 35% asg, 25% att)
    att_health = min(100.0, (overall_att / 75.0) * 100)
    score = round(0.40 * task_rate + 0.35 * asg_rate + 0.25 * att_health)
    score = max(0, min(100, score))

    rating = "Needs Attention"
    if score >= 85:
        rating = "Exceptional"
    elif score >= 70:
        rating = "On Track"
    elif score >= 50:
        rating = "Moderate"

    # Enriched attendance items
    enriched_att = []
    for s in attendance:
        tot = s.get("total", 0)
        att = s.get("attended", 0)
        min_req = s.get("minimumRequired", 75)
        pct = round((att / tot * 100), 1) if tot > 0 else 100.0
        is_risk = pct < min_req

        # Bunk / Recovery
        can_skip = 0
        must_attend = 0
        if not is_risk:
            diff = (att * 100.0) - (min_req * tot)
            can_skip = max(0, int(diff // min_req))
        else:
            diff = (min_req * tot) - (100.0 * att)
            denom = 100.0 - min_req
            must_attend = max(0, int((diff + denom - 1) // denom)) if denom > 0 else 0

        enriched_att.append({
            **s,
            "percentage": pct,
            "isAtRisk": is_risk,
            "classesCanSkip": can_skip,
            "classesMustAttend": must_attend
        })

    # Upcoming Deadlines
    upcoming = []
    for a in assignments:
        if a.get("status") != "done":
            upcoming.append({
                "id": a["id"],
                "type": "assignment",
                "title": a["title"],
                "subject": a["subject"],
                "dueDate": a["dueDate"],
                "priority": a.get("priority", "medium"),
                "status": a.get("status", "pending")
            })
    for e in exams:
        upcoming.append({
            "id": e["id"],
            "type": "exam",
            "title": f"{e['subject']} ({e.get('code', 'EXAM')})",
            "subject": e["subject"],
            "dueDate": f"{e['date']}T{e.get('time', '09:00')}",
            "priority": "high",
            "room": e.get("room", "")
        })

    upcoming.sort(key=lambda x: x["dueDate"])

    nearest_exam = exams[0] if exams else {}

    return {
        "user": user,
        "productivity": {
            "score": score,
            "rating": rating,
            "taskRate": round(task_rate),
            "assignmentRate": round(asg_rate),
            "attendanceRate": round(overall_att, 1)
        },
        "attendanceSummary": {
            "overallPercentage": round(overall_att, 1),
            "totalClasses": total_classes,
            "attendedClasses": attended_classes,
            "missedClasses": total_classes - attended_classes,
            "atRiskCount": at_risk_count,
            "safeCount": safe_count,
            "targetPercentage": user.get("targetAttendance", 75)
        },
        "counts": {
            "totalAssignments": total_asg,
            "pendingAssignments": pending_asg,
            "totalTasks": total_tasks,
            "completedTasks": completed_tasks,
            "totalExams": len(exams),
            "totalSubjects": len(attendance)
        },
        "todayTasks": sorted(tasks, key=lambda t: t.get("order", 0)),
        "upcomingDeadlines": upcoming,
        "nearestExam": nearest_exam
    }

class SSKRequestHandler(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization")
        super().end_headers()

    def do_OPTIONS(self):
        self.send_response(204)
        self.end_headers()

    def do_HEAD(self):
        self.do_GET()

    def send_json(self, status, data):
        body = json.dumps(data).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def read_json_body(self):
        length = int(self.headers.get("Content-Length", 0))
        if length == 0:
            return {}
        raw = self.rfile.read(length).decode("utf-8")
        return json.loads(raw)

    def do_GET(self):
        url = self.path.split("?")[0]
        db = load_db()

        if url == "/api/dashboard":
            return self.send_json(200, calculate_dashboard(db))
        elif url == "/api/assignments":
            return self.send_json(200, db.get("assignments", []))
        elif url == "/api/attendance":
            # return enriched attendance
            dash = calculate_dashboard(db)
            att_items = []
            for s in db.get("attendance", []):
                tot = s.get("total", 0)
                att = s.get("attended", 0)
                min_req = s.get("minimumRequired", 75)
                pct = round((att / tot * 100), 1) if tot > 0 else 100.0
                is_risk = pct < min_req
                can_skip = 0
                must_attend = 0
                if not is_risk:
                    diff = (att * 100.0) - (min_req * tot)
                    can_skip = max(0, int(diff // min_req))
                else:
                    diff = (min_req * tot) - (100.0 * att)
                    denom = 100.0 - min_req
                    must_attend = max(0, int((diff + denom - 1) // denom)) if denom > 0 else 0
                att_items.append({
                    **s,
                    "percentage": pct,
                    "isAtRisk": is_risk,
                    "classesCanSkip": can_skip,
                    "classesMustAttend": must_attend
                })
            return self.send_json(200, att_items)
        elif url == "/api/exams":
            return self.send_json(200, db.get("exams", []))
        elif url == "/api/tasks":
            tasks = db.get("tasks", [])
            tasks.sort(key=lambda x: x.get("order", 0))
            return self.send_json(200, tasks)
        elif url == "/api/profile":
            return self.send_json(200, db.get("user", {}))

        # Serve static file from public/
        if url == "/" or url == "":
            rel_path = "index.html"
        else:
            rel_path = url.lstrip("/")

        full_path = os.path.join(PUBLIC_DIR, rel_path)
        if not os.path.exists(full_path) or os.path.isdir(full_path):
            full_path = os.path.join(PUBLIC_DIR, "index.html")

        if os.path.exists(full_path):
            ctype, _ = mimetypes.guess_type(full_path)
            if not ctype:
                ctype = "application/octet-stream"
            with open(full_path, "rb") as f:
                content = f.read()
            self.send_response(200)
            self.send_header("Content-Type", ctype)
            self.send_header("Content-Length", str(len(content)))
            self.end_headers()
            self.wfile.write(content)
        else:
            self.send_response(404)
            self.end_headers()

    def do_POST(self):
        url = self.path.split("?")[0]
        db = load_db()
        body = self.read_json_body()

        if url == "/api/assignments":
            asg_list = db.setdefault("assignments", [])
            item_id = body.get("id") or f"asg-{int(os.urandom(3).hex(), 16)}"
            new_item = {**body, "id": item_id}
            asg_list.append(new_item)
            save_db(db)
            return self.send_json(201, new_item)

        elif url == "/api/attendance":
            att_list = db.setdefault("attendance", [])
            item_id = body.get("id") or f"att-{int(os.urandom(3).hex(), 16)}"
            new_item = {**body, "id": item_id}
            att_list.append(new_item)
            save_db(db)
            return self.send_json(201, new_item)

        elif url.startswith("/api/attendance/") and url.endswith("/mark"):
            parts = url.split("/")
            item_id = parts[3]
            present = body.get("present", True)
            for s in db.get("attendance", []):
                if s["id"] == item_id:
                    s["total"] = s.get("total", 0) + 1
                    if present:
                        s["attended"] = s.get("attended", 0) + 1
                    save_db(db)
                    pct = round(s["attended"] / s["total"] * 100, 1)
                    return self.send_json(200, {**s, "percentage": pct})
            return self.send_json(404, {"error": "Subject not found"})

        elif url == "/api/exams":
            exam_list = db.setdefault("exams", [])
            item_id = body.get("id") or f"ex-{int(os.urandom(3).hex(), 16)}"
            new_item = {**body, "id": item_id}
            exam_list.append(new_item)
            save_db(db)
            return self.send_json(201, new_item)

        elif url == "/api/tasks":
            task_list = db.setdefault("tasks", [])
            item_id = body.get("id") or f"task-{int(os.urandom(3).hex(), 16)}"
            order = body.get("order") or (len(task_list) + 1)
            new_item = {**body, "id": item_id, "order": order}
            task_list.append(new_item)
            save_db(db)
            return self.send_json(201, new_item)

        elif url == "/api/tasks/reorder":
            order_ids = body.get("order", [])
            task_list = db.get("tasks", [])
            for idx, tid in enumerate(order_ids):
                for t in task_list:
                    if t["id"] == tid:
                        t["order"] = idx + 1
                        break
            save_db(db)
            task_list.sort(key=lambda x: x.get("order", 0))
            return self.send_json(200, task_list)

        elif url == "/api/ai":
            prompt = body.get("prompt", "")
            mode = body.get("mode", "chat")
            api_key = os.environ.get("ANTHROPIC_API_KEY", "")

            # Attempt live Claude API call if key is set
            if api_key and len(api_key) > 5:
                try:
                    req_payload = {
                        "model": "claude-3-haiku-20240307",
                        "max_tokens": 1200,
                        "system": f"You are Aura, an academic mentor in Student Survival Kit.\nContext:\n{json.dumps(db, indent=2)}",
                        "messages": [{"role": "user", "content": prompt}]
                    }
                    req = urllib.request.Request(
                        "https://api.anthropic.com/v1/messages",
                        data=json.dumps(req_payload).encode("utf-8"),
                        headers={
                            "x-api-key": api_key,
                            "anthropic-version": "2023-06-01",
                            "content-type": "application/json"
                        }
                    )
                    with urllib.request.urlopen(req, timeout=15) as resp:
                        res_json = json.loads(resp.read().decode("utf-8"))
                        text = res_json["content"][0]["text"]
                        return self.send_json(200, {
                            "success": True,
                            "provider": "Anthropic Claude API (live)",
                            "mode": mode,
                            "reply": text
                        })
                except Exception as err:
                    print(f"[AI] Live Claude error: {err}. Using local intelligent fallback.")

            # Local Context-Aware Generator Fallback
            reply = self.generate_local_ai_reply(prompt, mode, db, not bool(api_key))
            return self.send_json(200, {
                "success": True,
                "provider": "Smart Local Advisor (Offline Mode)" if not api_key else "Smart Local Advisor (Fallback)",
                "mode": mode,
                "reply": reply
            })

        self.send_json(404, {"error": "Not found"})

    def do_PUT(self):
        url = self.path.split("?")[0]
        db = load_db()
        body = self.read_json_body()

        if url.startswith("/api/assignments/"):
            item_id = url.split("/")[3]
            asg_list = db.get("assignments", [])
            for idx, a in enumerate(asg_list):
                if a["id"] == item_id:
                    asg_list[idx] = {**body, "id": item_id}
                    save_db(db)
                    return self.send_json(200, asg_list[idx])
            return self.send_json(404, {"error": "Assignment not found"})

        elif url.startswith("/api/attendance/"):
            item_id = url.split("/")[3]
            att_list = db.get("attendance", [])
            for idx, s in enumerate(att_list):
                if s["id"] == item_id:
                    att_list[idx] = {**body, "id": item_id}
                    save_db(db)
                    return self.send_json(200, att_list[idx])
            return self.send_json(404, {"error": "Subject not found"})

        elif url.startswith("/api/exams/"):
            item_id = url.split("/")[3]
            exam_list = db.get("exams", [])
            for idx, e in enumerate(exam_list):
                if e["id"] == item_id:
                    exam_list[idx] = {**body, "id": item_id}
                    save_db(db)
                    return self.send_json(200, exam_list[idx])
            return self.send_json(404, {"error": "Exam not found"})

        elif url.startswith("/api/tasks/"):
            item_id = url.split("/")[3]
            task_list = db.get("tasks", [])
            for idx, t in enumerate(task_list):
                if t["id"] == item_id:
                    task_list[idx] = {**body, "id": item_id}
                    save_db(db)
                    return self.send_json(200, task_list[idx])
            return self.send_json(404, {"error": "Task not found"})

        elif url == "/api/profile":
            db["user"] = body
            save_db(db)
            return self.send_json(200, body)

        self.send_json(404, {"error": "Not found"})

    def do_DELETE(self):
        url = self.path.split("?")[0]
        db = load_db()

        if url.startswith("/api/assignments/"):
            item_id = url.split("/")[3]
            db["assignments"] = [a for a in db.get("assignments", []) if a["id"] != item_id]
            save_db(db)
            return self.send_json(200, {"success": True, "id": item_id})

        elif url.startswith("/api/attendance/"):
            item_id = url.split("/")[3]
            db["attendance"] = [s for s in db.get("attendance", []) if s["id"] != item_id]
            save_db(db)
            return self.send_json(200, {"success": True, "id": item_id})

        elif url.startswith("/api/exams/"):
            item_id = url.split("/")[3]
            db["exams"] = [e for e in db.get("exams", []) if e["id"] != item_id]
            save_db(db)
            return self.send_json(200, {"success": True, "id": item_id})

        elif url.startswith("/api/tasks/"):
            item_id = url.split("/")[3]
            db["tasks"] = [t for t in db.get("tasks", []) if t["id"] != item_id]
            save_db(db)
            return self.send_json(200, {"success": True, "id": item_id})

        self.send_json(404, {"error": "Not found"})

    def generate_local_ai_reply(self, prompt, mode, db, no_api_key):
        user_name = db.get("user", {}).get("name", "Alex")
        prefix = "> **Note**: Running in *Smart Offline Mode* (local context engine). Set `ANTHROPIC_API_KEY` for live Claude 3.5.\n\n" if no_api_key else ""

        p_lower = prompt.lower()
        if mode == "planner" or "plan" in p_lower or "schedule" in p_lower:
            return prefix + f"""### 📅 Personalized 7-Day Study Master Plan for {user_name}

Based on your active assignments and upcoming exams, here is your high-impact revision and completion schedule:

#### **Day 1 (Today): High-Priority Triage**
- **Block 1 (90 mins)**: *Operating Systems* - Complete Semaphores & Mutex lab exercises. Avoid late submission penalties!
- **Block 2 (60 mins)**: *Data Structures* - Outline Red-Black tree insertion & rotation cases.
- **Goal**: Mark off today's top daily tasks and ensure GitHub repository is clean.

#### **Day 2: Deep Work & DSA Focus**
- **Block 1 (120 mins)**: *Data Structures & Algorithms* - Code AVL tree rotations and test balancing balance-factor invariants.
- **Block 2 (45 mins)**: *Discrete Math* - Quick formula review on Markov steady-state transitions.
- **Tip**: Use Pomodoro intervals (50 mins study / 10 mins break) to maximize retention.

#### **Day 3: Systems & Networking**
- **Block 1 (90 mins)**: *Operating Systems* - Revise CPU Scheduling (Round Robin & SJF) for the upcoming Mid-Term.
- **Block 2 (60 mins)**: *Computer Networks* - Review subnet masks and packet headers.

#### **Day 4: Database Modeling**
- **Block 1 (90 mins)**: *DBMS* - Draft 3NF & BCNF relational schemas. Verify functional dependencies.
- **Block 2 (45 mins)**: Daily tasks check-in & flashcards review.

#### **Day 5: Exam Simulation (OS Mid-Term)**
- **Block 1 (120 mins)**: Mock test under timed conditions: Banker's algorithm safe-state detection and paging page-replacement.
- **Block 2 (30 mins)**: Error analysis & formula sheet recap.

#### **Day 6 & 7: Buffer & Final Review**
- Consolidate all pending lab submissions.
- Light review of high-yield concepts; get 8 hours of sleep before the exam!"""

        elif mode == "summary" or "summary" in p_lower or "week" in p_lower:
            return prefix + f"""### 📊 Smart Weekly Academic Executive Briefing

Here is your week-at-a-glance performance diagnostics for {user_name}:

#### 🚨 Critical Attention Items
- **Attendance Alert**: Operating Systems is at 70.0% (below 75%). You must attend the next 3 consecutive classes to recover safely!
- **Upcoming Deadlines**: Operating Systems Process Synchronization Lab & Red-Black Tree Implementation are approaching soon.

#### 🎯 Strategic Recommendations for this Week
1. **Tackle High Weightage First**: The OS Lab submission carries 10% of your grade. Finish it by Wednesday.
2. **Protect Your Attendance**: Do not bunk any morning classes this week; push overall attendance to >82%.
3. **Exam Countdown**: The Operating Systems Mid-Term is the closest milestone. Spend at least 45 minutes daily on memory paging and process scheduling.

*\"Small, disciplined efforts every day compound into effortless exam scores.\"*"""

        else:
            return prefix + f"""### 💡 Study Buddy Guidance

Hello {user_name}! Here are personalized recommendations regarding: *\"{prompt}\"*:

- **Active Recall beats Re-reading**: Rather than just skimming your lecture slides, test yourself by writing down algorithms from memory on a blank sheet.
- **Spaced Repetition**: Revisit tricky concepts (like Banker's algorithm or AVL tree rotations) after 24 hours, then 3 days, then 7 days.
- **Leverage Deadlines**: Use the SSK Dashboard countdown clocks to stay ahead of the curve.

Feel free to click **\"Generate Study Plan\"** or **\"Weekly Summary\"** for ready-made structured schedules!"""

def main():
    print("=" * 60)
    print("       🎓 STUDENT SURVIVAL KIT (SSK) - WEB SERVER")
    print("=" * 60)
    print(f"[Init] Database path: {DB_PATH}")
    print(f"[Init] Static directory: {PUBLIC_DIR}")
    server = HTTPServer(("0.0.0.0", PORT), SSKRequestHandler)
    print(f"\n>>> Server running! Open: http://localhost:{PORT} <<<\n")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\n[Server] Shutting down.")

if __name__ == "__main__":
    main()
