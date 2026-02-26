import Foundation
import Combine

/// JSON-RPC 2.0 over WebSocket client for the OpenOrbit RPC server.
/// Handles auth handshake, call/response mapping, and push event subscription.
final class WebSocketClient: ObservableObject {

    // MARK: - Published State

    @Published var isConnected = false
    @Published var lastError: String?

    // MARK: - Events

    let jobsNewSubject = PassthroughSubject<Job, Never>()
    let automationStatusSubject = PassthroughSubject<AutomationStatus, Never>()

    // MARK: - Private

    private var task: URLSessionWebSocketTask?
    private var session: URLSession
    private var pendingCalls: [String: CheckedContinuation<Any, Error>] = [:]
    private var callIdCounter = 0
    private let token: String
    private let wsUrl: URL

    // MARK: - Init

    init(wsUrl: URL, token: String) {
        self.wsUrl = wsUrl
        self.token = token
        self.session = URLSession(configuration: .default)
    }

    // MARK: - Connection

    func connect() {
        var request = URLRequest(url: wsUrl)
        request.addValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        task = session.webSocketTask(with: request)
        task?.resume()
        isConnected = true
        receiveLoop()
        authenticate()
    }

    func disconnect() {
        task?.cancel(with: .normalClosure, reason: nil)
        task = nil
        isConnected = false
    }

    // MARK: - RPC Calls

    func call(_ method: String, params: [String: Any] = [:]) async throws -> Any {
        let id = nextId()
        let message: [String: Any] = [
            "jsonrpc": "2.0",
            "id": id,
            "method": method,
            "params": params
        ]
        let data = try JSONSerialization.data(withJSONObject: message)
        let text = String(data: data, encoding: .utf8)!
        try await task?.send(.string(text))

        return try await withCheckedThrowingContinuation { continuation in
            pendingCalls[id] = continuation
        }
    }

    // MARK: - Private Helpers

    private func nextId() -> String {
        callIdCounter += 1
        return "\(callIdCounter)"
    }

    private func authenticate() {
        Task {
            do {
                _ = try await call("auth", params: ["token": token])
            } catch {
                DispatchQueue.main.async { self.lastError = error.localizedDescription }
            }
        }
    }

    private func receiveLoop() {
        task?.receive { [weak self] result in
            guard let self else { return }
            switch result {
            case .success(let message):
                if case .string(let text) = message {
                    self.handleMessage(text)
                }
                self.receiveLoop()
            case .failure(let error):
                DispatchQueue.main.async {
                    self.isConnected = false
                    self.lastError = error.localizedDescription
                }
            }
        }
    }

    private func handleMessage(_ text: String) {
        guard let data = text.data(using: .utf8),
              let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any]
        else { return }

        // Push notification (no id)
        if let method = json["method"] as? String {
            handlePush(method: method, params: json["params"])
            return
        }

        // RPC response
        if let id = json["id"] as? String, let continuation = pendingCalls.removeValue(forKey: id) {
            if let error = json["error"] as? [String: Any],
               let msg = error["message"] as? String {
                continuation.resume(throwing: RPCError(message: msg))
            } else {
                continuation.resume(returning: json["result"] ?? NSNull())
            }
        }
    }

    private func handlePush(method: String, params: Any?) {
        guard let params = params as? [String: Any],
              let paramsData = try? JSONSerialization.data(withJSONObject: params)
        else { return }

        switch method {
        case "jobs:new":
            if let job = try? JSONDecoder().decode(Job.self, from: paramsData) {
                DispatchQueue.main.async { self.jobsNewSubject.send(job) }
            }
        case "automation:status":
            if let status = try? JSONDecoder().decode(AutomationStatus.self, from: paramsData) {
                DispatchQueue.main.async { self.automationStatusSubject.send(status) }
            }
        default:
            break
        }
    }
}

struct RPCError: LocalizedError {
    let message: String
    var errorDescription: String? { message }
}
