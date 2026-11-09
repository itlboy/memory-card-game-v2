import UIKit
import Capacitor
#if canImport(GoogleSignIn)
import GoogleSignIn
#endif

class SceneDelegate: UIResponder, UIWindowSceneDelegate {
    var window: UIWindow?

    func scene(_ scene: UIScene, willConnectTo session: UISceneSession, options connectionOptions: UIScene.ConnectionOptions) {
        guard let windowScene = scene as? UIWindowScene else { return }

        window = UIWindow(windowScene: windowScene)
        window?.rootViewController = GameViewController()
        window?.makeKeyAndVisible()

        SceneDelegateProxy.shared.scene(scene, willConnectTo: session, options: connectionOptions)
    }

    func scene(_ scene: UIScene, openURLContexts URLContexts: Set<UIOpenURLContext>) {
        // Đăng nhập Google (1.5.0): URL quay về từ Google thì đưa cho GoogleSignIn trước
        #if canImport(GoogleSignIn)
        if let url = URLContexts.first?.url, GIDSignIn.sharedInstance.handle(url) { return }
        #endif
        SceneDelegateProxy.shared.scene(scene, openURLContexts: URLContexts)
    }

    func scene(_ scene: UIScene, continue userActivity: NSUserActivity) {
        SceneDelegateProxy.shared.scene(scene, continue: userActivity)
    }
}

/// Bridge của game: đăng ký plugin tự viết. Đặt trong file này (đã nằm trong project
/// Xcode) để khỏi phải sửa tay project.pbxproj khi thêm file .swift mới.
class GameViewController: CAPBridgeViewController {
    override open func capacitorDidLoad() {
        bridge?.registerPluginInstance(NgonNguAppPlugin())
        // KHÔNG bật `allowsBackForwardNavigationGestures`: cử chỉ đó trượt vào ẢNH CHỤP CŨ của
        // mục lịch sử trước, rồi gỡ ảnh trước khi web kịp vẽ lại → trang cũ nháy lên (chủ dự án
        // báo 25.10.2026, build 384). Vuốt mép trái để lùi làm bằng web: lib/nut-back.ts.
    }
}

/// GHI NGÔN NGỮ GAME XUỐNG CÀI ĐẶT MÁY: chọn ngôn ngữ trong game thì Cài đặt →
/// Flip Match → Ngôn ngữ đổi theo (đúng khoá `AppleLanguages` mà trang Cài đặt đó
/// ghi). Có hiệu lực từ lần mở sau — xem web lib/ngon-ngu-app.ts. Mã phải khớp tên
/// thư mục <mã>.lproj (pt-BR, zh-Hans).
@objc(NgonNguAppPlugin)
public class NgonNguAppPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "NgonNguAppPlugin"
    public let jsName = "NgonNguApp"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "dat", returnType: CAPPluginReturnPromise)
    ]

    @objc func dat(_ call: CAPPluginCall) {
        guard let ma = call.getString("ma"), !ma.isEmpty else {
            call.reject("thiếu mã ngôn ngữ")
            return
        }
        UserDefaults.standard.set([ma], forKey: "AppleLanguages")
        call.resolve()
    }
}

