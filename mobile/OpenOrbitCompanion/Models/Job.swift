import Foundation

struct Job: Identifiable, Codable, Hashable {
    let id: String
    let title: String
    let company: String
    let location: String?
    let salary: String?
    let platform: String
    let status: JobStatus
    let matchScore: Int?
    let summary: String?
    let url: String?
    let postedAt: Date?

    enum JobStatus: String, Codable, CaseIterable {
        case new
        case reviewed
        case approved
        case rejected
        case applied
        case skipped
        case error
    }
}
