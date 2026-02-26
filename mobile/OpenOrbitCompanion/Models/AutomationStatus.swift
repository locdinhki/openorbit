import Foundation

struct AutomationStatus: Codable {
    let state: State
    let jobsExtracted: Int
    let jobsAnalyzed: Int
    let applicationsSubmitted: Int
    let actionsPerMinute: Double
    let errors: [String]

    enum State: String, Codable {
        case idle
        case running
        case paused
        case error
    }
}
