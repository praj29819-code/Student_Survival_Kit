#pragma once

#include <crow.h>
#include <fstream>
#include <filesystem>
#include <nlohmann/json.hpp>
#include "models.hpp"
#include "storage.hpp"
#include "ai_service.hpp"

namespace ssk {

using json = nlohmann::json;
namespace fs = std::filesystem;

// ============================================================================
// HTTP Helper Functions (CORS & JSON Responses)
// ============================================================================
inline crow::response makeJsonResponse(int status, const json& j) {
    crow::response res(status, j.dump());
    res.add_header("Content-Type", "application/json");
    res.add_header("Access-Control-Allow-Origin", "*");
    res.add_header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    res.add_header("Access-Control-Allow-Headers", "Content-Type, Authorization");
    return res;
}

inline crow::response makeOptionsResponse() {
    crow::response res(204);
    res.add_header("Access-Control-Allow-Origin", "*");
    res.add_header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    res.add_header("Access-Control-Allow-Headers", "Content-Type, Authorization");
    return res;
}

inline crow::response serveStaticFile(const std::string& path) {
    std::string safe = path.empty() ? "index.html" : path;

    // Security: sanitize against directory traversal
    if (safe.find("..") != std::string::npos) {
        return crow::response(403, "Forbidden");
    }

    std::string fullPath = "public/" + safe;
    if (!fs::exists(fullPath) || fs::is_directory(fullPath)) {
        // Fallback for SPA routing if not found: serve index.html
        fullPath = "public/index.html";
        if (!fs::exists(fullPath)) {
            return crow::response(404, "Not Found");
        }
    }

    std::ifstream file(fullPath, std::ios::binary);
    if (!file.is_open()) {
        return crow::response(500, "Internal Server Error");
    }

    std::string content((std::istreambuf_iterator<char>(file)),
                         std::istreambuf_iterator<char>());
    crow::response res(200, content);

    std::string ext = fs::path(fullPath).extension().string();
    if (ext == ".html") res.add_header("Content-Type", "text/html; charset=utf-8");
    else if (ext == ".css") res.add_header("Content-Type", "text/css; charset=utf-8");
    else if (ext == ".js") res.add_header("Content-Type", "application/javascript; charset=utf-8");
    else if (ext == ".json") res.add_header("Content-Type", "application/json");
    else if (ext == ".svg") res.add_header("Content-Type", "image/svg+xml");
    else if (ext == ".png") res.add_header("Content-Type", "image/png");
    else if (ext == ".ico") res.add_header("Content-Type", "image/x-icon");

    res.add_header("Access-Control-Allow-Origin", "*");
    return res;
}

// ============================================================================
// Register All API & Static Routes
// ============================================================================
inline void registerRoutes(crow::SimpleApp& app) {
    auto& db = DatabaseManager::getInstance();
    auto& ai = AIService::getInstance();

    // ------------------------------------------------------------------------
    // Static Files
    // ------------------------------------------------------------------------
    CROW_ROUTE(app, "/")
    ([]() {
        return serveStaticFile("index.html");
    });

    CROW_ROUTE(app, "/<path>")
    ([](const std::string& path) {
        if (path.rfind("api/", 0) == 0) {
            return crow::response(404, "API route not found");
        }
        return serveStaticFile(path);
    });

    // ------------------------------------------------------------------------
    // Dashboard API: GET /api/dashboard
    // ------------------------------------------------------------------------
    CROW_ROUTE(app, "/api/dashboard")
    .methods(crow::HTTPMethod::GET, crow::HTTPMethod::OPTIONS)
    ([&db](const crow::request& req) {
        if (req.method == crow::HTTPMethod::OPTIONS) return makeOptionsResponse();
        try {
            json dash = db.getDashboard();
            return makeJsonResponse(200, dash);
        } catch (const std::exception& e) {
            return makeJsonResponse(500, json{{"error", e.what()}});
        }
    });

    // ------------------------------------------------------------------------
    // Assignments API: GET, POST /api/assignments
    // ------------------------------------------------------------------------
    CROW_ROUTE(app, "/api/assignments")
    .methods(crow::HTTPMethod::GET, crow::HTTPMethod::POST, crow::HTTPMethod::OPTIONS)
    ([&db](const crow::request& req) {
        if (req.method == crow::HTTPMethod::OPTIONS) return makeOptionsResponse();

        if (req.method == crow::HTTPMethod::GET) {
            auto list = db.getAssignments();
            json arr = json::array();
            for (const auto& a : list) arr.push_back(a.toJson());
            return makeJsonResponse(200, arr);
        }

        if (req.method == crow::HTTPMethod::POST) {
            try {
                json body = json::parse(req.body);
                if (!body.contains("title") || body["title"].get<std::string>().empty()) {
                    return makeJsonResponse(400, json{{"error", "Assignment title is required"}});
                }
                Assignment a = Assignment::fromJson(body);
                Assignment created = db.addAssignment(a);
                return makeJsonResponse(201, created.toJson());
            } catch (const std::exception& e) {
                return makeJsonResponse(400, json{{"error", std::string("Invalid JSON: ") + e.what()}});
            }
        }

        return makeJsonResponse(405, json{{"error", "Method not allowed"}});
    });

    // Assignments API: PUT, DELETE /api/assignments/<id>
    CROW_ROUTE(app, "/api/assignments/<string>")
    .methods(crow::HTTPMethod::PUT, crow::HTTPMethod::DELETE, crow::HTTPMethod::OPTIONS)
    ([&db](const crow::request& req, const std::string& id) {
        if (req.method == crow::HTTPMethod::OPTIONS) return makeOptionsResponse();

        if (req.method == crow::HTTPMethod::PUT) {
            try {
                json body = json::parse(req.body);
                Assignment a = Assignment::fromJson(body);
                bool ok = db.updateAssignment(id, a);
                if (ok) return makeJsonResponse(200, a.toJson());
                return makeJsonResponse(404, json{{"error", "Assignment not found"}});
            } catch (const std::exception& e) {
                return makeJsonResponse(400, json{{"error", std::string("Invalid JSON: ") + e.what()}});
            }
        }

        if (req.method == crow::HTTPMethod::DELETE) {
            bool ok = db.deleteAssignment(id);
            if (ok) return makeJsonResponse(200, json{{"success", true}, {"id", id}});
            return makeJsonResponse(404, json{{"error", "Assignment not found"}});
        }

        return makeJsonResponse(405, json{{"error", "Method not allowed"}});
    });

    // ------------------------------------------------------------------------
    // Attendance API: GET, POST /api/attendance
    // ------------------------------------------------------------------------
    CROW_ROUTE(app, "/api/attendance")
    .methods(crow::HTTPMethod::GET, crow::HTTPMethod::POST, crow::HTTPMethod::OPTIONS)
    ([&db](const crow::request& req) {
        if (req.method == crow::HTTPMethod::OPTIONS) return makeOptionsResponse();

        if (req.method == crow::HTTPMethod::GET) {
            auto list = db.getAttendance();
            json arr = json::array();
            for (const auto& s : list) arr.push_back(s.toJson());
            return makeJsonResponse(200, arr);
        }

        if (req.method == crow::HTTPMethod::POST) {
            try {
                json body = json::parse(req.body);
                if (!body.contains("subject") || body["subject"].get<std::string>().empty()) {
                    return makeJsonResponse(400, json{{"error", "Subject name is required"}});
                }
                SubjectAttendance s = SubjectAttendance::fromJson(body);
                SubjectAttendance created = db.addAttendance(s);
                return makeJsonResponse(201, created.toJson());
            } catch (const std::exception& e) {
                return makeJsonResponse(400, json{{"error", std::string("Invalid JSON: ") + e.what()}});
            }
        }

        return makeJsonResponse(405, json{{"error", "Method not allowed"}});
    });

    // Attendance API: PUT, DELETE /api/attendance/<id>
    CROW_ROUTE(app, "/api/attendance/<string>")
    .methods(crow::HTTPMethod::PUT, crow::HTTPMethod::DELETE, crow::HTTPMethod::OPTIONS)
    ([&db](const crow::request& req, const std::string& id) {
        if (req.method == crow::HTTPMethod::OPTIONS) return makeOptionsResponse();

        if (req.method == crow::HTTPMethod::PUT) {
            try {
                json body = json::parse(req.body);
                SubjectAttendance s = SubjectAttendance::fromJson(body);
                bool ok = db.updateAttendance(id, s);
                if (ok) return makeJsonResponse(200, s.toJson());
                return makeJsonResponse(404, json{{"error", "Subject not found"}});
            } catch (const std::exception& e) {
                return makeJsonResponse(400, json{{"error", std::string("Invalid JSON: ") + e.what()}});
            }
        }

        if (req.method == crow::HTTPMethod::DELETE) {
            bool ok = db.deleteAttendance(id);
            if (ok) return makeJsonResponse(200, json{{"success", true}, {"id", id}});
            return makeJsonResponse(404, json{{"error", "Subject not found"}});
        }

        return makeJsonResponse(405, json{{"error", "Method not allowed"}});
    });

    // Attendance Mark Quick Action: POST /api/attendance/<id>/mark
    CROW_ROUTE(app, "/api/attendance/<string>/mark")
    .methods(crow::HTTPMethod::POST, crow::HTTPMethod::OPTIONS)
    ([&db](const crow::request& req, const std::string& id) {
        if (req.method == crow::HTTPMethod::OPTIONS) return makeOptionsResponse();
        try {
            json body = json::parse(req.body);
            bool present = body.value("present", true);
            bool ok = db.markAttendance(id, present);
            if (ok) {
                auto list = db.getAttendance();
                for (const auto& item : list) {
                    if (item.id == id) {
                        return makeJsonResponse(200, item.toJson());
                    }
                }
            }
            return makeJsonResponse(404, json{{"error", "Subject not found"}});
        } catch (const std::exception& e) {
            return makeJsonResponse(400, json{{"error", std::string("Invalid JSON: ") + e.what()}});
        }
    });

    // ------------------------------------------------------------------------
    // Exams API: GET, POST /api/exams
    // ------------------------------------------------------------------------
    CROW_ROUTE(app, "/api/exams")
    .methods(crow::HTTPMethod::GET, crow::HTTPMethod::POST, crow::HTTPMethod::OPTIONS)
    ([&db](const crow::request& req) {
        if (req.method == crow::HTTPMethod::OPTIONS) return makeOptionsResponse();

        if (req.method == crow::HTTPMethod::GET) {
            auto list = db.getExams();
            json arr = json::array();
            for (const auto& e : list) arr.push_back(e.toJson());
            return makeJsonResponse(200, arr);
        }

        if (req.method == crow::HTTPMethod::POST) {
            try {
                json body = json::parse(req.body);
                if (!body.contains("subject") || body["subject"].get<std::string>().empty()) {
                    return makeJsonResponse(400, json{{"error", "Exam subject is required"}});
                }
                Exam e = Exam::fromJson(body);
                Exam created = db.addExam(e);
                return makeJsonResponse(201, created.toJson());
            } catch (const std::exception& e) {
                return makeJsonResponse(400, json{{"error", std::string("Invalid JSON: ") + e.what()}});
            }
        }

        return makeJsonResponse(405, json{{"error", "Method not allowed"}});
    });

    // Exams API: PUT, DELETE /api/exams/<id>
    CROW_ROUTE(app, "/api/exams/<string>")
    .methods(crow::HTTPMethod::PUT, crow::HTTPMethod::DELETE, crow::HTTPMethod::OPTIONS)
    ([&db](const crow::request& req, const std::string& id) {
        if (req.method == crow::HTTPMethod::OPTIONS) return makeOptionsResponse();

        if (req.method == crow::HTTPMethod::PUT) {
            try {
                json body = json::parse(req.body);
                Exam e = Exam::fromJson(body);
                bool ok = db.updateExam(id, e);
                if (ok) return makeJsonResponse(200, e.toJson());
                return makeJsonResponse(404, json{{"error", "Exam not found"}});
            } catch (const std::exception& e) {
                return makeJsonResponse(400, json{{"error", std::string("Invalid JSON: ") + e.what()}});
            }
        }

        if (req.method == crow::HTTPMethod::DELETE) {
            bool ok = db.deleteExam(id);
            if (ok) return makeJsonResponse(200, json{{"success", true}, {"id", id}});
            return makeJsonResponse(404, json{{"error", "Exam not found"}});
        }

        return makeJsonResponse(405, json{{"error", "Method not allowed"}});
    });

    // ------------------------------------------------------------------------
    // Tasks API: GET, POST /api/tasks
    // ------------------------------------------------------------------------
    CROW_ROUTE(app, "/api/tasks")
    .methods(crow::HTTPMethod::GET, crow::HTTPMethod::POST, crow::HTTPMethod::OPTIONS)
    ([&db](const crow::request& req) {
        if (req.method == crow::HTTPMethod::OPTIONS) return makeOptionsResponse();

        if (req.method == crow::HTTPMethod::GET) {
            auto list = db.getTasks();
            json arr = json::array();
            for (const auto& t : list) arr.push_back(t.toJson());
            return makeJsonResponse(200, arr);
        }

        if (req.method == crow::HTTPMethod::POST) {
            try {
                json body = json::parse(req.body);
                if (!body.contains("title") || body["title"].get<std::string>().empty()) {
                    return makeJsonResponse(400, json{{"error", "Task title is required"}});
                }
                Task t = Task::fromJson(body);
                Task created = db.addTask(t);
                return makeJsonResponse(201, created.toJson());
            } catch (const std::exception& e) {
                return makeJsonResponse(400, json{{"error", std::string("Invalid JSON: ") + e.what()}});
            }
        }

        return makeJsonResponse(405, json{{"error", "Method not allowed"}});
    });

    // Tasks API: PUT, DELETE /api/tasks/<id>
    CROW_ROUTE(app, "/api/tasks/<string>")
    .methods(crow::HTTPMethod::PUT, crow::HTTPMethod::DELETE, crow::HTTPMethod::OPTIONS)
    ([&db](const crow::request& req, const std::string& id) {
        if (req.method == crow::HTTPMethod::OPTIONS) return makeOptionsResponse();

        if (req.method == crow::HTTPMethod::PUT) {
            try {
                json body = json::parse(req.body);
                Task t = Task::fromJson(body);
                bool ok = db.updateTask(id, t);
                if (ok) return makeJsonResponse(200, t.toJson());
                return makeJsonResponse(404, json{{"error", "Task not found"}});
            } catch (const std::exception& e) {
                return makeJsonResponse(400, json{{"error", std::string("Invalid JSON: ") + e.what()}});
            }
        }

        if (req.method == crow::HTTPMethod::DELETE) {
            bool ok = db.deleteTask(id);
            if (ok) return makeJsonResponse(200, json{{"success", true}, {"id", id}});
            return makeJsonResponse(404, json{{"error", "Task not found"}});
        }

        return makeJsonResponse(405, json{{"error", "Method not allowed"}});
    });

    // Tasks API: POST /api/tasks/reorder
    CROW_ROUTE(app, "/api/tasks/reorder")
    .methods(crow::HTTPMethod::POST, crow::HTTPMethod::OPTIONS)
    ([&db](const crow::request& req) {
        if (req.method == crow::HTTPMethod::OPTIONS) return makeOptionsResponse();
        try {
            json body = json::parse(req.body);
            if (!body.contains("order") || !body["order"].is_array()) {
                return makeJsonResponse(400, json{{"error", "Field 'order' must be an array of task IDs"}});
            }
            std::vector<std::string> orderedIds;
            for (const auto& item : body["order"]) {
                if (item.is_string()) orderedIds.push_back(item.get<std::string>());
            }
            db.reorderTasks(orderedIds);
            auto updatedList = db.getTasks();
            json arr = json::array();
            for (const auto& t : updatedList) arr.push_back(t.toJson());
            return makeJsonResponse(200, arr);
        } catch (const std::exception& e) {
            return makeJsonResponse(400, json{{"error", std::string("Invalid JSON: ") + e.what()}});
        }
    });

    // ------------------------------------------------------------------------
    // AI Assistant API: POST /api/ai
    // ------------------------------------------------------------------------
    CROW_ROUTE(app, "/api/ai")
    .methods(crow::HTTPMethod::POST, crow::HTTPMethod::OPTIONS)
    ([&ai](const crow::request& req) {
        if (req.method == crow::HTTPMethod::OPTIONS) return makeOptionsResponse();
        try {
            json body = json::parse(req.body);
            std::string prompt = body.value("prompt", "Summarize my week and help me plan.");
            std::string mode = body.value("mode", "chat");

            json result = ai.processQuery(prompt, mode);
            return makeJsonResponse(200, result);
        } catch (const std::exception& e) {
            return makeJsonResponse(400, json{{"error", std::string("Invalid request: ") + e.what()}});
        }
    });

    // ------------------------------------------------------------------------
    // Profile API: GET, PUT /api/profile
    // ------------------------------------------------------------------------
    CROW_ROUTE(app, "/api/profile")
    .methods(crow::HTTPMethod::GET, crow::HTTPMethod::PUT, crow::HTTPMethod::OPTIONS)
    ([&db](const crow::request& req) {
        if (req.method == crow::HTTPMethod::OPTIONS) return makeOptionsResponse();

        if (req.method == crow::HTTPMethod::GET) {
            return makeJsonResponse(200, db.getUserProfile().toJson());
        }

        if (req.method == crow::HTTPMethod::PUT) {
            try {
                json body = json::parse(req.body);
                UserProfile u = UserProfile::fromJson(body);
                db.updateUserProfile(u);
                return makeJsonResponse(200, u.toJson());
            } catch (const std::exception& e) {
                return makeJsonResponse(400, json{{"error", std::string("Invalid JSON: ") + e.what()}});
            }
        }

        return makeJsonResponse(405, json{{"error", "Method not allowed"}});
    });
}

} // namespace ssk
