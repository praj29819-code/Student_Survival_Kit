cmake_minimum_required(VERSION 3.16)
project(StudentSurvivalKit VERSION 1.0.0 LANGUAGES CXX)

# Require C++17
set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)

# Compiler optimization and warnings
if(MSVC)
    add_compile_options(/W4 /EHsc /utf-8)
else()
    add_compile_options(-Wall -Wextra -pedantic)
endif()

include(FetchContent)

# 1. Fetch nlohmann/json (Header-only modern JSON library)
message(STATUS "Configuring nlohmann/json...")
FetchContent_Declare(
    nlohmann_json
    GIT_REPOSITORY https://github.com/nlohmann/json.git
    GIT_TAG v3.11.3
)
FetchContent_MakeAvailable(nlohmann_json)

# 2. Fetch Crow C++ Web Framework
message(STATUS "Configuring Crow C++ Microframework...")
FetchContent_Declare(
    Crow
    GIT_REPOSITORY https://github.com/CrowCpp/Crow.git
    GIT_TAG v1.2.0
)
FetchContent_MakeAvailable(Crow)

# 3. Locate libcurl (for Anthropic Claude API calls)
find_package(CURL REQUIRED)

# 4. Target Executable
add_executable(student_survival_kit
    main.cpp
    include/models.hpp
    include/storage.hpp
    include/ai_service.hpp
    include/routes.hpp
)

target_include_directories(student_survival_kit PRIVATE
    ${CMAKE_CURRENT_SOURCE_DIR}/include
    ${CURL_INCLUDE_DIRS}
)

target_link_libraries(student_survival_kit PRIVATE
    Crow::Crow
    nlohmann_json::nlohmann_json
    CURL::libcurl
)

# 5. Windows specific socket and crypto libraries for networking
if(WIN32)
    target_link_libraries(student_survival_kit PRIVATE
        ws2_32
        crypt32
        wldap32
    )
endif()

# 6. Copy static web assets and initial database to build output directory
add_custom_command(TARGET student_survival_kit POST_BUILD
    COMMAND ${CMAKE_COMMAND} -E copy_directory
        ${CMAKE_CURRENT_SOURCE_DIR}/public
        $<TARGET_FILE_DIR:student_survival_kit>/public
    COMMAND ${CMAKE_COMMAND} -E copy_directory
        ${CMAKE_CURRENT_SOURCE_DIR}/data
        $<TARGET_FILE_DIR:student_survival_kit>/data
    COMMENT "Copying web assets and data to executable directory..."
)
