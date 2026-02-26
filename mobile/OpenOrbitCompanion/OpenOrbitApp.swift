import SwiftUI
import Combine

/// Shared application state: manages the WebSocket connection lifecycle.
final class AppState: ObservableObject {

    @Published var isPaired = false
    @Published var client: WebSocketClient?

    private let notifications = NotificationService()

    init() {
        // Restore saved pairing on launch
        if let wsUrl = UserDefaults.standard.string(forKey: "pairing_wsUrl"),
           let token = UserDefaults.standard.string(forKey: "pairing_token"),
           let url = URL(string: wsUrl) {
            connect(wsUrl: url.absoluteString, token: token)
        }
    }

    func connect(wsUrl: String, token: String) {
        guard let url = URL(string: wsUrl) else { return }
        let ws = WebSocketClient(wsUrl: url, token: token)
        ws.connect()
        client = ws
        isPaired = true
        notifications.requestPermission()
        notifications.subscribe(to: ws)
    }

    func disconnect() {
        client?.disconnect()
        client = nil
        isPaired = false
        UserDefaults.standard.removeObject(forKey: "pairing_wsUrl")
        UserDefaults.standard.removeObject(forKey: "pairing_token")
    }
}

@main
struct OpenOrbitApp: App {

    @StateObject private var appState = AppState()

    var body: some Scene {
        WindowGroup {
            if appState.isPaired {
                MainTabView()
                    .environmentObject(appState)
            } else {
                PairingView()
                    .environmentObject(appState)
            }
        }
    }
}

struct MainTabView: View {

    @EnvironmentObject var appState: AppState

    var body: some View {
        TabView {
            JobsView()
                .tabItem { Label("Jobs", systemImage: "briefcase") }

            StatusView()
                .tabItem { Label("Status", systemImage: "gauge") }

            SettingsTab()
                .tabItem { Label("Settings", systemImage: "gear") }
        }
    }
}

struct SettingsTab: View {

    @EnvironmentObject var appState: AppState

    var body: some View {
        NavigationStack {
            List {
                Section("Connection") {
                    if let client = appState.client {
                        LabeledContent("Connected", value: client.isConnected ? "Yes" : "No")
                    }
                    Button("Disconnect & Re-pair", role: .destructive) {
                        appState.disconnect()
                    }
                }
            }
            .navigationTitle("Settings")
        }
    }
}
