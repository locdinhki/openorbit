import Foundation
import UserNotifications
import Combine

/// Posts local notifications when the RPC server pushes new job events.
final class NotificationService {

    private var cancellables = Set<AnyCancellable>()

    func requestPermission() {
        UNUserNotificationCenter.current().requestAuthorization(options: [.alert, .sound, .badge]) { _, _ in }
    }

    /// Subscribe to the WebSocketClient's jobsNew subject and post a notification for each new job.
    func subscribe(to client: WebSocketClient) {
        client.jobsNewSubject
            .sink { [weak self] job in self?.postJobNotification(job) }
            .store(in: &cancellables)
    }

    private func postJobNotification(_ job: Job) {
        let content = UNMutableNotificationContent()
        content.title = "New Job Match"
        content.body = "\(job.title) at \(job.company)"
        if let score = job.matchScore {
            content.subtitle = "Match score: \(score)"
        }
        content.sound = .default

        let request = UNNotificationRequest(
            identifier: "job-\(job.id)",
            content: content,
            trigger: nil
        )
        UNUserNotificationCenter.current().add(request)
    }
}
