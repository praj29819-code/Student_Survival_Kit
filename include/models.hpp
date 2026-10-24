#pragma once

#include <string>
#include <vector>
#include <cmath>
#include <nlohmann/json.hpp>

namespace ssk {

using json = nlohmann::json;

// ============================================================================
// Data Model: User Profile
// ============================================================================
struct UserProfile {
    std::string name = "Alex Rivera";
    std::string major = "Computer Science & Engineering";
    std::string semester = "4th Semester";
    std::string college = "Apex Institute of Technology";
    int targetAttendance = 75;

    json toJson() const {
        return json{
            {"name", name},
            {"major", major},
            {"semester", semester},
            {"college", college},
            {"targetAttendance", targetAttendance}
        };
    }

    static UserProfile fromJson(const json& j) {
        UserProfile u;
        if (j.contains("name") && j["name"].is_string()) u.name = j["name"];
        if (j.contains("major") && j["major"].is_string()) u.major = j["major"];
        if (j.contains("semester") && j["semester"].is_string()) u.semester = j["semester"];
        if (j.contains("college") && j["college"].is_string()) u.college = j["college"];
        if (j.contains("targetAttendance") && j["targetAttendance"].is_number()) u.targetAttendance = j["targetAttendance"];
        return u;
    }
};

// ============================================================================
// Data Model: Assignment
// ============================================================================
struct Assignment {
    std::string id;
    std::string title;
    std::string subject;
    std::string dueDate;       // Format: "YYYY-MM-DDTHH:MM" or "YYYY-MM-DD"
    std::string priority = "medium"; // "low", "medium", "high"
    std::string status = "pending";   // "pending", "in-progress", "done"
    std::string description;
    int weightage = 10;

    json toJson() const {
        return json{
            {"id", id},
            {"title", title},
            {"subject", subject},
            {"dueDate", dueDate},
            {"priority", priority},
            {"status", status},
            {"description", description},
            {"weightage", weightage}
        };
    }

    static Assignment fromJson(const json& j) {
        Assignment a;
        if (j.contains("id") && j["id"].is_string()) a.id = j["id"];
        if (j.contains("title") && j["title"].is_string()) a.title = j["title"];
        if (j.contains("subject") && j["subject"].is_string()) a.subject = j["subject"];
        if (j.contains("dueDate") && j["dueDate"].is_string()) a.dueDate = j["dueDate"];
        if (j.contains("priority") && j["priority"].is_string()) a.priority = j["priority"];
        if (j.contains("status") && j["status"].is_string()) a.status = j["status"];
        if (j.contains("description") && j["description"].is_string()) a.description = j["description"];
        if (j.contains("weightage") && j["weightage"].is_number()) a.weightage = j["weightage"];
        return a;
    }
};

// ============================================================================
// Data Model: Subject Attendance Tracker
// ============================================================================
struct SubjectAttendance {
    std::string id;
    std::string subject;
    std::string code;
    int attended = 0;
    int total = 0;
    int minimumRequired = 75; // College standard threshold (usually 75% or 80%)

    // Calculates current attendance percentage
    double getPercentage() const {
        if (total <= 0) return 100.0;
        return (static_cast<double>(attended) / static_cast<double>(total)) * 100.0;
    }

    // Indicates if current percentage is strictly below the required threshold
    bool isAtRisk() const {
        return getPercentage() < static_cast<double>(minimumRequired);
    }

    /**
     * Bunk / Skip Calculation:
     * If current attendance >= minimumRequired%:
     * How many upcoming classes 'x' can the student skip while still staying >= target%?
     * Formula:
     *   (attended) / (total + x) >= (target / 100)
     *   attended * 100 >= target * (total + x)
     *   target * x <= (attended * 100) - (target * total)
     *   x = floor( (attended * 100 - target * total) / target )
     */
    int classesCanSkip() const {
        if (total <= 0) return 0;
        double current = getPercentage();
        if (current < static_cast<double>(minimumRequired)) return 0;
        double diff = (attended * 100.0) - (minimumRequired * total);
        int skip = static_cast<int>(std::floor(diff / static_cast<double>(minimumRequired)));
        return (skip < 0) ? 0 : skip;
    }

    /**
     * Recovery Calculation:
     * If current attendance < minimumRequired%:
     * How many consecutive upcoming classes 'y' must the student attend to restore >= target%?
     * Formula:
     *   (attended + y) / (total + y) >= (target / 100)
     *   100 * (attended + y) >= target * (total + y)
     *   (100 - target) * y >= (target * total) - (100 * attended)
     *   y = ceil( (target * total - 100 * attended) / (100 - target) )
     */
    int classesMustAttend() const {
        if (total <= 0) return 0;
        double current = getPercentage();
        if (current >= static_cast<double>(minimumRequired)) return 0;
        double diff = (minimumRequired * total) - (100.0 * attended);
        double denom = 100.0 - static_cast<double>(minimumRequired);
        if (denom <= 0.0) return 0;
        int needed = static_cast<int>(std::ceil(diff / denom));
        return (needed < 0) ? 0 : needed;
    }

    json toJson() const {
        return json{
            {"id", id},
            {"subject", subject},
            {"code", code},
            {"attended", attended},
            {"total", total},
            {"minimumRequired", minimumRequired},
            {"percentage", std::round(getPercentage() * 10.0) / 10.0},
            {"isAtRisk", isAtRisk()},
            {"classesCanSkip", classesCanSkip()},
            {"classesMustAttend", classesMustAttend()}
        };
    }

    static SubjectAttendance fromJson(const json& j) {
        SubjectAttendance s;
        if (j.contains("id") && j["id"].is_string()) s.id = j["id"];
        if (j.contains("subject") && j["subject"].is_string()) s.subject = j["subject"];
        if (j.contains("code") && j["code"].is_string()) s.code = j["code"];
        if (j.contains("attended") && j["attended"].is_number()) s.attended = j["attended"];
        if (j.contains("total") && j["total"].is_number()) s.total = j["total"];
        if (j.contains("minimumRequired") && j["minimumRequired"].is_number()) s.minimumRequired = j["minimumRequired"];
        return s;
    }
};

// ============================================================================
// Data Model: Exam
// ============================================================================
struct Exam {
    std::string id;
    std::string subject;
    std::string code;
    std::string date;         // "YYYY-MM-DD"
    std::string time;         // "HH:MM"
    std::string room;         // e.g. "Hall 302"
    std::string syllabusNotes;
    int weightage = 30;

    json toJson() const {
        return json{
            {"id", id},
            {"subject", subject},
            {"code", code},
            {"date", date},
            {"time", time},
            {"room", room},
            {"syllabusNotes", syllabusNotes},
            {"weightage", weightage}
        };
    }

    static Exam fromJson(const json& j) {
        Exam e;
        if (j.contains("id") && j["id"].is_string()) e.id = j["id"];
        if (j.contains("subject") && j["subject"].is_string()) e.subject = j["subject"];
        if (j.contains("code") && j["code"].is_string()) e.code = j["code"];
        if (j.contains("date") && j["date"].is_string()) e.date = j["date"];
        if (j.contains("time") && j["time"].is_string()) e.time = j["time"];
        if (j.contains("room") && j["room"].is_string()) e.room = j["room"];
        if (j.contains("syllabusNotes") && j["syllabusNotes"].is_string()) e.syllabusNotes = j["syllabusNotes"];
        if (j.contains("weightage") && j["weightage"].is_number()) e.weightage = j["weightage"];
        return e;
    }
};

// ============================================================================
// Data Model: Daily Task
// ============================================================================
struct Task {
    std::string id;
    std::string title;
    bool completed = false;
    std::string priority = "medium"; // "low", "medium", "high"
    std::string category = "Academic"; // "Academic", "Study", "Coding", "Personal"
    std::string dueDate;             // "YYYY-MM-DD"
    int order = 1;

    json toJson() const {
        return json{
            {"id", id},
            {"title", title},
            {"completed", completed},
            {"priority", priority},
            {"category", category},
            {"dueDate", dueDate},
            {"order", order}
        };
    }

    static Task fromJson(const json& j) {
        Task t;
        if (j.contains("id") && j["id"].is_string()) t.id = j["id"];
        if (j.contains("title") && j["title"].is_string()) t.title = j["title"];
        if (j.contains("completed") && j["completed"].is_boolean()) t.completed = j["completed"];
        if (j.contains("priority") && j["priority"].is_string()) t.priority = j["priority"];
        if (j.contains("category") && j["category"].is_string()) t.category = j["category"];
        if (j.contains("dueDate") && j["dueDate"].is_string()) t.dueDate = j["dueDate"];
        if (j.contains("order") && j["order"].is_number()) t.order = j["order"];
        return t;
    }
};

} // namespace ssk
