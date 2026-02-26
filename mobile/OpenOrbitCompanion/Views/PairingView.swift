import SwiftUI
import AVFoundation

/// Scans the QR code shown in the Electron Settings → Mobile Pairing tab.
/// The QR payload is a JSON string: { "wsUrl": "ws://...", "token": "..." }
struct PairingView: View {

    @EnvironmentObject var appState: AppState
    @State private var manualUrl = ""
    @State private var manualToken = ""
    @State private var showManual = false
    @State private var errorMessage: String?

    var body: some View {
        NavigationStack {
            VStack(spacing: 24) {
                if showManual {
                    manualEntryForm
                } else {
                    scannerSection
                }

                Button(showManual ? "Use QR Scanner" : "Enter manually") {
                    showManual.toggle()
                    errorMessage = nil
                }
                .font(.caption)
                .foregroundColor(.secondary)
            }
            .padding()
            .navigationTitle("Pair with OpenOrbit")
            .navigationBarTitleDisplayMode(.inline)
        }
    }

    // MARK: - QR Scanner

    private var scannerSection: some View {
        VStack(spacing: 16) {
            Text("Scan the QR code shown in OpenOrbit → Settings → Mobile Pairing.")
                .font(.callout)
                .multilineTextAlignment(.center)
                .foregroundColor(.secondary)

            QRScannerView { payload in
                handleScannedPayload(payload)
            }
            .frame(height: 260)
            .clipShape(RoundedRectangle(cornerRadius: 12))
            .overlay(RoundedRectangle(cornerRadius: 12).stroke(Color.accentColor, lineWidth: 2))

            if let err = errorMessage {
                Text(err).font(.caption).foregroundColor(.red)
            }
        }
    }

    // MARK: - Manual Entry

    private var manualEntryForm: some View {
        VStack(spacing: 12) {
            Text("Enter the WebSocket URL and auth token from the OpenOrbit Pairing screen.")
                .font(.callout)
                .multilineTextAlignment(.center)
                .foregroundColor(.secondary)

            TextField("ws://192.168.x.x:18790", text: $manualUrl)
                .textFieldStyle(.roundedBorder)
                .autocapitalization(.none)
                .keyboardType(.URL)

            SecureField("Auth token", text: $manualToken)
                .textFieldStyle(.roundedBorder)

            if let err = errorMessage {
                Text(err).font(.caption).foregroundColor(.red)
            }

            Button("Connect") {
                guard !manualUrl.isEmpty, !manualToken.isEmpty else {
                    errorMessage = "Both fields are required."
                    return
                }
                savePairing(wsUrl: manualUrl, token: manualToken)
            }
            .buttonStyle(.borderedProminent)
            .disabled(manualUrl.isEmpty || manualToken.isEmpty)
        }
    }

    // MARK: - Helpers

    private func handleScannedPayload(_ payload: String) {
        guard let data = payload.data(using: .utf8),
              let json = try? JSONDecoder().decode(PairingPayload.self, from: data)
        else {
            errorMessage = "Invalid QR code. Please try again."
            return
        }
        savePairing(wsUrl: json.wsUrl, token: json.token)
    }

    private func savePairing(wsUrl: String, token: String) {
        guard URL(string: wsUrl) != nil else {
            errorMessage = "Invalid WebSocket URL."
            return
        }
        // Persist in Keychain (simplified: using UserDefaults for demo; use Keychain in production)
        UserDefaults.standard.set(wsUrl, forKey: "pairing_wsUrl")
        UserDefaults.standard.set(token, forKey: "pairing_token")
        appState.connect(wsUrl: wsUrl, token: token)
    }
}

private struct PairingPayload: Decodable {
    let wsUrl: String
    let token: String
}

/// Minimal camera-based QR scanner wrapper using AVFoundation.
struct QRScannerView: UIViewControllerRepresentable {

    let onResult: (String) -> Void

    func makeUIViewController(context: Context) -> QRScannerViewController {
        let vc = QRScannerViewController()
        vc.onResult = onResult
        return vc
    }

    func updateUIViewController(_ uiViewController: QRScannerViewController, context: Context) {}
}

final class QRScannerViewController: UIViewController, AVCaptureMetadataOutputObjectsDelegate {

    var onResult: ((String) -> Void)?
    private var captureSession: AVCaptureSession?

    override func viewDidLoad() {
        super.viewDidLoad()
        setupCamera()
    }

    private func setupCamera() {
        let session = AVCaptureSession()
        guard let device = AVCaptureDevice.default(for: .video),
              let input = try? AVCaptureDeviceInput(device: device)
        else { return }

        session.addInput(input)

        let output = AVCaptureMetadataOutput()
        session.addOutput(output)
        output.setMetadataObjectsDelegate(self, queue: .main)
        output.metadataObjectTypes = [.qr]

        let preview = AVCaptureVideoPreviewLayer(session: session)
        preview.frame = view.bounds
        preview.videoGravity = .resizeAspectFill
        view.layer.addSublayer(preview)

        session.startRunning()
        captureSession = session
    }

    func metadataOutput(
        _ output: AVCaptureMetadataOutput,
        didOutput metadataObjects: [AVMetadataObject],
        from connection: AVCaptureConnection
    ) {
        guard let object = metadataObjects.first as? AVMetadataMachineReadableCodeObject,
              let value = object.stringValue
        else { return }
        captureSession?.stopRunning()
        onResult?(value)
    }
}
