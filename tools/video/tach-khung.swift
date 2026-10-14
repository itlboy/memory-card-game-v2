// TÁCH KHUNG HÌNH TỪ VIDEO quay màn hình điện thoại (AVFoundation — ffmpeg trên máy
// này hay hỏng thư viện). Dùng soi lỗi chỉ thấy trên máy thật (iOS ghép lớp GPU).
//   swift tools/video/tach-khung.swift <video.mp4> <thư mục ra> <từ giây> <tới giây> <bước giây>
// ví dụ cả video mỗi 0,25s: ... 0 99 0.25 · soi kỹ một đoạn 30 khung/giây: ... 1.0 1.7 0.0334
import AVFoundation
import AppKit
let args = CommandLine.arguments
let url = URL(fileURLWithPath: args[1]); let out = args[2]
let start = Double(args[3])!, end = Double(args[4])!, step = Double(args[5])!
let asset = AVURLAsset(url: url)
let dur = CMTimeGetSeconds(asset.duration)
print("duration", dur)
let gen = AVAssetImageGenerator(asset: asset)
gen.appliesPreferredTrackTransform = true
gen.requestedTimeToleranceBefore = .zero; gen.requestedTimeToleranceAfter = .zero
gen.maximumSize = CGSize(width: 390, height: 900)
var t = start; var i = 0
while t <= min(end, dur) {
  if let cg = try? gen.copyCGImage(at: CMTime(seconds: t, preferredTimescale: 600), actualTime: nil) {
    let rep = NSBitmapImageRep(cgImage: cg)
    let data = rep.representation(using: .png, properties: [:])!
    try! data.write(to: URL(fileURLWithPath: String(format: "%@/f-%04d.png", out, Int((t * 1000).rounded()))))
    i += 1
  }
  t += step
}
print("frames", i)
