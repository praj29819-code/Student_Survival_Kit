/**
 * ============================================================================
 * Project: Student Survival Kit (SSK)
 * Description: Academic productivity web app & personal student command center.
 * Tech Stack: C++17, Crow microframework, nlohmann/json, libcurl, Anthropic API.
 * ============================================================================
 */

#include <iostream>
#include <string>
#include <cstdlib>
#include <crow.h>

#include "include/models.hpp"
#include "include/storage.hpp"
#include "include/ai_service.hpp"
#include "include/routes.hpp"

int main() {
    std::cout << "========================================================\n";
    std::cout << "       🎓 STUDENT SURVIVAL KIT (SSK) - SERVER           \n";
    std::cout << "          High-Performance C++17 Academic Hub          \n";
    std::cout << "========================================================\n";

    // 1. Initialize persistent storage (data/db.json)
    const std::string dbPath = "data/db.json";
    std::cout << "[Init] Loading student database from: " << dbPath << "..." << std::endl;
    ssk::DatabaseManager::getInstance().init(dbPath);
    std::cout << "[Init] Database loaded successfully." << std::endl;

    // 2. Check Anthropic Claude API status
    const char* apiKeyEnv = std::getenv("ANTHROPIC_API_KEY");
    if (apiKeyEnv && std::string(apiKeyEnv).length() > 5) {
        std::cout << "[AI Service] ANTHROPIC_API_KEY detected. Claude 3.5 live integration active." << std::endl;
    } else {
        std::cout << "[AI Service] ANTHROPIC_API_KEY not set. Using smart offline local advisor fallback." << std::endl;
        std::cout << "             (To enable live Claude AI, set ANTHROPIC_API_KEY=your_key)" << std::endl;
    }

    // 3. Configure Crow HTTP server
    crow::SimpleApp app;
    crow::logger::setLogLevel(crow::LogLevel::Info);

    // 4. Register all REST API endpoints & static file serving
    std::cout << "[Routes] Registering REST API endpoints & static file routes..." << std::endl;
    ssk::registerRoutes(app);

    // 5. Determine port (default: 8080 or PORT env var)
    int port = 8080;
    const char* portEnv = std::getenv("PORT");
    if (portEnv) {
        try {
            port = std::stoi(portEnv);
        } catch (...) {
            port = 8080;
        }
    }

    std::cout << "\n>>> Server ready! Open your browser at: http://localhost:" << port << " <<<\n" << std::endl;

    // 6. Start listening (multithreaded for high concurrency)
    try {
        app.port(port).multithreaded().run();
    } catch (const std::exception& e) {
        std::cerr << "[Fatal Error] Server stopped unexpectedly: " << e.what() << std::endl;
        return 1;
    }

    return 0;
}
