import SwiftUI

/// Lists jobs from the OpenOrbit RPC server with swipe-to-approve/reject.
struct JobsView: View {

    @EnvironmentObject var appState: AppState
    @State private var jobs: [Job] = []
    @State private var isLoading = false
    @State private var errorMessage: String?

    var body: some View {
        NavigationStack {
            Group {
                if isLoading {
                    ProgressView("Loading jobs…")
                } else if jobs.isEmpty {
                    ContentUnavailableView(
                        "No Jobs",
                        systemImage: "briefcase",
                        description: Text("Run a search profile in OpenOrbit to extract jobs.")
                    )
                } else {
                    jobList
                }
            }
            .navigationTitle("Jobs")
            .toolbar {
                ToolbarItem(placement: .primaryAction) {
                    Button("Refresh") { Task { await loadJobs() } }
                }
            }
            .task { await loadJobs() }
            .onReceive(appState.client?.jobsNewSubject.eraseToAnyPublisher() ?? .init(Empty())) { job in
                jobs.insert(job, at: 0)
            }
        }
    }

    // MARK: - Job List

    private var jobList: some View {
        List {
            ForEach(jobs) { job in
                JobRow(job: job)
                    .swipeActions(edge: .leading, allowsFullSwipe: true) {
                        Button("Approve") { updateJob(job, status: "approved") }
                            .tint(.green)
                    }
                    .swipeActions(edge: .trailing, allowsFullSwipe: true) {
                        Button("Reject") { updateJob(job, status: "rejected") }
                            .tint(.red)
                    }
            }
        }
        .listStyle(.plain)
    }

    // MARK: - Actions

    private func loadJobs() async {
        isLoading = true
        defer { isLoading = false }
        guard let client = appState.client else { return }
        do {
            let result = try await client.call("jobs:list", params: ["filters": [:]])
            if let obj = result as? [String: Any],
               let dataArray = obj["data"] as? [[String: Any]],
               let data = try? JSONSerialization.data(withJSONObject: dataArray) {
                jobs = (try? JSONDecoder().decode([Job].self, from: data)) ?? []
            }
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    private func updateJob(_ job: Job, status: String) {
        Task {
            _ = try? await appState.client?.call("jobs:update", params: ["id": job.id, "updates": ["status": status]])
            jobs.removeAll { $0.id == job.id }
        }
    }
}

// MARK: - Job Row

struct JobRow: View {

    let job: Job

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            HStack {
                Text(job.title)
                    .font(.headline)
                    .lineLimit(1)
                Spacer()
                if let score = job.matchScore {
                    ScoreBadge(score: score)
                }
            }

            Text(job.company)
                .font(.subheadline)
                .foregroundColor(.secondary)

            HStack {
                Text(job.platform)
                    .font(.caption)
                    .padding(.horizontal, 6)
                    .padding(.vertical, 2)
                    .background(Color.accentColor.opacity(0.15))
                    .foregroundColor(.accentColor)
                    .clipShape(Capsule())

                StatusBadge(status: job.status)
            }
        }
        .padding(.vertical, 4)
    }
}

struct ScoreBadge: View {
    let score: Int

    var color: Color {
        score >= 80 ? .green : score >= 60 ? .orange : .red
    }

    var body: some View {
        Text("\(score)")
            .font(.caption.weight(.bold))
            .foregroundColor(color)
            .padding(.horizontal, 6)
            .padding(.vertical, 2)
            .overlay(Capsule().stroke(color, lineWidth: 1))
    }
}

struct StatusBadge: View {
    let status: Job.JobStatus

    var color: Color {
        switch status {
        case .applied: return .green
        case .approved: return .blue
        case .rejected, .error: return .red
        case .reviewed: return .orange
        default: return .secondary
        }
    }

    var body: some View {
        Text(status.rawValue.capitalized)
            .font(.caption)
            .padding(.horizontal, 6)
            .padding(.vertical, 2)
            .background(color.opacity(0.15))
            .foregroundColor(color)
            .clipShape(Capsule())
    }
}
