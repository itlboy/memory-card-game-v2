// GHÉP CÁC KHUNG f-*.png THÀNH MỘT BẢNG để xem cả đoạn trong một ảnh (tên file in đỏ).
//   swift tools/video/ghep-bang.swift <thư mục khung> <ảnh ra.png> <số cột> <bề rộng mỗi ô px>
import AppKit
let a = CommandLine.arguments; let dir = a[1], out = a[2], cols = Int(a[3])!, w = CGFloat(Double(a[4])!)
let files = try! FileManager.default.contentsOfDirectory(atPath: dir).filter { $0.hasPrefix("f-") }.sorted()
let imgs = files.compactMap { NSImage(contentsOfFile: dir + "/" + $0) }
let h = w * imgs[0].size.height / imgs[0].size.width
let rows = (imgs.count + cols - 1) / cols
let lab: CGFloat = 16
let size = NSSize(width: w * CGFloat(cols), height: (h + lab) * CGFloat(rows))
let rep = NSBitmapImageRep(bitmapDataPlanes: nil, pixelsWide: Int(size.width), pixelsHigh: Int(size.height), bitsPerSample: 8, samplesPerPixel: 4, hasAlpha: true, isPlanar: false, colorSpaceName: .deviceRGB, bytesPerRow: 0, bitsPerPixel: 0)!
NSGraphicsContext.saveGraphicsState(); NSGraphicsContext.current = NSGraphicsContext(bitmapImageRep: rep)
NSColor.white.setFill(); NSRect(origin: .zero, size: size).fill()
for (i, im) in imgs.enumerated() {
  let r = i / cols, c = i % cols
  let y = size.height - CGFloat(r + 1) * (h + lab)
  im.draw(in: NSRect(x: CGFloat(c) * w, y: y, width: w, height: h))
  (files[i] as NSString).draw(at: NSPoint(x: CGFloat(c) * w + 2, y: y + h + 1), withAttributes: [.font: NSFont.systemFont(ofSize: 11), .foregroundColor: NSColor.red])
}
NSGraphicsContext.restoreGraphicsState()
try! rep.representation(using: .png, properties: [:])!.write(to: URL(fileURLWithPath: out))
print(imgs.count)
