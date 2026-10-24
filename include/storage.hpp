#pragma once

#include <iostream>
#include <fstream>
#include <sstream>
#include <mutex>
#include <vector>
#include <algorithm>
#include <chrono>
#include <random>
#include <iomanip>
#include <filesystem>
#include "models.hpp"

namespace ssk {

namespace fs = std::filesystem;

class DatabaseManager {
public:
    static DatabaseManager& getInstance() {
        static DatabaseManager instance;
        return instance;
    }

    void init(const std::string& filepath = "data/db.json") {
        std::lock_guard<std::mutex> lock(m_mutex);
        m_filepath = filepath;

        // Ensure parent directory exists
        fs::path p(m_filepath);
        if (p.has_parent_path() && !fs::exists(p.parent_path())) {
            fs::create_directories(p.parent_path());
        }

        if (!fs::exists(m_filepath)) {
            seedDefaultData();
            saveToFileInternal();
        } else {
            loadFromFileInternal();
        }
    }

    // ========================================================================
    // User Profile
    // ========================================================================
    UserProfile getUserProfile() {
        std::lock_guard<std::mutex> lock(m_mutex);
        return m_user;
    }

    bool updateUserProfile(const UserProfile& profile) {
        std::lock_guard<std::mutex> lock(m_mutex);
        m_user = profile;
        return saveToFileInternal();
    }

    // ========================================================================
    // Assignments CRUD
    // ========================================================================
    std::vector<Assignment> getAssignments() {
        std::lock_guard<std::mutex> lock(m_mutex);
        return m_assignments;
    }

    Assignment addAssignment(Assignment a) {
        std::lock_guard<std::mutex> lock(m_mutex);
        if (a.id.empty()) {
            a.id = "asg-" + generateId();
        }
        m_assignments.push_back(a);
        saveToFileInternal();
        return a;
    }

    bool updateAssignment(const std::string& id, const Assignment& updated) {
        std::lock_guard<std::mutex> lock(m_mutex);
        for (auto& item : m_assignments) {
            if (item.id == id) {
                item = updated;
                item.id = id; // Ensure ID remains immutable
                saveToFileInternal();
                return true;
            }
        }
        return false;
    }

    bool deleteAssignment(const std::string& id) {
        std::lock_guard<std::mutex> lock(m_mutex);
        auto it = std::remove_if(m_assignments.begin(), m_assignments.end(),
            [&](const Assignment& a) { return a.id == id; });
        if (it != m_assignments.end()) {
            m_assignments.erase(it, m_assignments.end());
            saveToFileInternal();
            return true;
        }
        return false;
    }

    // ========================================================================
    // Attendance CRUD & Actions
    // ========================================================================
    std::vector<SubjectAttendance> getAttendance() {
        std::lock_guard<std::mutex> lock(m_mutex);
        return m_attendance;
    }

    SubjectAttendance addAttendance(SubjectAttendance s) {
        std::lock_guard<std::mutex> lock(m_mutex);
        if (s.id.empty()) {
            s.id = "att-" + generateId();
        }
        m_attendance.push_back(s);
        saveToFileInternal();
        return s;
    }

    bool updateAttendance(const std::string& id, const SubjectAttendance& updated) {
        std::lock_guard<std::mutex> lock(m_mutex);
        for (auto& item : m_attendance) {
            if (item.id == id) {
                item = updated;
                item.id = id;
                saveToFileInternal();
                return true;
            }
        }
        return false;
    }

    bool markAttendance(const std::string& id, bool present) {
        std::lock_guard<std::mutex> lock(m_mutex);
        for (auto& item : m_attendance) {
            if (item.id == id) {
                item.total += 1;
                if (present) {
                    item.attended += 1;
                }
                saveToFileInternal();
                return true;
            }
        }
        return false;
    }

    bool deleteAttendance(const std::string& id) {
        std::lock_guard<std::mutex> lock(m_mutex);
        auto it = std::remove_if(m_attendance.begin(), m_attendance.end(),
            [&](const SubjectAttendance& s) { return s.id == id; });
        if (it != m_attendance.end()) {
            m_attendance.erase(it, m_attendance.end());
            saveToFileInternal();
            return true;
        }
        return false;
    }

    // ========================================================================
    // Exams CRUD
    // ========================================================================
    std::vector<Exam> getExams() {
        std::lock_guard<std::mutex> lock(m_mutex);
        return m_exams;
    }

    Exam addExam(Exam e) {
        std::lock_guard<std::mutex> lock(m_mutex);
        if (e.id.empty()) {
            e.id = "ex-" + generateId();
        }
        m_exams.push_back(e);
        saveToFileInternal();
        return e;
    }

    bool updateExam(const std::string& id, const Exam& updated) {
        std::lock_guard<std::mutex> lock(m_mutex);
        for (auto& item : m_exams) {
            if (item.id == id) {
                item = updated;
                item.id = id;
                saveToFileInternal();
                return true;
            }
        }
        return false;
    }

    bool deleteExam(const std::string& id) {
        std::lock_guard<std::mutex> lock(m_mutex);
        auto it = std::remove_if(m_exams.begin(), m_exams.end(),
            [&](const Exam& e) { return e.id == id; });
        if (it != m_exams.end()) {
            m_exams.erase(it, m_exams.end());
            saveToFileInternal();
            return true;
        }
        return false;
    }

    // ========================================================================
    // Daily Tasks CRUD & Reorder
    // ========================================================================
    std::vector<Task> getTasks() {
        std::lock_guard<std::mutex> lock(m_mutex);
        std::vector<Task> sortedTasks = m_tasks;
        std::sort(sortedTasks.begin(), sortedTasks.end(),
            [](const Task& a, const Task& b) { return a.order < b.order; });
        return sortedTasks;
    }

    Task addTask(Task t) {
        std::lock_guard<std::mutex> lock(m_mutex);
        if (t.id.empty()) {
            t.id = "task-" + generateId();
        }
        if (t.order <= 0) {
            t.order = static_cast<int>(m_tasks.size()) + 1;
        }
        m_tasks.push_back(t);
        saveToFileInternal();
        return t;
    }

    bool updateTask(const std::string& id, const Task& updated) {
        std::lock_guard<std::mutex> lock(m_mutex);
        for (auto& item : m_tasks) {
            if (item.id == id) {
                item = updated;
                item.id = id;
                saveToFileInternal();
                return true;
            }
        }
        return false;
    }

    bool deleteTask(const std::string& id) {
        std::lock_guard<std::mutex> lock(m_mutex);
        auto it = std::remove_if(m_tasks.begin(), m_tasks.end(),
            [&](const Task& t) { return t.id == id; });
        if (it != m_tasks.end()) {
            m_tasks.erase(it, m_tasks.end());
            // Re-normalize orders
            for (size_t i = 0; i < m_tasks.size(); ++i) {
                m_tasks[i].order = static_cast<int>(i + 1);
            }
            saveToFileInternal();
            return true;
        }
        return false;
    }

    bool reorderTasks(const std::vector<std::string>& orderedIds) {
        std::lock_guard<std::mutex> lock(m_mutex);
        for (size_t i = 0; i < orderedIds.size(); ++i) {
            for (auto& task : m_tasks) {
                if (task.id == orderedIds[i]) {
                    task.order = static_cast<int>(i + 1);
                    break;
                }
            }
        }
        return saveToFileInternal();
    }

    // ========================================================================
    // Dashboard Aggregation
    // ========================================================================
    json getDashboard() {
        std::lock_guard<std::mutex> lock(m_mutex);

        // 1. Task metrics
        int totalTasks = static_cast<int>(m_tasks.size());
        int completedTasks = 0;
        for (const auto& t : m_tasks) {
            if (t.completed) completedTasks++;
        }
        double taskCompletionRate = (totalTasks > 0)
            ? (static_cast<double>(completedTasks) / totalTasks) * 100.0 : 100.0;

        // 2. Assignment metrics
        int totalAssignments = static_cast<int>(m_assignments.size());
        int pendingAssignments = 0;
        int inProgressAssignments = 0;
        int completedAssignments = 0;
        for (const auto& a : m_assignments) {
            if (a.status == "done") completedAssignments++;
            else if (a.status == "in-progress") inProgressAssignments++;
            else pendingAssignments++;
        }
        double assignmentHealthRate = (totalAssignments > 0)
            ? ((completedAssignments + inProgressAssignments * 0.6) / totalAssignments) * 100.0 : 100.0;

        // 3. Attendance metrics
        int totalClasses = 0;
        int attendedClasses = 0;
        int atRiskCount = 0;
        int safeCount = 0;
        for (const auto& att : m_attendance) {
            totalClasses += att.total;
            attendedClasses += att.attended;
            if (att.isAtRisk()) atRiskCount++;
            else safeCount++;
        }
        double overallAttendance = (totalClasses > 0)
            ? (static_cast<double>(attendedClasses) / totalClasses) * 100.0 : 100.0;
        double attendanceHealthScore = std::min(100.0, (overallAttendance / 75.0) * 100.0);

        // 4. Composite Productivity Score (0 to 100)
        // Weighted: 40% tasks, 35% assignments, 25% attendance
        double compositeProductivity = (0.40 * taskCompletionRate) +
                                      (0.35 * assignmentHealthRate) +
                                      (0.25 * attendanceHealthScore);
        int finalScore = std::clamp(static_cast<int>(std::round(compositeProductivity)), 0, 100);

        std::string scoreRating = "Needs Attention";
        if (finalScore >= 85) scoreRating = "Exceptional";
        else if (finalScore >= 70) scoreRating = "On Track";
        else if (finalScore >= 50) scoreRating = "Moderate";

        // 5. Sorted Upcoming Deadlines (Assignments and Exams due next 7 days)
        // Build JSON representation for frontend
        json upcomingDeadlines = json::array();
        for (const auto& a : m_assignments) {
            if (a.status != "done") {
                upcomingDeadlines.push_back({
                    {"id", a.id},
                    {"type", "assignment"},
                    {"title", a.title},
                    {"subject", a.subject},
                    {"dueDate", a.dueDate},
                    {"priority", a.priority},
                    {"status", a.status}
                });
            }
        }
        for (const auto& e : m_exams) {
            upcomingDeadlines.push_back({
                {"id", e.id},
                {"type", "exam"},
                {"title", e.subject + " (" + e.code + ")"},
                {"subject", e.subject},
                {"dueDate", e.date + "T" + e.time},
                {"priority", "high"},
                {"room", e.room}
            });
        }

        // 6. Nearest Exam
        json nearestExam = json::object();
        if (!m_exams.empty()) {
            nearestExam = m_exams.front().toJson();
        }

        // Today's tasks (sorted by order)
        json todayTasksJson = json::array();
        for (const auto& t : m_tasks) {
            todayTasksJson.push_back(t.toJson());
        }

        return json{
            {"user", m_user.toJson()},
            {"productivity", {
                {"score", finalScore},
                {"rating", scoreRating},
                {"taskRate", std::round(taskCompletionRate)},
                {"assignmentRate", std::round(assignmentHealthRate)},
                {"attendanceRate", std::round(overallAttendance * 10.0) / 10.0}
            }},
            {"attendanceSummary", {
                {"overallPercentage", std::round(overallAttendance * 10.0) / 10.0},
                {"totalClasses", totalClasses},
                {"attendedClasses", attendedClasses},
                {"missedClasses", totalClasses - attendedClasses},
                {"atRiskCount", atRiskCount},
                {"safeCount", safeCount},
                {"targetPercentage", m_user.targetAttendance}
            }},
            {"counts", {
                {"totalAssignments", totalAssignments},
                {"pendingAssignments", pendingAssignments},
                {"totalTasks", totalTasks},
                {"completedTasks", completedTasks},
                {"totalExams", static_cast<int>(m_exams.size())},
                {"totalSubjects", static_cast<int>(m_attendance.size())}
            }},
            {"todayTasks", todayTasksJson},
            {"upcomingDeadlines", upcomingDeadlines},
            {"nearestExam", nearestExam}
        };
    }

    // Returns a full JSON dump of the DB, handy for AI context
    json getFullDatabaseJson() {
        std::lock_guard<std::mutex> lock(m_mutex);
        json root;
        root["user"] = m_user.toJson();

        json asg = json::array();
        for (const auto& a : m_assignments) asg.push_back(a.toJson());
        root["assignments"] = asg;

        json att = json::array();
        for (const auto& s : m_attendance) att.push_back(s.toJson());
        root["attendance"] = att;

        json ex = json::array();
        for (const auto& e : m_exams) ex.push_back(e.toJson());
        root["exams"] = ex;

        json tk = json::array();
        for (const auto& t : m_tasks) tk.push_back(t.toJson());
        root["tasks"] = tk;

        return root;
    }

private:
    DatabaseManager() = default;
    ~DatabaseManager() = default;
    DatabaseManager(const DatabaseManager&) = delete;
    DatabaseManager& operator=(const DatabaseManager&) = delete;

    std::mutex m_mutex;
    std::string m_filepath = "data/db.json";

    UserProfile m_user;
    std::vector<Assignment> m_assignments;
    std::vector<SubjectAttendance> m_attendance;
    std::vector<Exam> m_exams;
    std::vector<Task> m_tasks;

    std::string generateId() {
        static std::mt19937_64 rng(std::chrono::system_clock::now().time_since_epoch().count());
        static std::uniform_int_distribution<uint64_t> dist(100000, 999999);
        return std::to_string(dist(rng));
    }

    void seedDefaultData() {
        m_user = UserProfile{
            "Alex Rivera",
            "Computer Science & Engineering",
            "4th Semester",
            "Apex Institute of Technology",
            75
        };

        m_assignments = {
            {"asg-1", "Red-Black Tree & AVL Tree Implementation", "Data Structures & Algorithms", "2026-10-28T23:59", "high", "in-progress", "Implement insertion, deletion, and rotation operations in C++ with unit tests.", 15},
            {"asg-2", "Process Synchronization & Semaphores Lab", "Operating Systems", "2026-10-26T17:00", "high", "pending", "Solve Dining Philosophers and Producer-Consumer using POSIX semaphores.", 10},
            {"asg-3", "Normalized Database Schema (3NF/BCNF) Design", "Database Management Systems", "2026-11-02T23:59", "medium", "pending", "Design relational schema and normalize to BCNF.", 12},
            {"asg-4", "Subnetting & Packet Tracer Simulation", "Computer Networks", "2026-10-23T23:59", "medium", "done", "Configure static routing and test end-to-end ping across 3 routers.", 8},
            {"asg-5", "Eigenvalues & Markov Chains Case Study", "Discrete Mathematics & Linear Algebra", "2026-11-06T18:00", "low", "pending", "Compute PageRank steady state vectors using matrix exponentiation.", 10}
        };

        m_attendance = {
            {"att-1", "Data Structures & Algorithms", "CS401", 28, 32, 75},
            {"att-2", "Operating Systems", "CS402", 21, 30, 75},
            {"att-3", "Database Management Systems", "CS403", 25, 28, 75},
            {"att-4", "Computer Networks", "CS404", 18, 26, 75},
            {"att-5", "Discrete Mathematics & Linear Algebra", "MA401", 24, 27, 75}
        };

        m_exams = {
            {"ex-1", "Operating Systems Mid-Term", "CS402", "2026-11-05", "09:30", "Auditorium Hall B", "Processes, CPU Scheduling, Deadlock Detection, Paging", 30},
            {"ex-2", "Data Structures Final Lab Exam", "CS401", "2026-11-12", "14:00", "CS Lab 3", "Graph Traversals (BFS, DFS), Dijkstra, DSU, DP on Trees", 25},
            {"ex-3", "Database Management Systems Theory", "CS403", "2026-11-19", "10:00", "Block 4 - Room 402", "Relational Algebra, SQL Joins, B+ Trees, ACID Concurrency", 35}
        };

        m_tasks = {
            {"task-1", "Complete POSIX Semaphores lab report for OS", false, "high", "Academic", "2026-10-25", 1},
            {"task-2", "Revise B+ Tree indexing & transaction ACID properties", false, "medium", "Study", "2026-10-25", 2},
            {"task-3", "Solve 3 LeetCode problems on Dynamic Programming", true, "medium", "Coding", "2026-10-24", 3},
            {"task-4", "Submit Wireshark packet capture analysis sheet", true, "low", "Academic", "2026-10-24", 4},
            {"task-5", "Print semester registration and exam admit card", false, "low", "Personal", "2026-10-26", 5}
        };
    }

    bool saveToFileInternal() {
        try {
            json root;
            root["user"] = m_user.toJson();

            json asg = json::array();
            for (const auto& a : m_assignments) asg.push_back(a.toJson());
            root["assignments"] = asg;

            json att = json::array();
            for (const auto& s : m_attendance) att.push_back(s.toJson());
            root["attendance"] = att;

            json ex = json::array();
            for (const auto& e : m_exams) ex.push_back(e.toJson());
            root["exams"] = ex;

            json tk = json::array();
            for (const auto& t : m_tasks) tk.push_back(t.toJson());
            root["tasks"] = tk;

            std::ofstream file(m_filepath);
            if (!file.is_open()) return false;
            file << root.dump(2);
            file.close();
            return true;
        } catch (const std::exception& e) {
            std::cerr << "[DatabaseManager Error] Save failed: " << e.what() << std::endl;
            return false;
        }
    }

    bool loadFromFileInternal() {
        try {
            std::ifstream file(m_filepath);
            if (!file.is_open()) return false;
            json root;
            file >> root;
            file.close();

            if (root.contains("user")) {
                m_user = UserProfile::fromJson(root["user"]);
            }

            m_assignments.clear();
            if (root.contains("assignments") && root["assignments"].is_array()) {
                for (const auto& item : root["assignments"]) {
                    m_assignments.push_back(Assignment::fromJson(item));
                }
            }

            m_attendance.clear();
            if (root.contains("attendance") && root["attendance"].is_array()) {
                for (const auto& item : root["attendance"]) {
                    m_attendance.push_back(SubjectAttendance::fromJson(item));
                }
            }

            m_exams.clear();
            if (root.contains("exams") && root["exams"].is_array()) {
                for (const auto& item : root["exams"]) {
                    m_exams.push_back(Exam::fromJson(item));
                }
            }

            m_tasks.clear();
            if (root.contains("tasks") && root["tasks"].is_array()) {
                for (const auto& item : root["tasks"]) {
                    m_tasks.push_back(Task::fromJson(item));
                }
            }
            return true;
        } catch (const std::exception& e) {
            std::cerr << "[DatabaseManager Error] Load failed: " << e.what() << std::endl;
            return false;
        }
    }
};

} // namespace ssk
