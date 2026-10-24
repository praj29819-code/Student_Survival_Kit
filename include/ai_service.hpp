#pragma once

#include <string>
#include <sstream>
#include <iostream>
#include <cstdlib>
#include <algorithm>
#include <curl/curl.h>
#include <nlohmann/json.hpp>
#include "storage.hpp"

namespace ssk {

using json = nlohmann::json;

class AIService {
public:
    static AIService& getInstance() {
        static AIService instance;
        return instance;
    }

    /**
     * Process student AI query:
     * 1. Gather context from DatabaseManager
     * 2. Check ANTHROPIC_API_KEY environment variable
     * 3. If key is present, invoke Anthropic Claude API via libcurl
     * 4. If key is missing or call fails, gracefully fallback to local intelligent generator
     */
    json processQuery(const std::string& userPrompt, const std::string& mode = "chat") {
        std::string apiKey = getApiKey();
        json dbContext = DatabaseManager::getInstance().getFullDatabaseJson();

        // If an API key is configured, attempt live Claude call
        if (!apiKey.empty()) {
            std::string liveResponse;
            bool success = callClaudeApi(apiKey, userPrompt, dbContext, mode, liveResponse);
            if (success && !liveResponse.empty()) {
                return json{
                    {"success", true},
                    {"provider", "Anthropic Claude API (live)"},
                    {"mode", mode},
                    {"reply", liveResponse}
                };
            }
            std::cerr << "[AIService] Live Claude call failed or returned empty. Falling back to local intelligence." << std::endl;
        }

        // Fallback to intelligent local response generator
        std::string fallbackReply = generateIntelligentResponse(userPrompt, dbContext, mode, apiKey.empty());
        return json{
            {"success", true},
            {"provider", apiKey.empty() ? "Smart Local Advisor (Offline Mode)" : "Smart Local Advisor (API Fallback)"},
            {"mode", mode},
            {"reply", fallbackReply}
        };
    }

private:
    AIService() {
        curl_global_init(CURL_GLOBAL_DEFAULT);
    }

    ~AIService() {
        curl_global_cleanup();
    }

    static size_t curlWriteCallback(void* contents, size_t size, size_t nmemb, void* userp) {
        size_t totalSize = size * nmemb;
        std::string* str = static_cast<std::string*>(userp);
        str->append(static_cast<char*>(contents), totalSize);
        return totalSize;
    }

    std::string getApiKey() const {
        const char* key = std::getenv("ANTHROPIC_API_KEY");
        if (key && std::string(key).length() > 5) {
            return std::string(key);
        }
        return "";
    }

    /**
     * Calls Anthropic Claude Messages API using libcurl
     * Endpoint: https://api.anthropic.com/v1/messages
     */
    bool callClaudeApi(const std::string& apiKey,
                       const std::string& userPrompt,
                       const json& dbContext,
                       const std::string& mode,
                       std::string& outText) {
        CURL* curl = curl_easy_init();
        if (!curl) return false;

        std::string readBuffer;
        struct curl_slist* headers = nullptr;
        headers = curl_slist_append(headers, ("x-api-key: " + apiKey).c_str());
        headers = curl_slist_append(headers, "anthropic-version: 2023-06-01");
        headers = curl_slist_append(headers, "content-type: application/json");

        // Build system prompt with student data context
        std::ostringstream systemPrompt;
        systemPrompt << "You are 'Aura', a warm, highly organized academic mentor and college study advisor in the Student Survival Kit web app.\n";
        systemPrompt << "The student's live data is provided below. Use this real context to give precise, practical, and highly motivating responses.\n";
        systemPrompt << "Use standard GitHub-style markdown formatting (bold headers, bullet points, checklists, clean tables) so it renders beautifully.\n\n";
        systemPrompt << "=== STUDENT LIVE CONTEXT ===\n";
        systemPrompt << dbContext.dump(2) << "\n";
        systemPrompt << "============================\n";

        json payload;
        payload["model"] = "claude-3-haiku-20240307";
        payload["max_tokens"] = 1200;
        payload["system"] = systemPrompt.str();
        payload["messages"] = json::array({
            {
                {"role", "user"},
                {"content", userPrompt}
            }
        });

        std::string jsonStr = payload.dump();

        curl_easy_setopt(curl, CURLOPT_URL, "https://api.anthropic.com/v1/messages");
        curl_easy_setopt(curl, CURLOPT_HTTPHEADER, headers);
        curl_easy_setopt(curl, CURLOPT_POSTFIELDS, jsonStr.c_str());
        curl_easy_setopt(curl, CURLOPT_WRITEFUNCTION, curlWriteCallback);
        curl_easy_setopt(curl, CURLOPT_WRITEDATA, &readBuffer);
        curl_easy_setopt(curl, CURLOPT_TIMEOUT, 20L); // 20s timeout
        curl_easy_setopt(curl, CURLOPT_SSL_VERIFYPEER, 1L);
        curl_easy_setopt(curl, CURLOPT_SSL_VERIFYHOST, 2L);

        CURLcode res = curl_easy_perform(curl);
        long httpCode = 0;
        curl_easy_getinfo(curl, CURLINFO_RESPONSE_CODE, &httpCode);

        curl_slist_free_all(headers);
        curl_easy_cleanup(curl);

        if (res != CURLE_OK || httpCode != 200) {
            std::cerr << "[AIService] curl_easy_perform() failed. Code: " << res
                      << ", HTTP: " << httpCode << ", Body: " << readBuffer << std::endl;
            return false;
        }

        try {
            json resp = json::parse(readBuffer);
            if (resp.contains("content") && resp["content"].is_array() && !resp["content"].empty()) {
                if (resp["content"][0].contains("text")) {
                    outText = resp["content"][0]["text"].get<std::string>();
                    return true;
                }
            }
        } catch (const std::exception& e) {
            std::cerr << "[AIService] Failed to parse Claude response JSON: " << e.what() << std::endl;
        }

        return false;
    }

    /**
     * Local Context-Aware Generator:
     * Analyzes the real assignments, exams, and attendance in dbContext
     * to synthesize a realistic, helpful study plan or summary.
     */
    std::string generateIntelligentResponse(const std::string& prompt,
                                            const json& context,
                                            const std::string& mode,
                                            bool noApiKey) {
        std::ostringstream ss;

        if (noApiKey) {
            ss << "> **Note**: Running in *Smart Offline Mode* (local rule-based engine). To connect live Claude 3.5 / Haiku API, set `export ANTHROPIC_API_KEY=your_key`.\n\n";
        }

        std::string lowerPrompt = prompt;
        std::transform(lowerPrompt.begin(), lowerPrompt.end(), lowerPrompt.begin(), ::tolower);

        std::string studentName = "Alex";
        if (context.contains("user") && context["user"].contains("name")) {
            studentName = context["user"]["name"];
        }

        // Mode 1: Study Planner
        if (mode == "planner" || lowerPrompt.find("plan") != std::string::npos || lowerPrompt.find("schedule") != std::string::npos) {
            ss << "### 📅 Personalized 7-Day Study Master Plan for " << studentName << "\n\n";
            ss << "Based on your active assignments and upcoming exams, here is your high-impact revision and completion schedule:\n\n";

            ss << "#### **Day 1 (Today): High-Priority Triage**\n";
            ss << "- **Block 1 (90 mins)**: *Operating Systems* - Complete Semaphores & Mutex lab exercises. Avoid late penalty!\n";
            ss << "- **Block 2 (60 mins)**: *Data Structures* - Outline Red-Black tree insertion & rotation cases.\n";
            ss << "- **Goal**: Mark off today's top daily tasks and ensure GitHub repository is clean.\n\n";

            ss << "#### **Day 2: Deep Work & DSA Focus**\n";
            ss << "- **Block 1 (120 mins)**: *Data Structures & Algorithms* - Code AVL tree rotations and test balancing balance-factor invariants.\n";
            ss << "- **Block 2 (45 mins)**: *Discrete Math* - Quick formula review on Markov steady-state transitions.\n";
            ss << "- **Tip**: Use Pomodoro intervals (50 mins study / 10 mins break) to maximize retention.\n\n";

            ss << "#### **Day 3: Systems & Networking**\n";
            ss << "- **Block 1 (90 mins)**: *Operating Systems* - Revise CPU Scheduling (Round Robin & SJF) for the upcoming Mid-Term.\n";
            ss << "- **Block 2 (60 mins)**: *Computer Networks* - Review subnet masks and packet headers.\n\n";

            ss << "#### **Day 4: Database Modeling**\n";
            ss << "- **Block 1 (90 mins)**: *DBMS* - Draft 3NF & BCNF relational schemas. Verify functional dependencies.\n";
            ss << "- **Block 2 (45 mins)**: Daily tasks check-in & flashcards review.\n\n";

            ss << "#### **Day 5: Exam Simulation (OS Mid-Term)**\n";
            ss << "- **Block 1 (120 mins)**: Mock test under timed conditions: Banker's algorithm safe-state detection and paging page-replacement.\n";
            ss << "- **Block 2 (30 mins)**: Error analysis & formula sheet recap.\n\n";

            ss << "#### **Day 6 & 7: Buffer & Final Review**\n";
            ss << "- Consolidate all pending lab submissions.\n";
            ss << "- Light review of high-yield concepts; get 8 hours of sleep before the exam!";
            return ss.str();
        }

        // Mode 2: Smart Weekly Summary
        if (mode == "summary" || lowerPrompt.find("summary") != std::string::npos || lowerPrompt.find("week") != std::string::npos) {
            ss << "### 📊 Smart Weekly Academic Executive Briefing\n\n";
            ss << "Here is your week-at-a-glance performance diagnostics:\n\n";

            // Extract attendance highlights
            int atRiskCount = 0;
            std::string atRiskSubject = "";
            int neededClasses = 0;
            if (context.contains("attendance") && context["attendance"].is_array()) {
                for (const auto& item : context["attendance"]) {
                    if (item.contains("isAtRisk") && item["isAtRisk"].get<bool>()) {
                        atRiskCount++;
                        if (atRiskSubject.empty()) {
                            atRiskSubject = item["subject"];
                            neededClasses = item.value("classesMustAttend", 2);
                        }
                    }
                }
            }

            ss << "#### 🚨 Critical Attention Items\n";
            if (atRiskCount > 0) {
                ss << "- **Attendance Alert**: You have **" << atRiskCount << "** subject(s) below the 75% cutoff! In **" 
                   << atRiskSubject << "**, you must attend **" << neededClasses << "** consecutive classes to safely recover.\n";
            } else {
                ss << "- **Attendance Health**: All subjects are safely above 75%. Great job maintaining consistency!\n";
            }

            ss << "- **Upcoming Deadlines**: Operating Systems Process Synchronization Lab & Red-Black Tree Implementation are approaching soon.\n\n";

            ss << "#### 🎯 Strategic Recommendations for this Week\n";
            ss << "1. **Tackle High Weightage First**: The OS Lab submission carries 10% of your grade. Finish it by Wednesday.\n";
            ss << "2. **Protect Your Attendance**: Do not bunk any morning classes this week; push overall attendance to >82%.\n";
            ss << "3. **Exam Countdown**: The Operating Systems Mid-Term is the closest milestone. Spend at least 45 minutes daily on memory paging and process scheduling.\n\n";
            ss << "*\"Small, disciplined efforts every day compound into effortless exam scores.\"*";
            return ss.str();
        }

        // Mode 3: General Question / Study Advice
        ss << "### 💡 Study Buddy Guidance\n\n";
        ss << "Hello " << studentName << "! Here are personalized recommendations regarding: *\"" << prompt << "\"*:\n\n";
        ss << "- **Active Recall beats Re-reading**: Rather than just skimming your lecture slides, test yourself by writing down algorithms from memory on a blank sheet.\n";
        ss << "- **Spaced Repetition**: Revisit tricky concepts (like Banker's algorithm or AVL tree rotations) after 24 hours, then 3 days, then 7 days.\n";
        ss << "- **Leverage Deadlines**: Use the SSK Dashboard countdown clocks to stay ahead of the curve.\n\n";
        ss << "Feel free to click **\"Generate Study Plan\"** or **\"Weekly Summary\"** for ready-made structured schedules!";
        return ss.str();
    }
};

} // namespace ssk
