cmake_minimum_required(VERSION 3.21)
project(ivandaw_engine_core VERSION 0.1.0 LANGUAGES CXX)

# Shared audio-thread effects for IvanDAW plugins.
# Consumers pull this repo with FetchContent (pinned to a tag) and link ivandaw::engine_core.
# Tests and the playground build only when this repo is the top-level project.
option(IVANDAW_ENGINE_CORE_TESTS "Build the engine-core tests" ${PROJECT_IS_TOP_LEVEL})

# Same rules as every plugin core: no exceptions, no RTTI. JUCE consumers keep theirs on;
# the flags are PRIVATE so they never leak into the consumer's targets.
function(ivandaw_core_flags target)
    if(MSVC)
        target_compile_options(${target} PRIVATE /GR- /EHs-c- /W4)
        target_compile_definitions(${target} PRIVATE _HAS_EXCEPTIONS=0)
    else()
        target_compile_options(${target} PRIVATE -fno-exceptions -fno-rtti -Wall -Wextra)
    endif()
endfunction()

add_library(ivandaw_engine_core STATIC
    src/Delay.cpp
    src/Reverb.cpp
    src/Filter.cpp
    src/Unison.cpp
)
add_library(ivandaw::engine_core ALIAS ivandaw_engine_core)
target_include_directories(ivandaw_engine_core PUBLIC ${CMAKE_CURRENT_SOURCE_DIR}/include)
target_compile_features(ivandaw_engine_core PUBLIC cxx_std_20)
ivandaw_core_flags(ivandaw_engine_core)

# The playground's wasm: only for this repo's own emscripten build, never for a consumer.
# Writes apps/playground/public/engine_core_playground.wasm.
if(EMSCRIPTEN AND PROJECT_IS_TOP_LEVEL)
    add_executable(engine_core_playground playground/abi.cpp)
    target_link_libraries(engine_core_playground PRIVATE ivandaw_engine_core)
    ivandaw_core_flags(engine_core_playground)
    set_target_properties(engine_core_playground PROPERTIES
        SUFFIX ".wasm"
        RUNTIME_OUTPUT_DIRECTORY ${CMAKE_CURRENT_SOURCE_DIR}/apps/playground/public)
    target_link_options(engine_core_playground PRIVATE
        -O2
        --no-entry
        -sSTANDALONE_WASM
        -sALLOW_MEMORY_GROWTH
        -sFILESYSTEM=0
        -sEXPORTED_FUNCTIONS=_fxp_alloc,_fxp_free,_fxp_create,_fxp_destroy,_fxp_set,_fxp_bypass,_fxp_reset,_fxp_process
    )
endif()

if(IVANDAW_ENGINE_CORE_TESTS AND NOT EMSCRIPTEN)
    enable_testing()
    foreach(name delay reverb filter unison)
        add_executable(${name}_tests tests/${name}_tests.cpp)
        target_link_libraries(${name}_tests PRIVATE ivandaw_engine_core)
        ivandaw_core_flags(${name}_tests)
        add_test(NAME ${name}_tests COMMAND ${name}_tests)
    endforeach()
endif()
