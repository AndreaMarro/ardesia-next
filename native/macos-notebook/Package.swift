// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "ArdesiaNotebook",
    platforms: [.macOS(.v13)],
    products: [
        .library(name: "NotebookCore", targets: ["NotebookCore"]),
        .executable(name: "ArdesiaNotebook", targets: ["ArdesiaNotebook"])
    ],
    targets: [
        .target(name: "NotebookCore"),
        .executableTarget(name: "ArdesiaNotebook", dependencies: ["NotebookCore"]),
        // CLT-only macOS lacks XCTest. This executable runs real checks without
        // installing Xcode or fetching a third-party test framework.
        .executableTarget(name: "NotebookChecks", dependencies: ["NotebookCore"], path: "Tests/NotebookChecks")
    ]
)
