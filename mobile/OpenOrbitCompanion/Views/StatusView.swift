import SwiftUI

/// Shows the live automation status streamed from the OpenOrbit RPC server.
struct StatusView: View {

    @EnvironmentObject var appState: AppState
    @State private var status: AutomationStatus?

    var body: some View {
        NavigationStack {
            Group {
                if let status {
                    statusContent(status)
                } else {
                    ProgressView("Loading status…")
                }
            }
            .navigationTitle("Automation Status")
            .onReceive(appState.client?.automationStatusSubject.eraseToAnyPublisher() ?? .init(Empty())) { s in
                status = s
            }
            .task {
                await fetchStatus()
            }
        }
    }

    @ViewBuilder
    private func statusContent(_ status: AutomationStatus) -> some View {
        List {
            Section("State") {
                statRow("Status", value: status.state.rawValue.capitalized, color: stateColor(status.state))
                statRow("Actions/min", value: String(format: "%.1f", status.actionsPerMinute))
            }

            Section("Progress") {
                statRow("Jobs extracted", value: "\(status.jobsExtracted)")
                statRow("Jobs analyzed", value: "\(status.jobsAnalyzed)")
                statRow("Applications submitted", value: "\(status.applicationsSubmitted)")
            }

            if !status.errors.isEmpty {
                Section("Errors") {
                    ForEach(status.errors, id: \.self) { err in
                        Text(err).font(.caption).foregroundColor(.red)
                    }
                }
            }
        }
        .toolbar {
            ToolbarItem(placement: .primaryAction) {
                controlButtons(state: status.state)
            }
        }
    }

    @ViewBuilder
    private func controlButtons(state: AutomationStatus.State) -> some View {
        HStack {
            if state == .running {
                Button("Pause") { sendCommand("automation:pause") }
                    .tint(.orange)
            } else if state == .paused {
                Button("Resume") { sendCommand("automation:start") }
                    .tint(.green)
            } else {
                Button("Start") { sendCommand("automation:start") }
                    .tint(.green)
            }
        }
    }

    private func statRow(_ label: String, value: String, color: Color = .primary) -> some View {
        HStack {
            Text(label).foregroundColor(.secondary)
            Spacer()
            Text(value).fontWeight(.medium).foregroundColor(color)
        }
    }

    private func stateColor(_ state: AutomationStatus.State) -> Color {
        switch state {
        case .running: return .green
        case .paused: return .orange
        case .error: return .red
        case .idle: return .secondary
        }
    }

    private func fetchStatus() async {
        guard let client = appState.client else { return }
        if let result = try? await client.call("automation:status") as? [String: Any],
           let data = try? JSONSerialization.data(withJSONObject: result),
           let decoded = try? JSONDecoder().decode(AutomationStatus.self, from: data) {
            status = decoded
        }
    }

    private func sendCommand(_ method: String) {
        Task {
            _ = try? await appState.client?.call(method)
        }
    }
}
